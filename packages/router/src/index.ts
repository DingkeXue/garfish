import type { interfaces } from '@garfish/core';
import { createKey, routerLog } from '@garfish/utils';
import { RouterConfig } from './config';
import router, {
  initRedirect,
  RouterInterface,
  listenRouterAndReDirect,
} from './context';

declare module '@garfish/core' {
  export default interface Garfish {
    router: RouterInterface;
    apps: Record<string, interfaces.App>;
  }

  export namespace interfaces {
    export interface Config {
      autoRefreshApp?: boolean;
      onNotMatchRouter?: (path: string) => Promise<void> | void;
    }

    export interface AppInfo {
      activeWhen?: string | ((path: string) => boolean); // 手动加载，可不填写路由
      active?: (appInfo: AppInfo, rootPath: string) => void;
      deactive?: (appInfo: AppInfo, rootPath: string) => void;
      rootPath?: string;
      basename?: string;
    }
  }
}

export type { RouterInterface } from './context';

interface Options {
  autoRefreshApp?: boolean;
  onNotMatchRouter?: (path: string) => Promise<void> | void;
}

/**
 * Garfish路由插件
 * @param _args 
 * @returns 
 */
export function GarfishRouter(_args?: Options) {
  return function (Garfish: interfaces.Garfish): interfaces.Plugin {
    Garfish.apps = {};
    Garfish.router = router;

    return {
      name: 'router',
      version: __VERSION__,

      // bootstrap钩子 garfish初始化阶段 
      // 监听路由
      bootstrap(options: interfaces.Options) {
        let activeApp: null | string = null;
        const unmounts: Record<string, Function> = {};
        // 获取basename （主应用调用Garfish.run({ basename: '' }) 传进来的）
        const { basename } = options;
        const { autoRefreshApp = true, onNotMatchRouter = () => null } =
          Garfish.options;

        // 激活子应用
        async function active(
          appInfo: interfaces.AppInfo, // 子应用信息
          rootPath: string = '/', // activeWhen
        ) {
          routerLog(`${appInfo.name} active`, {
            appInfo,
            rootPath,
            listening: RouterConfig.listening,
          });
          console.log(33333, 'active route')

          // In the listening state, trigger the rendering of the application
          if (!RouterConfig.listening) return;

          const { name, active, cache = true } = appInfo;
          // 如果子应用自己代理了active事件，优先执行它
          if (active) return active(appInfo, rootPath);
          appInfo.rootPath = rootPath;

          // 为当前激活的app赋值唯一的key (Math.random())
          const currentApp = (activeApp = createKey());
          // 加载子应用
          const app = await Garfish.loadApp(appInfo.name, {
            cache,
            basename: rootPath,
            entry: appInfo.entry,
            domGetter: appInfo.domGetter,
          });

          if (app) {
            app.appInfo.basename = rootPath;

            // 执行子应用的显示、隐藏
            const call = async (app: interfaces.App, isRender: boolean) => {
              if (!app) return;
              const isDes = cache && app.mounted;
              if (isRender) {
                // 如果走缓存，使用show方法；否则走挂在流程
                return await app[isDes ? 'show' : 'mount']();
              } else {
                return app[isDes ? 'hide' : 'unmount']();
              }
            };

            Garfish.apps[name] = app;
            // 将应用注册到unmounts对象上（隐藏/卸载的时候调用）
            unmounts[name] = () => {
              // Destroy the application during rendering and discard the application instance
              if (app.mounting) {
                delete Garfish.cacheApps[name];
              }
              call(app, false);
            };

            if (currentApp === activeApp) {
              await call(app, true);
            }
          }
        }

        // 卸载路由
        async function deactive(appInfo: interfaces.AppInfo, rootPath: string) {
          routerLog(`${appInfo.name} deactive`, {
            appInfo,
            rootPath,
          });

          activeApp = null;
          const { name, deactive } = appInfo;
          // 如果子应用自己注册了卸载事件，执行对应函数
          if (deactive) return deactive(appInfo, rootPath);

          // 否则执行默认的卸载操作
          const unmount = unmounts[name];
          unmount && unmount();
          delete Garfish.apps[name];

          // Nested scene to remove the current application of nested data
          // To avoid the main application prior to application
          // 从主应用上删除appInfo.rootPath === app.basename的子应用
          const needToDeleteApps = router.routerConfig.apps.filter((app) => {
            if (appInfo.rootPath === app.basename) return true;
          });
          if (needToDeleteApps.length > 0) {
            needToDeleteApps.forEach((app) => {
              delete Garfish.appInfos[app.name];
              delete Garfish.cacheApps[app.name];
            });
            router.setRouterConfig({
              apps: router.routerConfig.apps.filter((app) => {
                return !needToDeleteApps.some(
                  (needDelete) => app.name === needDelete.name,
                );
              }),
            });
          }
        }

        const apps = Object.values(Garfish.appInfos);

        // 筛选出app.activeWhen存在的子应用
        const appList = apps.filter((app) => {
          // 如果app没有注册basename，那么它的basename为主应用的basename
          if (!app.basename) app.basename = basename;
          return !!app.activeWhen;
        }) as Array<Required<interfaces.AppInfo>>;

        // 设置RouterConfig的参数
        const listenOptions = {
          basename,
          active,
          deactive,
          autoRefreshApp,
          notMatch: onNotMatchRouter,
          apps: appList,
          listening: true,
        };
        routerLog('listenRouterAndReDirect', listenOptions);
        // 开始真正初始化路由并监听路由事件，当路由变化时，会触发对应的active、deactive事件
        // 链路：listenRouterAndReDirect --> listen --> initRedirect(linkTo应用首页路由) & normalAgent(监听路由事件)
        listenRouterAndReDirect(listenOptions);
      },

      // registerApp钩子 
      // 1.注册路由 2.初始化路由
      registerApp(appInfos) {
        const appList = Object.values(appInfos);
        // @ts-ignore
        router.registerRouter(appList.filter((app) => !!app.activeWhen));
        // After completion of the registration application, trigger application mount
        // Has been running after adding routing to trigger the redirection
        if (!Garfish.running) return;
        routerLog('registerApp initRedirect', appInfos);
        initRedirect();
      },
    };
  };
}
