import { warn, assert, isPlainObject } from '@garfish/utils';

export type Plugin<T extends Record<string, any>> = {
  [k in keyof T]?: Parameters<T[k]['on']>[0];
} & {
  name: string;
  version?: string;
};

/**
 * 插件系统
 */
export class PluginSystem<T extends Record<string, any>> {
  lifecycle: T;
  lifecycleKeys: Array<keyof T>;
  registerPlugins: Record<string, Plugin<T>> = {};

  /**
   * @param lifecycle 
   * lifecycle入参（共计7个）：
   * {
      beforeBootstrap: new SyncHook<[interfaces.Options], void>(),
      bootstrap: new SyncHook<[interfaces.Options], void>(),
      beforeRegisterApp: new SyncHook<[interfaces.AppInfo | Array<interfaces.AppInfo>], void>(),
      registerApp: new SyncHook<[Record<string, interfaces.AppInfo>], void>(),
      beforeLoad: new AsyncHook<[interfaces.AppInfo]>(),
      afterLoad: new AsyncHook<[interfaces.AppInfo, interfaces.App | null]>(),
      errorLoadApp: new SyncHook<[Error, interfaces.AppInfo], void>(),
    }
   */
  constructor(lifecycle: T) {
    this.lifecycle = lifecycle;
    this.lifecycleKeys = Object.keys(lifecycle);
  }

  /**
   * 注册插件
   * @param plugin 插件
   */
  usePlugin(plugin: Plugin<T>) {
    assert(isPlainObject(plugin), 'Invalid plugin configuration.');
    // Plugin name is required and unique
    const pluginName = plugin.name;
    assert(pluginName, 'Plugin must provide a name.');

    // 如果registerPlugins中没有注册过，注册该插件
    if (!this.registerPlugins[pluginName]) {
      this.registerPlugins[pluginName] = plugin;

      // 提取出插件上的hooks并加入到对应钩子函数的监听列表中
      for (const key in this.lifecycle) {
        const pluginLife = plugin[key as string];
        if (pluginLife) {
          // Differentiate different types of hooks and adopt different registration strategies
          // 下面最终执行的this.lifecycle[key]上的 this.listeners.add(pluginLife) 方法 （在hooks/synHook.ts文件中）;
          this.lifecycle[key].on(pluginLife);
        }
      }
    } else {
      warn(`Repeat to register plugin hooks "${pluginName}".`);
    }
  }

  /**
   * 删除插件
   * @param pluginName 插件名
   */
  removePlugin(pluginName: string) {
    assert(pluginName, 'Must provide a name.');
    const plugin = this.registerPlugins[pluginName];
    assert(plugin, `plugin "${pluginName}" is not registered.`);

    // 依次删除插件内注册到listeners中的钩子
    for (const key in plugin) {
      if (key === 'name') continue;
      this.lifecycle[key].remove(plugin[key as string]);
    }
  }

  inherit<T extends PluginSystem<any>>({ lifecycle, registerPlugins }: T) {
    for (const hookName in lifecycle) {
      assert(
        !this.lifecycle[hookName],
        `"${hookName as string}" hook has conflict and cannot be inherited.`,
      );
      (this.lifecycle as any)[hookName] = lifecycle[hookName];
    }

    for (const pluginName in registerPlugins) {
      assert(
        !this.registerPlugins[pluginName],
        `"${pluginName}" plugin has conflict and cannot be inherited.`,
      );
      this.usePlugin(registerPlugins[pluginName]);
    }
    return this as typeof this & T;
  }
}
