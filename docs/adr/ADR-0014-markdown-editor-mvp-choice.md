# ADR-0014：Markdown 编辑器阶段性选型以实现闭环优先

## 状态

已采纳

## 背景

文档 [08-Markdown编辑器选型](file:///workspace/docs/travel-map-docs/08-Markdown编辑器选型.md) 曾写明“已确认使用 Milkdown”。但当前仓库代码的实际实现使用的是 `react-markdown-editor-lite`，并已打通：

- Markdown 文本存储
- 图片上传钩子对接本地落盘（`file:saveAsset`）
- 插入 `local://assets/...` 链接并可在 Electron 中渲染

为避免“文档与实现分裂”与“半成品迁移”，需要明确阶段性决策。

## 决策

1. MVP 阶段以闭环优先：正文编辑器使用 `react-markdown-editor-lite`，优先保证写作体验与资源链路（上传/离线/回收）稳定。
2. 文档同步以实现为准：更新选型文档，明确当前实现与后续演进路径。
3. 迁移到 Milkdown 作为后续演进：当需要更强扩展能力（wiki-link/callout/更多自定义块）再评估迁移，并通过 ADR 记录迁移方案与数据兼容策略。

## 相关实现

- 正文编辑与图片上传钩子：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)
- 资源落盘与 local://：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)、[index.ts](file:///workspace/packages/app/src/main/index.ts)

