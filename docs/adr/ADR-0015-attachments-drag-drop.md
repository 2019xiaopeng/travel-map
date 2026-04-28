# ADR-0015：附件 Tab 支持拖拽上传以闭环“导入工作流”

## 状态

已采纳

## 背景

文档 [06-存储与附件规范](file:///workspace/docs/travel-map-docs/06-存储与附件规范.md#L81-L98) 明确“导入”应支持：

- 文件选择器
- 拖拽到“附件 Tab”
- 正文编辑器粘贴/拖拽图片（由编辑器能力与上传钩子完成）

此前实现中，“附件 Tab”只支持点击按钮打开文件选择器，不支持拖拽导入，属于典型半成品体验：功能可用但高频路径缺失。

## 决策

1. 在 TripDetail 的“附件”Tab 容器上实现 drag/drop：
   - `dragenter/dragover` 高亮提示
   - `drop` 时读取 `DataTransfer.files` 并批量导入
2. 导入逻辑复用现有 `file:saveAsset` + `trip_attachment` Tag 关联：
   - 落盘目录使用 `assets/cities/.../trips/{tripId}/docs`
3. 为拖拽导入抽取纯函数 `extractFilePaths` 并添加 Node test（避免路径为空/重复文件等边缘情况）。

## 相关实现

- 附件拖拽上传：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)
- 文件路径提取与测试：[fileDrop.ts](file:///workspace/packages/renderer/src/utils/fileDrop.ts)、[fileDrop.test.ts](file:///workspace/packages/renderer/test/fileDrop.test.ts)

