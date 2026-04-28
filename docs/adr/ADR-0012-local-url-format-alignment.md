# ADR-0012：local:// URL 结构与文档对齐（兼容双格式）

## 状态

已采纳

## 背景

文档 [10-local协议与资源加载](file:///workspace/docs/travel-map-docs/10-local协议与资源加载.md) 定义正文中存储的链接格式为：

`local://assets/cities/.../{assetId}__filename.ext`

此前实现中，`file:saveAsset` 返回与正文插入使用的是：

`local:///assets/cities/.../{assetId}__filename.ext`

这两种 URL 在 URL 解析层面差异很大：

- `local://assets/...` 的 `host` 为 `assets`，`pathname` 以 `/cities/...` 开头
- `local:///assets/...` 的 `host` 为空，`pathname` 以 `/assets/...` 开头

如果主进程仅使用 `url.pathname` 作为相对路径，会导致 `local://assets/...` 被解析为 `cities/...`，从而绕开 `assets/` 前缀，造成资源无法读取与 fallback 失效。

## 决策

1. 统一未来生成/写入的链接格式为文档约定的 `local://assets/...`：
   - `file:saveAsset` 返回 `localUrl` 改为 `local://assets/<relative under assets/>`
2. 主进程协议解析同时兼容两种格式：
   - 若 `url.host` 存在，则将 `host + pathname` 拼回相对路径（得到 `assets/...`）
   - 若 `url.host` 不存在，则沿用 `pathname`（支持历史 `local:///assets/...`）
3. 渲染层在渲染封面/正文图片时统一通过“localPath -> localUrl”转换，避免字符串拼接假设。

## 相关实现

- 协议解析兼容：[index.ts](file:///workspace/packages/app/src/main/index.ts)
- 生成 localUrl：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- 渲染层转换：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)、[CityHome.tsx](file:///workspace/packages/renderer/src/components/drawer/CityHome.tsx)

