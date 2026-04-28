# ADR-0016：支持粘贴图片（无文件路径）入库的 bytes IPC

## 状态

已采纳

## 背景

文档对正文图片链路的要求是“粘贴/拖拽即上传并插入 local:// 链接”。在 Electron 渲染进程中，部分来源的图片（例如剪贴板粘贴）`File` 对象可能没有本地文件路径（`file.path` 为空）。

此前实现依赖 `file.path` 调用 `file:saveAsset(sourcePath)`，当 `path` 缺失时只能退化为插入 `blob:` URL（`URL.createObjectURL`），这会导致：

- Markdown 内容不可迁移/不可离线复现（blob URL 不是可持久化引用）
- 资源不会进入 Asset 生命周期管理（无法回收/无法 fallback remote_url）

## 决策

1. 新增 IPC：`file:saveAssetBytes`
   - 允许渲染层传入 `ArrayBuffer` + `originalFilename` + `mime` + `destRelativeDir`
   - 主进程负责写入 `userData/assets/...` 并落库 Asset 记录
2. 去重策略与原有 `file:saveAsset` 一致：按 sha256 去重，冲突时复用已有 Asset 并删除新写入文件。
3. 渲染层正文上传钩子优先使用：
   - 有 `file.path` → `file:saveAsset`
   - 无 `file.path` → `file:saveAssetBytes(file.arrayBuffer())`
4. 将核心逻辑抽成可测试的纯函数，并提供 Node test 回归覆盖去重与路径生成。

## 相关实现

- 核心逻辑：[saveAssetBytesCore.ts](file:///workspace/packages/app/src/main/saveAssetBytesCore.ts)
- IPC 暴露：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)、[preload/index.ts](file:///workspace/packages/app/src/preload/index.ts)
- 渲染层集成：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)
- 回归测试：[saveAssetBytesCore.test.ts](file:///workspace/packages/app/test/saveAssetBytesCore.test.ts)

