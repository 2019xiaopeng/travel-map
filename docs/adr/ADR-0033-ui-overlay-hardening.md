# ADR-0033：UI Overlay 加固（Dialog 退出手势、Toast 定时器清理、标签输入约束）

## 状态

已采纳

## 背景

ADR-0029/0030/0031 引入了应用内 toast/dialog 与 inline 标签输入。实现落地后，仍有一些“容易卡住/数据变脏”的边界：

- Dialog 仅能点击按钮关闭，不支持 Escape/点击遮罩关闭，交互容错差。
- Toast 定时器未在组件卸载时清理，可能遗留悬挂 timeout。
- 标签输入缺乏长度/空白/控制字符约束，容易产生“看起来一样但实际不同”的脏数据。
- 新 dialog 打开时覆盖旧 dialog 的流程缺乏兜底清理。

## 决策

1. DialogHost 增强退出手势：
   - Escape：优先走 cancel（若存在），否则关闭 alert
   - 点击遮罩：等价于 cancel（若存在）
2. ToastViewport 在卸载时清理定时器，避免悬挂任务。
3. 标签输入增加约束并在 UI 侧给出明确提示：
   - 允许前导 `#`，normalize 后比较重复
   - 禁止空白字符
   - 长度上限 32
   - 禁止控制字符
4. 新 dialog 打开时取消旧 dialog，并在异常情况下强制清理 store。

## 相关实现

- Dialog/Toast：[DialogHost.tsx](file:///workspace/packages/renderer/src/ui/DialogHost.tsx)、[ToastViewport.tsx](file:///workspace/packages/renderer/src/ui/ToastViewport.tsx)、[ui.ts](file:///workspace/packages/renderer/src/services/ui.ts)
- 标签输入：[tags.ts](file:///workspace/packages/renderer/src/utils/tags.ts)、[InlineTagAdder.tsx](file:///workspace/packages/renderer/src/components/InlineTagAdder.tsx)
- 测试：[ui.test.ts](file:///workspace/packages/renderer/test/ui.test.ts)、[tags.test.ts](file:///workspace/packages/renderer/test/tags.test.ts)

