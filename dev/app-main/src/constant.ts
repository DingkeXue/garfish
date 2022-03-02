import { getProxyHost } from './util';
import portMap from '../../config.json';
import GarfishInstance from 'garfish';

export const prefixCls = 'main-app';
export const loadApp = 'loadApp';
export const basename = 'examples';

type AppInfo = NonNullable<Parameters<typeof GarfishInstance.run>[0]>['apps'];

export const localApps: AppInfo = [
  {
    // 每个应用的 name 需要保持唯一
    name: 'react17',
    activeWhen: '/react17',
    // 子应用的入口地址，可以为 HTML 地址和 JS 地址
    // 注意：entry 地址不可以与主应用+子应用激活地址相同，否则刷新时将会直接返回子应用内容
    entry: getProxyHost(portMap['dev/react17'].port),
  },
  {
    name: 'react16',
    activeWhen: '/react16',
    entry: getProxyHost(portMap['dev/react16'].port),
  },
  {
    name: 'vue3',
    activeWhen: '/vue3',
    // 提供不同的挂载点，react 应用使用全局的 domGetter 挂载点
    domGetter: '#sub-container',
    entry: getProxyHost(portMap['dev/vue3'].port),
  },
  {
    name: 'vue2',
    // activeWhen 函数式写法，当 path 中包含 "/vue2" 时返回 true,app vue2 将会自动挂载至页面中，手动挂在时可不填写该参数
    activeWhen: (path) => path.includes('/vue2'),
    entry: getProxyHost(portMap['dev/vue2'].port),
  },
  {
    name: 'vue-sub',
    activeWhen: '/vue-sub',
    entry: getProxyHost(portMap['dev/vue-sub'].port),
  },
  {
    name: 'vite',
    activeWhen: '/vite',
    entry: getProxyHost(portMap['dev/vite'].port),
    // 沙箱关闭 sandbox: false 否则可能会出现子应用部分代码在沙箱内执行，部分不在沙箱执行
    sandbox: false,
  },
  {
    name: 'angular',
    activeWhen: '/angular',
    entry: getProxyHost(portMap['dev/angular'].port),
  },
];