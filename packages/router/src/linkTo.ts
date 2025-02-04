import { parseQuery, getAppRootPath, getPath } from './utils/urlUt';
import { callCapturedEventListeners } from './utils/navEvent';
import { asyncForEach, toMiddleWare } from './utils';
import {
  RouterConfig,
  setRouterConfig,
  RouterInfo,
  __GARFISH_ROUTER_UPDATE_FLAG__,
  __GARFISH_ROUTER_FLAG__,
  __GARFISH_BEFORE_ROUTER_EVENT__,
} from './config';

// Inspection application is activated
/**
 * 判断子应用是否激活
 * @param activeWhen appInfo.activeWhen
 * @param path 路由的路径
 * @returns boolean
 */
const hasActive = (activeWhen: any, path: string) => {
  if (typeof activeWhen === 'string') {
    // 将activeWhen处理成/xx形式
    if (activeWhen[0] !== '/') activeWhen = `/${activeWhen}`;
    // Set to the root path must be congruent
    // activeWhen为根路径且等于当前path，返回true
    if (activeWhen === '/' && path === activeWhen) return true;

    // 对比每一条路径
    const activeWhenArr = activeWhen.split('/');
    const pathArr = path.split('/');
    let flag: boolean = true;
    activeWhenArr.forEach((pathItem: string, index: number) => {
      if (pathItem && pathItem !== pathArr[index]) {
        flag = false;
      }
    });
    return flag;
  } else {
    return activeWhen(path);
  }
};

// Overloading to specify the routing
// 1. Applications for current needs to be destroyed
// 2. Gets the current need to activate the application
// 3. To acquire new need to activate the application
// 4. Trigger function beforeEach, trigger in front of the destroyed all applications
// 5. Trigger the need to destroy deactive function of application
// 6. If there is no need to activate the application, by default, triggering popstate application component view child to update
export const linkTo = async ({
  toRouterInfo,
  fromRouterInfo,
  eventType,
}: {
  toRouterInfo: RouterInfo;
  fromRouterInfo: RouterInfo;
  eventType: keyof History | 'popstate';
}) => {
  const {
    current,
    apps,
    deactive,
    active,
    notMatch,
    beforeEach,
    afterEach,
    autoRefreshApp,
  } = RouterConfig;

  // 遍历出当前没有被激活的子应用
  const deactiveApps = current!.matched.filter(
    (appInfo) =>
      !hasActive(
        appInfo.activeWhen,
        getPath(appInfo.basename, location.pathname),
      ),
  );

  // Activate the corresponding application
  // 找出路由匹配的子应用
  const activeApps = apps.filter((appInfo) => {
    return hasActive(
      appInfo.activeWhen,
      getPath(appInfo.basename, location.pathname),
    );
  });

  // 找出需要被激活的应用：路径匹配但名字没匹配上的应用
  const needToActive = activeApps.filter(({ name }) => {
    return !current!.matched.some(({ name: cName }) => name === cName);
  });

  // router infos
  const to = {
    ...toRouterInfo,
    matched: needToActive,
  };

  const from = {
    ...fromRouterInfo,
    matched: deactiveApps,
  };

  // beforeEach全局钩子：路由跳转后，子应用挂载前钩子
  await toMiddleWare(to, from, beforeEach!);

  // Pause the current application of active state
  // 卸载子应用
  if (current!.matched.length > 0) {
    await asyncForEach(
      deactiveApps,
      async (appInfo) =>
        await deactive(appInfo, getPath(appInfo.basename, location.pathname)),
    );
  }

  setRouterConfig({
    current: {
      path: getPath(RouterConfig.basename!),
      fullPath: location.pathname,
      href: location.href,
      matched: activeApps,
      state: history.state,
      query: parseQuery(location.search),
    },
  });

  // Within the application routing jump, by collecting the routing function for processing.
  // Filtering gar-router popstate hijacking of the router
  // In the switch back and forth in the application is provided through routing push method would trigger application updates
  // application will refresh when autoRefresh configuration to true
  const curState = window.history.state || {};
  if (
    eventType !== 'popstate' &&
    (curState[__GARFISH_ROUTER_UPDATE_FLAG__] || autoRefreshApp)
  ) {
    callCapturedEventListeners(eventType);
  }

  // 激活匹配路由的子应用
  await asyncForEach(needToActive, async (appInfo) => {
    // Function using matches character and routing using string matching characters
    const appRootPath = getAppRootPath(appInfo);
    await active(appInfo, appRootPath);
  });

  if (activeApps.length === 0 && notMatch) notMatch(location.pathname);

  // afterEach全局钩子：路由跳转后，子应用挂载后钩子
  await toMiddleWare(to, from, afterEach!);
};
