import { warn } from '@garfish/utils';

export type Callback<T, K> = (...args: ArgsType<T>) => K;
export type ArgsType<T> = T extends Array<any> ? T : Array<any>;

/**
 * 同步Hook
 * 实际上就个事件监听/触发类，用于管理插件上注册的各种钩子（函数）
 */
export class SyncHook<T, K> {
  public type: string = '';
  public listeners = new Set<Callback<T, K>>();

  constructor(type?: string) {
    if (type) this.type = type;
  }

  on(fn: Callback<T, K>) {
    if (typeof fn === 'function') {
      this.listeners.add(fn);
    } else if (__DEV__) {
      warn('Invalid parameter in "Hook".');
    }
  }

  once(fn: Callback<T, K>) {
    const self = this;
    this.on(function wrapper(...args: Array<any>) {
      self.remove(wrapper);
      return fn.apply(null, args);
    });
  }

  emit(...data: ArgsType<T>) {
    if (this.listeners.size > 0) {
      this.listeners.forEach((fn) => fn.apply(null, data));
    }
  }

  remove(fn: Callback<T, K>) {
    return this.listeners.delete(fn);
  }

  removeAll() {
    this.listeners.clear();
  }
}
