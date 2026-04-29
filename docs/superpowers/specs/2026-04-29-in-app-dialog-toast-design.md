# 设计：用应用内 Dialog/Toast 替换系统 alert/confirm

## 背景与目标

当前 renderer 侧大量使用系统 `alert/confirm`：

- 可展示内容长度受限，备份导入/导出 warnings 很长时体验差
- 不可滚动、不可复制详情，用户难以定位问题
- 风格与应用 UI 不一致

目标：

1. 用应用内 UI 替换系统 `alert/confirm`
2. 成功/提示类信息使用 toast（自动消失，可关闭）
3. 危险操作使用 confirm modal（可展示长详情、可复制）
4. 不引入新的 UI 组件库（保持依赖最小）

## 范围

- 本轮范围：renderer 内所有 `alert/confirm` 全部替换
  - `CityHome` 备份导入/导出
  - `TripDetail` / `PoiDetail` 删除、上传提示等
  - `PoiAddModal` 等

## 方案概述（选型）

选择“自研轻量全局 Overlay（zustand 驱动）”：

- `ui.toast.*`：队列式 toast，右下角堆叠，自动消失
- `ui.confirm(...)`：Promise 风格确认弹窗
- `ui.alert(...)`：Promise 风格提示弹窗（用于替代 alert，必要时使用）

原因：

- 仓库目前未引入 Radix/shadcn 等 UI 库
- 依赖最小、可控、与当前 Tailwind 风格一致

## 组件与状态

### Store（zustand）

- `toastStore`
  - `toasts: Array<{ id, kind, title?, message, details?, durationMs? }>`
  - `pushToast(...)` / `dismissToast(id)`
- `dialogStore`
  - `confirm: null | { id, title, message, details?, confirmText, cancelText, danger, resolve }`

### 常驻组件（挂载在 App 根部）

- `ToastViewport`
  - 渲染 toast 列表（最多 N 条）
  - 支持自动消失与手动关闭
- `ConfirmDialogHost`
  - 渲染 confirm/alert
  - details 区域可滚动
  - 提供“复制详情”按钮（复制 message + details）

## API 设计

- `ui.toast.success(message, options?)`
- `ui.toast.error(message, options?)`
- `ui.toast.info(message, options?)`
- `ui.confirm({ title, message, details?, confirmText?, cancelText?, danger? }) -> Promise<boolean>`
- `ui.alert({ title, message, details? }) -> Promise<void>`

## 替换规则

- 成功/完成提示：`ui.toast.success`
- 一般提示：`ui.toast.info`
- 失败/异常：优先 `ui.toast.error`；需要长详情时用 `ui.alert`
- 需要用户确认的危险操作：`ui.confirm`

## 错误处理与可用性

- 防止 toast 过多：限制最多 N 条，超出丢弃最旧或合并（实现期确定）
- Confirm 防重入：同一时间只允许一个 confirm（后发覆盖或拒绝）
- 复制详情：失败时不影响主流程

## 测试

- Renderer 单测：
  - toast push/dismiss 行为
  - confirm promise resolve 行为（确认/取消）
  - grouped warnings 文案不变（已有）

