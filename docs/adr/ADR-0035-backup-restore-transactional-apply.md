# ADR-0035：备份恢复 apply 事务化（崩溃可自愈 / 强幂等）

## 状态

已采纳

## 背景

备份恢复采用“导入 staging → 写 pending → 重启 apply”的模式。尽管已对 pending 校验、manifest 严格解析、zip 资源上限、apply 回滚做了多轮加固，仍存在崩溃/断电时的半状态风险（db 与 assets 可能不一致）。

## 决策

1. 引入 `restore-transaction.json` 作为 apply 的事务文件（状态机 + 恢复锚点）。
2. apply 启动优先级：
   - 若存在 transaction：进入恢复模式（继续/回滚，强幂等）
   - 否则若存在 pending：创建 transaction 后进入正常 apply
3. 采用分阶段 `phase` 推进，每个阶段完成后原子落盘 transaction，确保崩溃后可定位并恢复。
4. 失败策略：
   - 尽力回滚到原 current（用 bak）
   - 清理 pending/transaction 避免循环卡死
   - staging 重命名为 `.failed` 保留现场

## 相关文档

- 设计：[2026-04-29-backup-restore-transaction-design.md](file:///workspace/docs/superpowers/specs/2026-04-29-backup-restore-transaction-design.md)

