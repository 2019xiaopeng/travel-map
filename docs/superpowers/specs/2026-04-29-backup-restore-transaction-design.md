# 设计：备份恢复 apply 事务化（崩溃可自愈 / 强幂等）

## 背景

当前备份导入采用：

- 导入时解压到 `restore-staging-*`
- 写入 `restore-pending.json`
- 用户确认重启后启动时 `applyPendingRestoreIfPresent()` 做 rename swap（db + assets）

虽已加固 pending 校验、manifest 严格解析、zip 资源上限与 apply 回滚，但仍存在“崩溃/断电时的半状态”风险：

- 在 db swap 与 assets swap 之间崩溃：可能出现 db 与 assets 不一致
- 在移动 current→bak 之后崩溃：用户数据暂时不在预期路径
- 多次启动重复执行 apply：需要严格幂等，避免不断制造 `.bak`/`.failed`

目标是把 apply 流程提升到“专业成熟本地项目”的可靠性标准：**可崩溃自愈 + 强幂等 + 不会卡死在 pending**。

## 目标

- 引入 restore apply “事务”概念，使流程具备：
  - 崩溃后可继续/可回滚（自愈）
  - 重复执行安全（幂等）
  - 不产生无限增长的残留目录
- 保持现有导入 staging 逻辑与 UI 行为不变（仅升级 apply 的可靠性）。

## 非目标

- 不改变导出 zip 结构与 manifest 格式
- 不引入增量备份/多版本回滚管理
- 不在本轮实现“资产校验分层策略”（作为下一轮硬化方向）

## 术语

- **pending**：导入已完成，等待重启 apply
- **transaction**：apply 正在执行或需要恢复的中间态

## 文件与状态

### 现有文件

- `restore-pending.json`
  - 由导入阶段写入
  - 内容：`{ stagingPath }`

### 新增文件

- `restore-transaction.json`
  - 仅在 apply 期间存在
  - 作为“状态机 + 恢复锚点”
  - 写入采用“写临时文件 + rename 覆盖”保证原子性

#### transaction 结构（建议）

```json
{
  "version": 1,
  "now": 1710000000000,
  "stagingPath": "/.../userData/restore-staging-...",
  "phase": "init",
  "paths": {
    "currentDb": "/.../userData/travel-map.sqlite",
    "currentAssets": "/.../userData/assets",
    "dbBak": "/.../userData/travel-map.sqlite.bak-...",
    "assetsBak": "/.../userData/assets.bak-...",
    "failedDir": "/.../userData/restore-staging-....failed"
  }
}
```

### phase（分阶段幂等推进）

- `init`
- `backed_up`
- `db_swapped`
- `assets_swapped`
- `committed`
- `cleaned`

## apply 状态机（推荐流程）

### 启动入口规则

启动时按优先级处理：

1. 若存在 `restore-transaction.json`：进入 **恢复模式**（继续/回滚）
2. 否则若存在 `restore-pending.json`：进入 **正常 apply 模式**
3. 否则：无动作

### 正常 apply 模式

1. 校验 pending 与 staging（沿用现有校验）
2. 创建 transaction（phase=`init`）
3. 执行并推进 phase（每一步成功后落盘 transaction）

### 恢复模式（崩溃自愈）

根据 phase 与文件存在性判断：

- `init`：视为未开始关键动作，可重新开始
- `backed_up`：current 可能已移动至 bak
  - 若 current 缺失且 bak 存在：可继续 swap；若 staging 缺失则回滚
- `db_swapped`：db 已换新，但 assets 可能还没换
  - 若 assets 未 swapped：优先继续 swap assets；若 assets swap 不可行则回滚 db
- `assets_swapped`：db+assets 都已换新
  - 继续 committed/cleaned

恢复模式的总原则：

- **最终一致性优先**：db 与 assets 必须同批次
- **失败可回滚**：回滚到原 current（用 bak）
- **不可恢复保留现场**：staging 目录重命名为 `.failed-*`，并清掉 pending/transaction 防止循环卡死

## 回滚策略

当任一步出现异常：

- 优先把 current 回滚为 bak（db 与 assets 分别处理）
- 删除 pending 与 transaction（避免卡死）
- staging 重命名为 `.failed`（保留现场）

## 失败与清理策略

为避免残留膨胀：

- `.bak`、`.failed` 采用唯一命名（已有）
- 可选：新增后台清理策略（按数量/时间清理旧 `.bak`/`.failed`）——本轮不实现，仅记录后续方向

## 测试计划（必须）

新增 app 单测模拟“崩溃点”：

- 在每个 phase 结束时构造磁盘状态并重入 apply：
  - 能完成恢复或回滚
  - 不会留下 pending/transaction 永久存在
  - 不会生成无界 `.bak`/`.failed`

## 变更范围

- 仅修改 `packages/app/src/main/backupRestore.ts` 中 apply 逻辑
- 增加新测试文件覆盖崩溃阶段
- 增加 ADR 记录决策

