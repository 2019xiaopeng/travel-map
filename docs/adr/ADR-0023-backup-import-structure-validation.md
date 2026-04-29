# ADR-0023：备份导入需要结构校验与失败清理（避免半导入状态）

## 状态

已采纳

## 背景

导入 zip 的 staging 流程如果不做结构校验，会出现两类危险的“半成品”状态：

- 备份包缺 `db.sqlite` 仍写入 `restore-pending.json`，导致下次启动进入不可恢复的替换流程
- staging 失败后不清理目录，堆积临时文件并让后续排查困难

## 决策

1. staging 完成后必须校验 `db.sqlite` 存在（映射为 `travel-map.sqlite`）：
   - 缺失则直接失败并清理 staging，不写入 `restore-pending.json`
2. `assets/` 允许为空，但 staging 目录必须存在（创建空目录），保证启动替换逻辑一致。
3. 增加回归测试覆盖“缺 db.sqlite 时必须失败且不写 pending”。

## 相关实现

- 校验与清理：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 回归测试：[backupRestoreValidation.test.ts](file:///workspace/packages/app/test/backupRestoreValidation.test.ts)

