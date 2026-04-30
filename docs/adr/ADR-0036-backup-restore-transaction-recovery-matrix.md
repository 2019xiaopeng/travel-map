# ADR-0036：Restore Transaction 恢复矩阵（phase × 磁盘状态 → 行为）

## 状态

已采纳

## 背景

ADR-0035 引入了 `restore-transaction.json` 以实现备份恢复 apply 的崩溃自愈与强幂等。为了把恢复行为“产品化”（可解释、可回归、可维护），需要将每个 phase 在不同磁盘状态下的行为明确下来，避免：

- db 与 assets 跨批次不一致（最严重）
- transaction/pending 卡死导致每次启动重复进入恢复
- 不一致状态被静默当成成功推进（产生隐蔽数据损坏）

## 核心原则

1. **一致性优先**：db 与 assets 必须来自同一批次 staging；不允许 “db 已换新但 assets 仍是旧的”。
2. **强幂等**：重复执行 apply/恢复不会导致额外破坏，最终收敛到 success 或 fail-safe。
3. **失败可回滚**：出现不可修复状态时尽力恢复到旧 current（使用 `.bak`），并清理 transaction/pending，避免卡死循环。
4. **保留现场**：失败时将 staging 重命名为 `.failed`（若可行），方便排查，同时不会继续参与恢复。

## 文件与路径

- `restore-pending.json`：导入阶段写入的待恢复标记（包含 `stagingPath`）
- `restore-transaction.json`：apply 事务文件（包含 `phase` 与关键路径）
- `stagingPath/travel-map.sqlite`：staged db
- `stagingPath/assets/`：staged assets
- `travel-map.sqlite.bak-*`：旧 db 备份
- `assets.bak-*`：旧 assets 备份

## 恢复矩阵（简化版）

说明：
- `CDB` = currentDb 是否存在
- `CAS` = currentAssets 是否存在
- `SDB` = stagedDb 是否存在
- `SAS` = stagedAssets 是否存在
- `DBAK` / `ABAK` = bak 是否存在

### phase=init

- **预期状态**：CDB/CAS 存在；SDB/SAS 存在（导入完成）；bak 未创建或不存在
- **动作**：将 CDB/CAS 移到 DBAK/ABAK（若已存在则避让 unique），写回 `phase=backed_up`
- **异常**：若 pending/staging 不完整则 fail-safe（删除 pending，清理 staging，删除 tx）

### phase=backed_up

- **预期状态**：CDB/CAS 可能已不存在（已备份）；SDB 必须存在；DBAK/ABAK 可能存在
- **动作**：
  - 若 SDB 存在：确保最终 `SDB -> CDB`（若 CDB 意外存在则先移走到 bak unique 再覆盖）
  - 成功后写回 `phase=db_swapped`
- **不可修复状态**：
  - `!CDB && !SDB && DBAK`：视为 staging 丢失，触发失败回滚（恢复 DBAK→CDB）并清理 tx/pending

### phase=db_swapped

- **预期状态**：CDB 是新 db；SAS 必须存在（尚未 swap）
- **动作**：
  - 若 SAS 存在：确保最终 `SAS -> CAS`（若 CAS 意外存在则先移走到 abak unique 再覆盖）
  - 成功后写回 `phase=assets_swapped`
- **不可修复状态**：
  - `!CAS && !SAS && ABAK`：视为 staged assets 丢失，触发失败回滚（恢复 ABAK→CAS）并清理 tx/pending

### phase=assets_swapped

- **预期状态**：CDB/CAS 均为新；pending 可能仍存在；staging 可能仍存在
- **动作**：删除 pending（忽略 ENOENT），写回 `phase=committed`

### phase=committed

- **预期状态**：逻辑已完成；需要清理 staging
- **动作**：删除 staging（忽略错误），写回 `phase=cleaned`

### phase=cleaned

- **预期状态**：清理已完成
- **动作**：删除 tx，返回 success

## 落地实现

- 主逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)

