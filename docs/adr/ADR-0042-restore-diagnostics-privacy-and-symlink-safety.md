# ADR-0042：Restore 诊断与日志的隐私脱敏与 symlink 安全

## 状态

已采纳

## 背景

ADR-0041 引入了 restore 结构化日志与诊断包。但在代码复盘中发现两个“偷懒/隐患”点需要补齐：

1. **错误信息可能泄露绝对路径**  
   Node/Electron 的文件系统错误 message 往往包含绝对路径。若直接写入日志/诊断，会违反“仅允许相对路径”的隐私边界。
2. **logs/diagnostics 目录可能被替换为 symlink**  
   若 `<userData>/logs` 或 `<userData>/diagnostics` 被 symlink 指向外部目录，日志写入/诊断导出可能越界写盘，造成隐私与安全问题。

## 决策

1. **message 脱敏**  
   - 若 message 可能包含路径（出现 `/` 或 `\\`），统一写入 `<redacted>`，避免任何形式的绝对路径泄露。
2. **目录与文件写入的 symlink 防护**
   - 当 `<userData>/logs` 为 symlink 时，拒绝写入 `restore.log`（静默跳过，不阻塞功能）。
   - 当 `<userData>/diagnostics` 为 symlink 时，拒绝生成诊断包并返回 `unsafe_path`。
3. **回归测试**
   - 增加单测覆盖：message redaction、logs symlink 不写、diagnostics symlink 导出失败。

## 相关实现

- [restoreDiagnostics.ts](file:///workspace/packages/app/src/main/diagnostics/restoreDiagnostics.ts)
- [restoreDiagnostics.test.ts](file:///workspace/packages/app/test/restoreDiagnostics.test.ts)

