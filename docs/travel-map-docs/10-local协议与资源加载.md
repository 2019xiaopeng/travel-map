# 10｜local 协议与资源加载

> 目标：在 Electron 中优雅地渲染 `local://` 资源，同时保证安全边界，并完成“本地上传后即可本地阅读”的闭环。

## 1. local:// 协议注册与解析（主进程）

在 Electron 主进程注册特权协议 `local://`，用于渲染层直接引用本地附件库资源。

### 1.1 解析逻辑

正文中存的是：

`local://assets/cities/330100-杭州/trips/.../{assetId}__IMG_0001.jpg`

主进程拦截后：
1) 去掉 `local://` 前缀，取 URL pathname  
2) 拼接应用数据目录：`path.join(APP_DATA_DIR, pathname)`（其中 pathname 以 `assets/` 开头）  
3) 用 `protocol.handle(...)` 或 `net.fetch(file://...)` 返回文件流响应

### 1.2 安全边界（LFI 防御，必须做）

必须防止渲染层通过路径穿越读取系统敏感文件，例如：
`local://../../../../etc/passwd`

主进程需要对路径做 normalize + 前缀校验：

```js
const normalized = path.normalize(realPath);
if (!normalized.startsWith(path.join(APP_DATA_DIR, 'assets'))) {
  return new Response('Access Denied', { status: 403 });
}
```

> 只允许访问 `APP_DATA_DIR/assets` 目录内的资源。

## 2. 本地资源加载（当前范围）

### 方案 A：UI 组件层处理（适合普通图片展示）

做一个 `<AssetImage />` 包装组件：
1) `src` 初始化为 `local://...`
2) 监听 `onError`
3) 若失败：显示本地资源缺失的错误态或占位图

优点：实现直观；缺点：正文里的 `<img>` 不是你的组件，难覆盖全。

### 方案 B：协议层统一读取（推荐用于正文）

因为正文会直接输出 `<img src="local://...">`，最优雅方式是主进程在协议层统一处理：
1) 拦截 `local://assets/...`
2) 检查本地文件是否存在  
3) 若存在：返回本地文件流  
4) 若不存在：返回明确错误态，由 UI 决定提示或引导重新导入

> 当前已确认：正文默认插入 `local://`；第一阶段不依赖 `remote_url` 兜底。若未来恢复上云能力，可在协议层扩展远端回退逻辑。
