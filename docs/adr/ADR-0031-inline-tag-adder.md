# ADR-0031：标签新增改为 Inline（标题行右侧）

## 状态

已采纳

## 背景

ADR-0030 已将系统 `prompt()` 替换为应用内 `ui.prompt/ui.form`，但标签新增仍需要弹窗交互。标签操作频率高，弹窗会增加操作成本。

## 决策

1. TripDetail / PoiDetail 的“新增标签”改为标题行右侧 inline 输入框：
   - Enter 提交，Esc 取消
   - 空值禁用提交
2. 输入做 normalize：
   - 去掉前导 `#`
   - trim
3. 若与既有标签重复：toast 提示并保持编辑态。
4. 花费新增保持使用 `ui.form` 不变（涉及多字段，inline 成本更高）。

## 相关实现

- 设计：[inline-tag-adder-design.md](file:///workspace/docs/superpowers/specs/2026-04-29-inline-tag-adder-design.md)

