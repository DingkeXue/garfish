interface Defer {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

/**
 * esm Queue队列
 */
export class Queue {
  private fx: Array<Function> = [];
  private init = true;
  private lock = false;
  private finishDefers = new Set<Defer>();

  private next() {
    if (!this.lock) {
      this.lock = true;
      if (this.fx.length === 0) {
        this.init = true;
        this.finishDefers.forEach((d) => d.resolve());
        this.finishDefers.clear();
      } else {
        // 执行第一个esm注册的函数
        const fn = this.fx.shift();
        if (fn) {
          fn(() => {
            this.lock = false;
            this.next();
          });
        }
      }
    }
  }

  /**
   * 添加esm
   * @param fn 
   */
  add(fn: (next: () => void) => void) {
    this.fx.push(fn);
    if (this.init) {
      this.lock = false;
      this.init = false;
      // 添加后执行
      this.next();
    }
  }

  awaitCompletion() {
    if (this.init) return Promise.resolve();
    const defer = {} as Defer;
    this.finishDefers.add(defer);
    return new Promise((resolve, reject) => {
      defer.resolve = resolve;
      defer.reject = reject;
    });
  }
}
