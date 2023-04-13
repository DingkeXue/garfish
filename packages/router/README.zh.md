# Garfish路由插件
- 用于管理garfish应用的路由事件，主要功能：
  - 注册了bootstrap生命周期钩子，监听路由变化（重写了window.history上的pushState/replaceState/popState事件，文件路径：src/agentRouter.ts/rewrite方法）
  - 根据路由变化，调用Garfish.loadApp方法加载/卸载对应的app（文件路径：src/index.ts）