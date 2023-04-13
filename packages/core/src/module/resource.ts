import { warn, error, Text, transformUrl, assert } from '@garfish/utils';
import type {
  Loader,
  StyleManager,
  TemplateManager,
  JavaScriptManager,
} from '@garfish/loader';
import { AppInfo } from './app';

// Fetch `script`, `link` and `module meta` elements
/**
 * 拉取`script`, `link` and `module meta` elements
 * @param appName 应用名
 * @param loader 加载器
 * @param entryManager 
 * @returns 
 */
function fetchStaticResources(
  appName: string,
  loader: Loader,
  entryManager: TemplateManager,
) {
  const toBoolean = (val) => typeof val !== 'undefined' && val !== 'false';

  // Get all script elements
  const jsNodes = Promise.all(
    entryManager
      .findAllJsNodes()
      .map((node) => {
        const src = entryManager.findAttributeValue(node, 'src');
        const type = entryManager.findAttributeValue(node, 'type');
        const crossOrigin = entryManager.findAttributeValue(
          node,
          'crossorigin',
        );

        // There should be no embedded script in the script element tag with the src attribute specified
        if (src) {
          const fetchUrl = entryManager.url
            ? transformUrl(entryManager.url, src)
            : src;
          const async = entryManager.findAttributeValue(node, 'async');
          const defer = entryManager.findAttributeValue(node, 'defer');

          // Scripts with "async" attribute will make the rendering process very complicated,
          // we have a preload mechanism, so we don’t need to deal with it.
          return loader
            .load<JavaScriptManager>({
              scope: appName,
              url: fetchUrl,
              crossOrigin,
              defaultContentType: type,
            })
            .then(({ resourceManager: jsManager }) => {
              if (jsManager) {
                jsManager.setDep(node);
                type && jsManager.setMimeType(type);
                jsManager.setAsyncAttribute(toBoolean(async));
                jsManager.setDefferAttribute(toBoolean(defer));
                return jsManager;
              } else {
                warn(`[${appName}] Failed to load script: ${fetchUrl}`);
              }
            })
            .catch(() => null);
        } else if (node.children.length > 0) {
          const code = (node.children[0] as Text).content;
          if (code) {
            const jsManager = new loader.JavaScriptManager(code, '');
            jsManager.setDep(node);
            type && jsManager.setMimeType(type);
            return jsManager;
          }
        }
      })
      .filter(Boolean),
  );

  // Get all link elements
  const linkNodes = Promise.all(
    entryManager
      .findAllLinkNodes()
      .map((node) => {
        if (!entryManager.DOMApis.isCssLinkNode(node)) return;
        const href = entryManager.findAttributeValue(node, 'href');
        if (href) {
          const fetchUrl = entryManager.url
            ? transformUrl(entryManager.url, href)
            : href;
          return loader
            .load<StyleManager>({ scope: appName, url: fetchUrl })
            .then(({ resourceManager: styleManager }) => {
              if (styleManager) {
                styleManager.setDep(node);
                styleManager?.correctPath();
                return styleManager;
              } else {
                warn(`${appName} Failed to load link: ${fetchUrl}`);
              }
            })
            .catch(() => null);
        }
      })
      .filter(Boolean),
  );

  // Get all remote modules
  const metaNodes = Promise.all(
    entryManager
      .findAllMetaNodes()
      .map((node) => {
        if (!entryManager.DOMApis.isRemoteModule(node)) return;
        const async = entryManager.findAttributeValue(node, 'async');
        const alias = entryManager.findAttributeValue(node, 'alias');
        if (!toBoolean(async)) {
          const src = entryManager.findAttributeValue(node, 'src');
          if (src) {
            return loader
              .loadModule(src)
              .then(({ resourceManager: moduleManager }) => {
                if (moduleManager && alias) {
                  moduleManager && moduleManager.setAlias(alias);
                }
                return moduleManager;
              })
              .catch(() => null);
          }
        } else if (alias) {
          warn(`Asynchronous loading module, the alias "${alias}" is invalid.`);
        }
      })
      .filter(Boolean),
  );

  return Promise.all([jsNodes, linkNodes, metaNodes]).then((ls) =>
    ls.map((ns: any) => ns.filter(Boolean)),
  );
}

/**
 * 加载子应用资源入口，资源加载分为两种类型：1.html 2.js资源
 * @param loader 加载器
 * @param appInfo 应用信息
 * @returns 
 */
export async function processAppResources(loader: Loader, appInfo: AppInfo) {
  let isHtmlMode: Boolean = false,
    fakeEntryManager;
  const resources: any = { js: [], link: [], modules: [] }; // Default resources
  assert(appInfo.entry, `[${appInfo.name}] Entry is not specified.`);
  // 会根据主应用到入口地址（entry）判断是什么类型的资源
  const { resourceManager: entryManager } = await loader.load({
    scope: appInfo.name,
    url: transformUrl(location.href, appInfo.entry),
  });

  // 根据不同类型加载对应资源（目前只有 html | js）
  // Html entry
  if (entryManager instanceof loader.TemplateManager) {
    isHtmlMode = true;
    // 加载html资源
    const [js, link, modules] = await fetchStaticResources(
      appInfo.name,
      loader,
      entryManager,
    );
    resources.js = js;
    resources.link = link;
    resources.modules = modules;
  } else if (entryManager instanceof loader.JavaScriptManager) {
    // Js entry
    isHtmlMode = false;
    const mockTemplateCode = `<script src="${entryManager.url}"></script>`;
    fakeEntryManager = new loader.TemplateManager(
      mockTemplateCode,
      entryManager.url,
    );
    entryManager.setDep(fakeEntryManager.findAllJsNodes()[0]);
    resources.js = [entryManager];
  } else {
    error(`Entrance wrong type of resource of "${appInfo.name}".`);
  }

  return [fakeEntryManager || entryManager, resources, isHtmlMode];
}
