# ADR-0040：Retention 默认值集中管理与 env 回退规则

## 状态

已采纳

## 背景

Retention 清理涉及多组参数（failed/dbBak/assetsBak 的 TTL/Top-K），并支持环境变量覆盖（ADR-0039）。如果默认值散落在实现逻辑中，后续调整容易出现：

- 默认值不一致或局部忘改
- 测试难以覆盖与维护（需要到处匹配魔法数字）

此外，env 输入存在不可靠性（空值/NaN/负数/非整数），必须有统一的“回退默认值”规则，以保证行为可预测。

## 决策

1. **集中默认值**
   - 在 `backupRestore.ts` 内以单一常量对象维护三组 retention 默认值（TTL/Top-K）
   - 业务逻辑只引用该对象，不直接硬编码数字
2. **统一 env 解析与回退规则**
   - TTL（ms）：必须是有限数且 `>=0`，否则回退默认值
   - Top-K：必须是整数且 `>=0`，否则回退默认值
3. **回归测试**
   - 增加测试覆盖：NaN/负数/小数/空字符串等输入都应回退默认值

## 相关实现

- 清理逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 清理测试：[restoreArtifactsCleanup.test.ts](file:///workspace/packages/app/test/restoreArtifactsCleanup.test.ts)

