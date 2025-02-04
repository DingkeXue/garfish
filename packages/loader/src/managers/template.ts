import {
  Node,
  Text,
  DOMApis,
  deepMerge,
  transformUrl,
  templateParse,
} from '@garfish/utils';

type Renderer = Record<string, (node: Node) => null | Element | Comment>;
type CommonRender = (
  node: Node,
  parent: Element,
) => { customElement?: Element | null };

/**
 * html模版加载器
 */
export class TemplateManager {
  public url: string | undefined;
  public DOMApis = new DOMApis();
  public astTree: Array<Node> = [];
  private pretreatmentStore: Record<string, Node[]> = {};

  /**
   * 构造函数
   * 1.解析html字符串 ===> [astTree, collectionEls]
   * @param template html字符串代码
   * @param url 资源地址
   */
  constructor(template: string, url?: string) {
    // The url is only base url, it may also be a js resource address.
    this.url = url;
    if (template) {
      // 解析html
      const [astTree, collectionEls] = templateParse(template, [
        'meta',
        'link',
        'style',
        'script',
      ]);
      this.astTree = astTree;
      this.pretreatmentStore = collectionEls;
      console.log('TemplateManager constructor---->', 'astTree:', astTree, 'collectionEls:', collectionEls)
    }
  }

  getNodesByTagName<T>(...tags: Array<keyof T>) {
    let counter = 0;
    const collection: Record<keyof T, Array<Node>> = {} as any;

    for (const tag of tags as string[]) {
      if (this.pretreatmentStore[tag]) {
        counter++;
        collection[tag] = this.pretreatmentStore[tag];
      } else {
        collection[tag] = [];
      }
    }

    if (counter !== tags.length) {
      const traverse = (node: Node | Text) => {
        if (node.type !== 'element') return;
        if (
          tags.indexOf(node.tagName as any) > -1 &&
          !this.pretreatmentStore[node.tagName]
        ) {
          collection[node.tagName].push(node);
        }
        for (const child of node.children) traverse(child);
      };
      for (const node of this.astTree) traverse(node);
    }
    return collection;
  }

  // Render dom tree
  /**
   * 遍历html的AST生成最终的节点树
   * @param renderer 内置渲染器
   * @param parent 父级节点（创建出来的子应用挂载点）
   * @param commonRender 自定义渲染器
   * @returns 
   */
  createElements(
    renderer: Renderer,
    parent: Element,
    commonRender?: CommonRender,
  ) {
    const elements: Array<Element> = [];
    const traverse = (node: Node | Text, parentEl?: Element) => {
      let el: any;
      if (this.DOMApis.isCommentNode(node)) {
        // Filter comment node
      } else if (this.DOMApis.isText(node)) {
        el = this.DOMApis.createTextNode(node);
        parentEl && parentEl.appendChild(el);
      } else if (this.DOMApis.isNode(node)) {
        const { tagName, children } = node;
        if (typeof commonRender === 'function') {
          el = commonRender(node, parent)?.customElement;
        }
        // If the general renderer does not return a result, need to use the internal renderer
        // 如果DOMApis.createTextNode 和 commonRender都没有匹配，使用 renderer 渲染器提供的方法创建节点
        if (!el) {
          if (renderer[tagName]) {
            el = renderer[tagName](node);
          } else {
            el = this.DOMApis.createElement(node);
          }
        }

        if (parentEl && el) {
          parentEl.appendChild(el);
        }

        if (el) {
          const { nodeType, _ignoreChildNodes } = el;
          // Filter "comment" and "document" node
          if (!_ignoreChildNodes && nodeType !== 8 && nodeType !== 10) {
            for (const child of children) {
              traverse(child, el);
            }
          }
        }
      }
      return el;
    };

    for (const node of this.astTree) {
      if (this.DOMApis.isNode(node) && node.tagName !== '!doctype') {
        const el = traverse(node, parent);
        el && elements.push(el);
      }
    }
    return elements;
  }

  toResolveUrl(node: Node, type: string, baseUrl?: string) {
    const src = node.attributes?.find(({ key }) => key === type);
    if (src && src.value && baseUrl) {
      src.value = transformUrl(baseUrl, src.value);
    }
  }

  ignoreChildNodesCreation(node: Element) {
    if (node) {
      (node as any)._ignoreChildNodes = true;
    }
    return node;
  }

  findAllMetaNodes() {
    return this.getNodesByTagName('meta').meta;
  }

  findAllLinkNodes() {
    return this.getNodesByTagName('link').link;
  }

  findAllJsNodes() {
    return this.getNodesByTagName('script').script;
  }

  findAttributeValue(node: Node, type: string) {
    return node.attributes?.find(({ key }) => key === type)?.value || undefined;
  }

  cloneNode(node: Node) {
    return deepMerge(node, {});
  }

  clone() {
    // @ts-ignore
    const cloned = new this.constructor();
    cloned.url = this.url;
    cloned.astTree = this.astTree;
    cloned.pretreatmentStore = this.pretreatmentStore;
    cloned.DOMApis = new DOMApis(this.DOMApis.document);
    return cloned;
  }
}
