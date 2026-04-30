# 设计：Retention 参数可配置 + 异常文件类型安全跳过

## 背景

`cleanupRestoreArtifacts()` 已具备基础的分组 retention（failed/dbBak/assetsBak）与 symlink 跳过，并且通过测试覆盖了 `.bak-*`/`.failed*` 的核心行为。但要达成“专业成熟本地项目”标准，需要：

- 让 TTL/Top-K 可通过环境变量覆盖（默认不变），便于：
  - 小磁盘设备更激进清理
  - 备份密集用户保留更多历史
  - 测试可控（不依赖真实 7d/30d）
- 对异常文件类型（socket/pipe/device 等）做防御式跳过，避免：
  - 删除非预期对象
  - 触发系统级副作用

## 目标

- 默认行为保持 ADR-0038 不变
- 环境变量覆盖能被测试验证
- 清理函数仅对“预期类型”的目标执行 rm

## 方案

### 1) 环境变量覆盖

在 `cleanupRestoreArtifacts()` 执行时读取配置（每次调用读取，便于测试/动态覆盖）：

- failed：
  - `TRAVEL_MAP_RETENTION_FAILED_TTL_MS`（默认 `7d`）
  - `TRAVEL_MAP_RETENTION_FAILED_TOPK`（默认 `3`）
- dbBak：
  - `TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS`（默认 `30d`）
  - `TRAVEL_MAP_RETENTION_DB_BAK_TOPK`（默认 `5`）
- assetsBak：
  - `TRAVEL_MAP_RETENTION_ASSETS_BAK_TTL_MS`（默认 `30d`）
  - `TRAVEL_MAP_RETENTION_ASSETS_BAK_TOPK`（默认 `3`）

解析规则：

- TTL：必须是非负有限数，否则回退默认值
- Top-K：必须是整数且 >=0，否则回退默认值

### 2) 异常文件类型安全跳过

通过 `lstat` 做类型判定：

- symlink：跳过（保持现有）
- `failed` / `assetsBak`：必须 `stat.isDirectory()` 才纳入清理候选，否则跳过
- `dbBak`：必须 `stat.isFile()` 才纳入清理候选，否则跳过
- 其他类型（socket、fifo、character device、block device）：一律跳过

### 3) 测试计划

- env 覆盖：
  - 设置 `TRAVEL_MAP_RETENTION_DB_BAK_TOPK=0` 与 `TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS=1`，验证全部旧 dbBak 会被删除
- 异常文件类型：
  - 用 `net.createServer().listen(unixSocketPath)` 在 `userData` 下创建 unix socket，命名为 `travel-map.sqlite.bak-999`，验证 cleanup 会跳过且文件仍存在

## 变更范围

- 修改：`packages/app/src/main/backupRestore.ts`
- 修改：`packages/app/test/restoreArtifactsCleanup.test.ts`
- 新增 ADR：ADR-0039

