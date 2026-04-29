# ADR-0029：用应用内 Dialog/Toast 替换系统 alert/confirm

## 状态

已采纳

## 背景

renderer 侧大量使用系统 `alert/confirm`：

- 内容长度受限，无法友好展示备份导入/导出 warnings（可滚动/可复制）
- 视觉风格与应用不一致
- 系统弹窗阻断交互，且难以统一管理

## 决策

1. 实现基于 `zustand` 的全局 overlay：
   - toast：用于成功/提示类消息
   - confirm/alert modal：用于危险操作确认与长文本提示（支持滚动与复制）
2. 不引入新的 UI 组件库，使用现有 Tailwind 风格实现。
3. 全量替换 renderer 内现存的系统 `alert/confirm` 调用，统一入口为 `ui.toast/ui.confirm/ui.alert`。

## 相关实现

- 设计文档：[2026-04-29-in-app-dialog-toast-design.md](file:///workspace/docs/superpowers/specs/2026-04-29-in-app-dialog-toast-design.md)

