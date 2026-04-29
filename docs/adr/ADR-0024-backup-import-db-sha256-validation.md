# ADR-0024：导入备份时校验 db_sha256（防篡改/防传输损坏）

## 状态

已采纳

## 背景

导入备份 zip 会在重启后替换本地数据库文件 `travel-map.sqlite`。如果 zip 在传输过程中损坏、或被篡改，导入会带来不可预期的后果。

文档导出规范中已经包含 `manifest.db_sha256`，但如果导入不校验，这个字段等于“写了但没用”的半成品。

## 决策

1. 若 `manifest.json` 中存在非空 `db_sha256`：
   - staging 解压完成后对 `db.sqlite`（映射为 `travel-map.sqlite`）计算 sha256
   - 若与 manifest 不一致：拒绝导入（抛错 `db_sha256 mismatch`），清理 staging，不写 pending
2. 若 `db_sha256` 为空或缺失：跳过校验（兼容旧备份/手工备份）。
3. 添加回归测试覆盖 mismatch 拒绝导入。

## 相关实现

- 校验与清理：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 回归测试：[backupRestoreDbShaValidation.test.ts](file:///workspace/packages/app/test/backupRestoreDbShaValidation.test.ts)

