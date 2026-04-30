# ADR-0041：Restore 可观测性（结构化日志 + 诊断包导出）

## 状态

已采纳

## 背景

restore 链路涉及多阶段状态机（pending/transaction/retention），即使安全性与幂等性不断增强，仍需要可观测性来降低排障成本、提升可维护性。

## 决策

1. 采用本地结构化日志（JSONL）记录 restore/apply/cleanup 的关键事件：
   - 仅记录相对 `userDataPath` 路径，不记录绝对路径与用户数据内容
   - 按文件大小轮转，限制磁盘占用
2. 提供诊断包导出（JSON）：
   - 自动：在 restore/apply/cleanup 失败时尽力生成
   - 手动：UI 一键导出（IPC）
3. 诊断包包含：
   - 版本与运行环境信息
   - pending/transaction 状态白名单字段
   - retention 最终配置快照
   - 最近 N 条事件（内存 ring buffer）

## 相关文档

- 设计：[2026-04-30-restore-observability-design.md](file:///workspace/docs/superpowers/specs/2026-04-30-restore-observability-design.md)

