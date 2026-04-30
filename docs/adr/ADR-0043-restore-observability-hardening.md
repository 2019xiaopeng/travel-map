# ADR-0043：Restore 可观测性闭环补强（retention 快照、meta 脱敏、reveal 路径策略、pending symlink）

## 状态

已采纳

## 背景

在 ADR-0041/0042 的基础上做代码复盘，发现影响“闭环可用性/安全性”的几个缺口：

- 诊断包缺少 retention 最终配置快照（与 ADR-0041 设计不一致）
- 日志事件的 `meta` 允许任意结构，存在把绝对路径/敏感信息漏写入的风险
- `diagnostics:reveal` 需要与日志/诊断的 symlink 安全策略一致，避免通过 symlink 根目录打开到 userData 外
- `restore-pending.json` 若被替换为 symlink，导入阶段可能越界写盘

## 决策

1. **诊断包必须包含 retention 配置快照**
   - 在导出的 diagnostic JSON 中增加 `retention` 字段，按 env 覆盖后的最终值输出（仅数值配置，不含路径）。
2. **meta 深度脱敏**
   - 对 `logRestoreEvent(meta)` 做深度遍历清洗：任意包含 `/` 或 `\\` 的字符串统一替换为 `<redacted>`。
3. **reveal 路径策略纯函数化并强化**
   - 提供可单测的 `resolveDiagnosticsRevealAbsolutePath`，仅允许 `logs/` 与 `diagnostics/` 下的相对路径；拒绝 traversal/绝对路径；拒绝 symlink 根目录与 symlink 目标。
4. **pending 文件 symlink 防护**
   - `stageRestoreFromZip` 写入 `restore-pending.json` 前，如果目标是 symlink 则拒绝并报错 `unsafe pending path`。
   - `applyPendingRestoreIfPresent` 发现 pending/tx 为 symlink 时会先清理再返回 false，避免循环或越界读取。

## 相关实现

- [restoreDiagnostics.ts](file:///workspace/packages/app/src/main/diagnostics/restoreDiagnostics.ts)
- [diagnosticsPaths.ts](file:///workspace/packages/app/src/main/diagnostics/diagnosticsPaths.ts)
- [backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)

