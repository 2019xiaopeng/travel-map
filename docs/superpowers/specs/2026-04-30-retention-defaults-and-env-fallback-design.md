# 设计：Retention 默认值集中 + env 无效值回退默认

## 背景

Retention 清理已支持环境变量覆盖（ADR-0039），但需要进一步成熟化：

- 默认值应集中，避免散落导致的不一致与维护成本
- env 无效输入必须稳定回退默认值，并且需要回归测试保护

## 目标

- 默认行为不变
- env 输入无效时回退默认
- 代码结构更清晰：配置与逻辑分离

## 方案

### 1) 默认值集中为常量

在 `backupRestore.ts` 中新增：

- `DEFAULT_RETENTION = { failed: {ttlMs, topK, envNames}, dbBak: {...}, assetsBak: {...} }`

所有默认值只在此处出现一次。

### 2) env 解析与回退

- `envMs(name, fallback)`：`Number(v)` 为有限数且 `>=0` 才接受
- `envInt(name, fallback)`：必须为整数且 `>=0` 才接受
- 对空字符串、NaN、负数、小数：统一回退 fallback

### 3) 测试计划

在 `restoreArtifactsCleanup.test.ts` 添加：

- `TRAVEL_MAP_RETENTION_DB_BAK_TOPK="x"` → 回退默认（不会删 TTL 内数据）
- `TRAVEL_MAP_RETENTION_DB_BAK_TOPK="-1"` → 回退默认
- `TRAVEL_MAP_RETENTION_DB_BAK_TOPK="1.5"` → 回退默认
- `TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS="-1"` → 回退默认

通过构造 “超过 Top-K 但仍在 TTL 内” 的 dbBak，确保无效 env 不会把 topK 变成 0 从而误删。

## 变更范围

- 修改：`packages/app/src/main/backupRestore.ts`
- 修改：`packages/app/test/restoreArtifactsCleanup.test.ts`
- ADR：ADR-0040

