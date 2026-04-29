# ADR-0030：用应用内 Prompt/Form Dialog 替换系统 prompt

## 状态

已采纳

## 背景

renderer 侧仍存在系统 `prompt()`：

- 样式与应用不一致
- 无法做输入校验与禁用确认按钮
- 无法统一管理交互与可测试性

## 决策

1. 在现有 `ui` 基础上扩展：
   - `ui.prompt(...) -> Promise<string | null>`：单输入框
   - `ui.form(...) -> Promise<Record<string, string> | null>`：多输入框表单
2. 复用全局 `DialogHost`，通过 `mode` 分支渲染 prompt/form。
3. 全量替换现存系统 `prompt()` 调用（标签新增、记一笔花费）。

## 相关实现

- API 与状态：[ui.ts](file:///workspace/packages/renderer/src/services/ui.ts)
- 渲染与校验：[DialogHost.tsx](file:///workspace/packages/renderer/src/ui/DialogHost.tsx)
- 替换点：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)、[PoiDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/PoiDetail.tsx)
- 测试：[ui.test.ts](file:///workspace/packages/renderer/test/ui.test.ts)

