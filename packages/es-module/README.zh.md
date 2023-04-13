# Garfish-es-module插件
- 用于加载esm

## 原理
- 注册beforeload钩子，在钩子上重写了appInstance.runCode方法。该方法主要做了以下两件事：
  - 1. 注册runtime.options.execCode方法
  - 2. 将esm内容push到appInstance.esmQueue中