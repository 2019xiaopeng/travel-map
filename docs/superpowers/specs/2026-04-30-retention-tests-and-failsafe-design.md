# 设计：补齐 retention 与 fail-safe 的回归测试（bak TTL/Top-K + symlink + failed 现场保留）

## 背景

当前已引入 `cleanupRestoreArtifacts()` 与 tx 路径强校验，但仍存在“成熟本地项目”需要补齐的验证与一致性问题：

- `cleanupRestoreArtifacts()` 目前对 `failed/dbBak/assetsBak` 使用同一套 TTL/Top-K，而 ADR-0038 规定为分组策略（failed 7d/3；dbBak 30d/5；assetsBak 30d/3）。
- 目前测试仅覆盖 `.failed` Top-K，没有覆盖 `.bak-*` 的 TTL+Top-K 行为，也没有覆盖 symlink 防护。
- tx 校验失败时应保留 staging 为 `.failed` 现场以便排障（ADR-0037/0038），需要回归测试保证不回退。

## 目标

- 将 `cleanupRestoreArtifacts()` 的行为对齐 ADR-0038（分组 TTL/Top-K），并补齐对应测试。
- 增加 symlink 防护测试，保证不会误删 symlink 及其外部目标。
- 增加 tx 校验失败时 staging `.failed` 现场保留的测试，确保 fail-safe 可回归。

## 设计要点

### 1) cleanupRestoreArtifacts 分组策略

- failed：`TTL_failed=7d`，`K_failed=3`
- dbBak：`TTL_bak=30d`，`K_dbBak=5`
- assetsBak：`TTL_bak=30d`，`K_assetsBak=3`

删除条件：`age > TTL && index >= K`（时间+数量双保险）。

### 2) 新增测试用例

- `cleanupRestoreArtifacts`：
  - `.bak`：超过 TTL 且超出 Top-K 的会被删除；未超过 TTL 的不会被删
  - `assets.bak-*`：同上
  - symlink：匹配到的 symlink 必须跳过，且外部目标不受影响
- tx 校验失败：
  - tx paths 越界 / tx phase 非法时，如果 stagingPath 合法且存在，则 staging 会被重命名为 `*.failed*`

### 3) 变更范围

- 修改：`packages/app/src/main/backupRestore.ts`
- 修改/新增：`packages/app/test/restoreArtifactsCleanup.test.ts`
- 修改：`packages/app/test/backupRestoreTransactionalApply.test.ts`

