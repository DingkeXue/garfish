import { Loader } from '@garfish/loader';
import { EventEmitter2 } from 'eventemitter2';
import { warn, assert, isPlainObject, __GARFISH_FLAG__ } from '@garfish/utils';
import {
  SyncHook,
  AsyncHook,
  SyncWaterfallHook,
  AsyncWaterfallHook,
  PluginSystem,
} from '@garfish/hooks';
import {
  deepMergeConfig,
  generateAppOptions,
  createDefaultOptions,
} from './config';
import { App } from './module/app';
import { interfaces } from './interface';
import { globalLifecycle } from './lifecycle';
import { processAppResources } from './module/resource';
import { GarfishHMRPlugin } from './plugins/fixHMR';
import { GarfishOptionsLife } from './plugins/lifecycle';
import { GarfishPreloadPlugin } from './plugins/preload';
import { GarfishPerformance } from './plugins/performance';
import { GarfishLogger } from './plugins/logger';

const DEFAULT_PROPS = new WeakMap();
const HOOKS_API = {
  SyncHook,
  AsyncHook,
  SyncWaterfallHook,
  AsyncWaterfallHook,
};

export class Garfish extends EventEmitter2 {
  public running = false;
  public version = __VERSION__;
  public flag = __GARFISH_FLAG__; // A unique identifier
  public loader = new Loader();
  // 初始化钩子 beforeBootstrap｜bootstrap｜beforeRegisterApp｜registerApp｜beforeLoad｜afterLoad｜errorLoadApp
  public hooks = globalLifecycle(); 
  public channel = new EventEmitter2();
  public options = createDefaultOptions();
  public externals: Record<string, any> = {};
  public activeApps: Array<interfaces.App> = [];
  public plugins: interfaces.Plugins = {} as any;
  public cacheApps: Record<string, interfaces.App> = {};
  public appInfos: Record<string, interfaces.AppInfo> = {};

  private loading: Record<string, Promise<any>> = {};

  get props(): Record<string, any> {
    return (this.options && this.options.props) || DEFAULT_PROPS.get(this);
  }

  /**
   * 构造函数
   * @param options 参数
   * {
      plugins: [GarfishRouter(), GarfishBrowserVm(), GarfishBrowserSnapshot()],
    }
   */
  constructor(options: interfaces.Options) {
    super();
    this.setOptions(options);
    DEFAULT_PROPS.set(this, {});
    this.options.plugins?.forEach((plugin) => this.usePlugin(plugin));
    this.usePlugin(GarfishHMRPlugin());
    this.usePlugin(GarfishPerformance());
    this.usePlugin(GarfishPreloadPlugin());
    this.usePlugin(GarfishLogger());
  }

  /**
   * 设置参数
   * @param options 
   * @returns 
   */
  setOptions(options: Partial<interfaces.Options>) {
    assert(!this.running, 'Garfish is running, can`t set options');
    if (isPlainObject(options)) {
      this.options = deepMergeConfig(this.options, options);
    }
    return this;
  }

  createPluginSystem<T extends (api: typeof HOOKS_API) => any>(callback: T) {
    const hooks = callback(HOOKS_API);
    return new PluginSystem<ReturnType<T>>(hooks);
  }

  /**
   * 注册插件
   * @param plugin 插件
   * @param args 插件参数
   * @returns 
   * 插件格式：
   * return function (GarfishInstance: interfaces.Garfish): interfaces.Plugin {
   *   return {
   *    name: 'garfish-router',
   *    version: '1.2.1',
   *     // ...
   *   };
   * };
   */
  usePlugin(
    plugin: (context: Garfish) => interfaces.Plugin,
    ...args: Array<any>
  ) {
    assert(!this.running, 'Cannot register plugin after Garfish is started.');
    assert(typeof plugin === 'function', 'Plugin must be a function.');
    // 将实例作为入参传给参数
    args.unshift(this);
    const pluginConfig = plugin.apply(null, args) as interfaces.Plugin;
    assert(pluginConfig.name, 'The plugin must have a name.');

    // 如果插件没有被注册过，注册到plugins中，key: name, value: pluginConfig
    if (!this.plugins[pluginConfig.name]) {
      this.plugins[pluginConfig.name] = pluginConfig;
      // Register hooks, Compatible with the old api
      // 调用hooks上的usePlugin方法注册插件（将插件里的钩子add到对应的listener里面）
      this.hooks.usePlugin(pluginConfig);
    } else if (__DEV__) {
      warn('Please do not register the plugin repeatedly.');
    }
    return this;
  }

  /**
   * 主应用注册子应用调用的方法
   * 1.判断是否已经在运行中了
   * 2.合并参数
   * 3.注册插件
   * @param options 配置对象
   * @returns 
   */
  run(options: interfaces.Options = {}) {
    // 如果已经在运行中了，直接返回
    if (this.running) {
      if (__DEV__) {
        warn('Garfish is already running now, Cannot run Garfish repeatedly.');
      }
      return this;
    }

    // 合并参数
    this.setOptions(options);
    // Register plugins
    // 注册插件
    options.plugins?.forEach((plugin) => this.usePlugin(plugin));
    // Put the lifecycle plugin at the end, so that you can get the changes of other plugins
    // 注册lifecycle插件
    this.usePlugin(GarfishOptionsLife(this.options, 'global-lifecycle'));

    // Emit hooks and register apps
    // 触发beforeBootstrap hooks 还不太清楚干什么
    this.hooks.lifecycle.beforeBootstrap.emit(this.options);
    // 注册app
    this.registerApp(this.options.apps || []);
    this.running = true;
    // 触发bootstrap hooks
    this.hooks.lifecycle.bootstrap.emit(this.options);
    return this;
  }

  /**
   * 注册子应用
   * 1.触发hooks上beforeRegisterApp的方法
   * @param list 子应用数组
   * [{
      name: 'react',
      activeWhen: '/react',
      entry: 'http://localhost:3000', // html入口
    }]
   * @returns 
   */
  registerApp(list: interfaces.AppInfo | Array<interfaces.AppInfo>) {
    const currentAdds = {};
    // 触发hooks上beforeRegisterApp的方法
    this.hooks.lifecycle.beforeRegisterApp.emit(list);
    if (!Array.isArray(list)) list = [list];

    // 依次将子应用加入到this.appInfos对象中key: name, value: appInfo
    for (const appInfo of list) {
      assert(appInfo.name, 'Miss app.name.');
      if (!this.appInfos[appInfo.name]) {
        assert(
          appInfo.entry,
          `${appInfo.name} application entry is not url: ${appInfo.entry}`,
        );
        currentAdds[appInfo.name] = appInfo;
        this.appInfos[appInfo.name] = appInfo;
      } else if (__DEV__) {
        warn(`The "${appInfo.name}" app is already registered.`);
      }
    }
    // 触发registerApp hooks
    this.hooks.lifecycle.registerApp.emit(currentAdds);
    return this;
  }

  setExternal(nameOrExtObj: string | Record<string, any>, value?: any) {
    assert(nameOrExtObj, 'Invalid parameter.');
    if (typeof nameOrExtObj === 'object') {
      for (const key in nameOrExtObj) {
        if (__DEV__) {
          this.externals[key] &&
            warn(`The "${key}" will be overwritten in external.`);
        }
        this.externals[key] = nameOrExtObj[key];
      }
    } else {
      this.externals[nameOrExtObj] = value;
    }
    return this;
  }

  /**
   * 加载应用
   * @param appName 应用名
   * @param options 应用配置
   * {
            cache,
            basename: rootPath,
            entry: appInfo.entry,
            domGetter: appInfo.domGetter,
          }
   * @returns 
   */
  loadApp(
    appName: string,
    options?: Partial<Omit<interfaces.AppInfo, 'name'>>,
  ): Promise<interfaces.App | null> {
    assert(appName, 'Miss appName.');

    // 生成最终的应用信息
    let appInfo = generateAppOptions(appName, this, options);

    // 异步加载应用
    const asyncLoadProcess = async () => {
      // Return not undefined type data directly to end loading
      const stop = await this.hooks.lifecycle.beforeLoad.emit(appInfo);

      if (stop === false) {
        warn(`Load ${appName} application is terminated by beforeLoad.`);
        return null;
      }

      //merge configs again after beforeLoad for the reason of app may be re-registered during beforeLoad resulting in an incorrect information
      appInfo = generateAppOptions(appName, this, appInfo);

      assert(
        appInfo.entry,
        `Can't load unexpected child app "${appName}", ` +
          'Please provide the entry parameters or registered in advance of the app.',
      );

      // Existing cache caching logic
      let appInstance: interfaces.App | null = null;
      const cacheApp = this.cacheApps[appName];

      // 如果开启了缓存且命中了缓存，走缓存策略
      if (appInfo.cache && cacheApp) {
        appInstance = cacheApp;
      } else { // 否则走挂载逻辑
        try {
          // 加载目标应用的所有资源（资源类型：html|js）
          const [manager, resources, isHtmlMode] = await processAppResources(
            this.loader,
            appInfo,
          );

          // 根据目标应用的所有资源和配置信息，初始化app实例
          appInstance = new App(
            this,
            appInfo,
            manager,
            resources,
            isHtmlMode,
            appInfo.customLoader,
          );

          // The registration hook will automatically remove the duplication
          for (const key in this.plugins) {
            appInstance.hooks.usePlugin(this.plugins[key]);
          }
          if (appInfo.cache) {
            this.cacheApps[appName] = appInstance;
          }
        } catch (e) {
          __DEV__ && warn(e);
          this.hooks.lifecycle.errorLoadApp.emit(e, appInfo);
        }
      }

      await this.hooks.lifecycle.afterLoad.emit(appInfo, appInstance);
      return appInstance;
    };

    if (!this.loading[appName]) {
      this.loading[appName] = asyncLoadProcess().finally(() => {
        delete this.loading[appName];
      });
    }
    return this.loading[appName];
  }
}
