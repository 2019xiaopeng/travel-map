# ADR-0034：备份恢复更强硬化（单文件上限、可疑路径拒绝、apply 原子性/回滚）

## 状态

已采纳

## 背景

在 ADR-0032 基础上继续 review，仍发现一些“极端情况下会半交换/资源异常”的风险点：

- 仅限制总 uncompressed 大小不足以防止单个超大 entry（db/asset）导致磁盘/内存压力。
- 对可疑 `assets/..` 路径如果只是跳过，可能让攻击性 zip 继续导入并产生不可预期结果。
- `applyPendingRestoreIfPresent` 一旦在交换过程中抛错，可能留下 `.bak`、`assets.bak`、或 staging 残留；并且 bak 名称存在低概率冲突。

## 决策

1. 解压阶段新增单文件 uncompressed 上限（支持环境变量覆盖）：
   - `db.sqlite`：`TRAVEL_MAP_MAX_DB_SQLITE_UNCOMPRESSED_BYTES`（默认 1GiB）
   - `manifest.json`：`TRAVEL_MAP_MAX_MANIFEST_UNCOMPRESSED_BYTES`（默认 5MiB）
   - `assets/*`：`TRAVEL_MAP_MAX_ASSET_UNCOMPRESSED_BYTES`（默认 200MiB）
2. 对 `assets/*` 发生路径逃逸（safeJoin 失败）直接拒绝导入（报错 `invalid asset path`）。
3. apply 阶段增强鲁棒性：
   - `.bak` 路径自动避让冲突（追加 `-N`）
   - 交换过程中失败会尽力回滚到原状态
   - 失败时清理 pending 并将 staging 目录重命名为 `.failed` 保留现场

## 相关实现

- 逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 测试：[applyRestoreHardening.test.ts](file:///workspace/packages/app/test/applyRestoreHardening.test.ts)、[backupRestoreHardening.test.ts](file:///workspace/packages/app/test/backupRestoreHardening.test.ts)

