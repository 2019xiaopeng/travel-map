# ADR-0039：Retention 可配置性与异常文件类型安全策略

## 状态

已采纳

## 背景

为避免 restore 相关产物（`.bak-*` / `*.failed*`）长期累积导致磁盘膨胀，项目引入了 `cleanupRestoreArtifacts()` 并采用 “TTL + Top-K” 的保守清理策略（ADR-0038）。继续打磨到成熟本地项目级别，需要补齐两点：

1. **策略可配置**：不同用户的备份规模与磁盘容量不同，需要可在不改代码的情况下调参，并便于测试覆盖边界。
2. **异常文件类型安全**：清理过程必须拒绝/跳过非普通文件或目录（例如 unix socket、pipe、device 等），避免误删或触发未预期的系统行为。

## 决策

1. **环境变量覆盖 retention 参数（默认值保持不变）**
   - `TRAVEL_MAP_RETENTION_FAILED_TTL_MS`（默认 7 天）
   - `TRAVEL_MAP_RETENTION_FAILED_TOPK`（默认 3）
   - `TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS`（默认 30 天）
   - `TRAVEL_MAP_RETENTION_DB_BAK_TOPK`（默认 5）
   - `TRAVEL_MAP_RETENTION_ASSETS_BAK_TTL_MS`（默认 30 天）
   - `TRAVEL_MAP_RETENTION_ASSETS_BAK_TOPK`（默认 3）
2. **异常文件类型一律跳过（含测试）**
   - `.failed*` 与 `assets.bak-*`：必须是目录，否则跳过
   - `travel-map.sqlite.bak-*`：必须是普通文件，否则跳过
   - symlink 一律跳过
3. **清理仍不阻塞启动**
   - 单项失败吞掉并继续

## 相关实现

- 清理逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 清理测试：[restoreArtifactsCleanup.test.ts](file:///workspace/packages/app/test/restoreArtifactsCleanup.test.ts)

