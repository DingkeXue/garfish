import type { Node } from '@garfish/utils';
import {
  SyncHook,
  SyncWaterfallHook,
  AsyncHook,
  PluginSystem,
} from '@garfish/hooks';
import { interfaces } from './interface';

/**
 * Garfish类上的hooks属性
 * 
 * @returns 
 */
// prettier-ignore
export function globalLifecycle() {
  return new PluginSystem({
    beforeBootstrap: new SyncHook<[interfaces.Options], void>(),
    bootstrap: new SyncHook<[interfaces.Options], void>(),
    beforeRegisterApp: new SyncHook<[interfaces.AppInfo | Array<interfaces.AppInfo>], void>(),
    registerApp: new SyncHook<[Record<string, interfaces.AppInfo>], void>(),
    // load前 同步
    beforeLoad: new AsyncHook<[interfaces.AppInfo]>(),
    // load后 同步
    afterLoad: new AsyncHook<[interfaces.AppInfo, interfaces.App | null]>(),
    errorLoadApp: new SyncHook<[Error, interfaces.AppInfo], void>(),
  });
}

// prettier-ignore
export function appLifecycle() {
  return new PluginSystem({
    beforeEval: new SyncHook<[
        interfaces.AppInfo,
        string,
        Record<string, any>?,
        string?,
        { async?: boolean; noEntry?: boolean }?,
      ],
      void
    >(),
    afterEval: new SyncHook<
      [
        interfaces.AppInfo,
        string,
        Record<string, any>?,
        string?,
        { async?: boolean; noEntry?: boolean }?,
      ],
      void
    >(),
    beforeMount: new SyncHook<[interfaces.AppInfo, interfaces.App, boolean], void>(),
    afterMount: new SyncHook<[interfaces.AppInfo, interfaces.App, boolean], void>(),
    errorMountApp: new SyncHook<[Error, interfaces.AppInfo], void>(),
    beforeUnmount: new SyncHook<[interfaces.AppInfo, interfaces.App, boolean], void>(),
    afterUnmount: new SyncHook<[interfaces.AppInfo, interfaces.App, boolean], void>(),
    errorUnmountApp: new SyncHook<[Error, interfaces.AppInfo], void>(),
    errorExecCode: new SyncHook<
      [
        Error,
        interfaces.AppInfo,
        string,
        Record<string, any>?,
        string?,
        { async?: boolean; noEntry?: boolean }?,
      ],
      void
    >(),
    customRender: new SyncWaterfallHook<{
      node: Node,
      parent: Element,
      app: interfaces.App,
      customElement: Element | null,
    }>('customRender'),
  });
}
