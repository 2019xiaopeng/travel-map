# ADR-0032：备份恢复流程加固（pending 校验、manifest 严格解析、zip 资源上限）

## 状态

已采纳

## 背景

备份导入采用“先解压到 staging → 写入 restore-pending → 重启后 apply”模式。此前存在以下脆弱点：

- `restore-pending.json` 若被写坏/篡改，可能指向 `userData` 之外目录，导致启动时把任意目录当作 staging 来交换覆盖。
- `manifest.json` 若存在但损坏，导入会静默跳过 db/assets 校验，属于不安全降级。
- 解压缺乏资源上限（entry 数/累计大小），可能被异常 zip 拖垮（磁盘/CPU）。

## 决策

1. `applyPendingRestoreIfPresent` 增加 pending 校验与自愈：
   - `stagingPath` 必须位于 `userDataPath` 下且目录名以 `restore-staging-` 开头
   - staging 缺少 `travel-map.sqlite` 或 `assets/` 时视为无效 pending
   - pending 无效时清理 `restore-pending.json`，并尽可能清理 staging 目录避免反复失败
2. `manifest.json` 严格解析：
   - 若 zip 中存在 `manifest.json` 但无法 JSON.parse：拒绝导入
   - 若 manifest 缺失：兼容旧备份（跳过基于 manifest 的额外校验）
3. 解压阶段增加资源上限：
   - 对“有效条目”（db/manifest/assets）计数与累计 uncompressed size
   - 超限直接拒绝导入并清理 staging
   - 上限可通过环境变量覆盖以便测试与调试

## 相关实现

- 逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 回归测试：[backupRestoreHardening.test.ts](file:///workspace/packages/app/test/backupRestoreHardening.test.ts)

