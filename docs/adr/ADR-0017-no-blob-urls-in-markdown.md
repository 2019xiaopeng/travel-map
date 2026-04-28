# ADR-0017：禁止在 Markdown 正文中落地 blob: URL（失败时回退为空链接）

## 状态

已采纳

## 背景

正文内容的长期可迁移性要求“正文中存的图片链接必须是可持久化的引用”（例如 `local://assets/...` 或远端 URL）。`blob:` URL 仅对当前会话有效：

- 重启应用后失效
- 无法打包到 zip 备份
- 无法进入 Asset 引用计数与回收体系

此前在图片上传失败或 `file.path` 缺失时，渲染层会使用 `URL.createObjectURL(file)` 返回 `blob:` 链接并写入 Markdown，属于隐性数据污染。

## 决策

1. 图片上传钩子只返回可持久化链接：
   - 成功：返回 `local://assets/...`
   - 失败：返回空字符串（最终生成 `![name]()`），并提示用户上传失败
2. 通过新增的 bytes IPC（ADR-0016）覆盖“粘贴图片无路径”的场景，避免 fallback 到 blob。

## 相关实现

- 图片上传钩子：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)
- bytes 入库：[ADR-0016](file:///workspace/docs/adr/ADR-0016-paste-image-bytes-ipc.md)

