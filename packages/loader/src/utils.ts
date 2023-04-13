import { error, parseContentType } from '@garfish/utils';
import { Manager, Loader } from './index';

/**
 * 请求资源函数
 * @param customFetch 
 * @returns 
 */
export function getRequest(customFetch: Loader['hooks']['lifecycle']['fetch']) {
  return async function request(url: string, config: RequestInit) {
    // 如果存在自定义请求方法，使用自定义的；否则使用fetch
    let result = await customFetch.emit(url, config || {});
    if (!result || !(result instanceof Response)) {
      result = await fetch(url, config || {});
    }

    // Response codes greater than "400" are regarded as errors
    if (result.status >= 400) {
      error(`"${url}" load failed with status "${result.status}"`);
    }
    // 代码转字符串（这里没有直接执行）
    const code = await result.text();
    // 获取资源类型
    const type = result.headers.get('content-type') || '';
    // 获取资源大小
    const size = Number(result.headers.get('content-size'));
    // 获取mimeType
    const mimeType = parseContentType(type || '');

    return {
      code,
      result,
      mimeType,
      type,
      size: Number.isNaN(size) ? null : size,
    };
  };
}

export function copyResult(result) {
  if (result.resourceManager) {
    result.resourceManager = (result.resourceManager as Manager).clone();
  }
  return result;
}

// Compatible with old api
export function mergeConfig(loader: Loader, url: string) {
  const extra = loader.requestConfig;
  const config = typeof extra === 'function' ? extra(url) : extra;
  return { mode: 'cors', ...config } as RequestInit;
}
