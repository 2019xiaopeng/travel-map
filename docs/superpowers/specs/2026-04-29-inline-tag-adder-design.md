## 设计：标签新增改为 Inline（替代弹窗 prompt）

### 背景

虽然系统 `prompt()` 已替换为应用内 `ui.prompt()`，但标签新增仍需要一次弹窗交互，频繁操作时效率偏低。

### 目标

- TripDetail / PoiDetail 的“新增标签”改为标题行右侧 inline 输入
- 花费新增保持现状（仍用 `ui.form`）
- 行为可测试（用纯函数覆盖关键逻辑）

### 交互

- 默认显示 “+ 添加”
- 点击后进入编辑态：
  - 输入框（自动 focus）
  - “添加 / 取消”
- 键盘：
  - Enter 提交
  - Escape 取消

### 输入规范

- `trim()` 为空：禁用“添加”
- 若输入以 `#` 开头：自动去掉 `#`
- 若与已有标签重复（normalize 后比较）：toast 提示“标签已存在”，保持编辑态

### 实现方案

- 新增纯函数 `normalizeTagInput(input: string): string`
  - 去掉前导 `#`
  - trim
- 新增组件 `InlineTagAdder`
  - props: `onAdd(tag)`, `existingTags`, `placeholder`
  - 内部维护编辑态与输入值
- 替换 TripDetail/PoiDetail 的标签新增入口：
  - 移除 `ui.prompt` 调用，改为 inline 组件

### 测试

- 单测 `normalizeTagInput`
- 单测 “重复标签判定” 行为（用 normalize 后的集合比较）

