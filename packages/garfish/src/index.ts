/**
 * Garfish统一导出内容，使用：
 * 主应用 index.js
 * import Garfish from 'garfish';
 * Garfish.run(options)
 */
export type { interfaces } from '@garfish/core';
export { default as Garfish } from '@garfish/core';
export { GarfishInstance as default } from './instance';
export { defineCustomElements } from './customElement';
