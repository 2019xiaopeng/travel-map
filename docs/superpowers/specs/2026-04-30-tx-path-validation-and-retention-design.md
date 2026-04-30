# 设计：Restore Transaction 路径强校验 + 恢复残留清理（retention）

## 背景

备份恢复 apply 已引入 `restore-transaction.json` 以提供崩溃自愈与强幂等（见 ADR-0035/0036）。但当前仍有两类“成熟本地项目”必须补齐的风险：

1. **transaction 路径信任边界不足**  
   `restore-transaction.json` 位于本地可写目录，若被篡改，`tx.paths.currentDb/currentAssets/dbBak/assetsBak` 可能指向 `userData` 之外路径，进而被 `rename/rm` 误操作。
2. **长期使用残留膨胀**  
   `.bak-*` 与 `.failed*` 随时间累积，占用磁盘，缺乏保留策略会损害“长期可用性”。

## 目标

- **安全性**：transaction 被篡改时也不会对 `userDataPath` 之外做任何破坏性文件操作。
- **正确性**：transaction 校验失败时 fail-safe 收敛（不会卡死、不会半交换、保留现场）。
- **长期可维护性**：提供保守的 `.bak-*` / `.failed*` 清理策略，避免长期膨胀。
- **可回归**：为校验与清理策略补齐单测。

## 非目标

- 不改变 zip 导入/导出结构与 manifest 逻辑
- 不做“基于 DB 引用关系”的深度清理（GC），仅做 restore 相关产物的轻量保留策略

## 设计 1：transaction 路径强校验（推荐方案）

### 信任边界

- **信任**：`userDataPath`（由主进程 `app.getPath("userData")` 提供）与其下的固定文件名
- **不信任**：`restore-transaction.json` 中的任意绝对路径字段

### 核心规则（方案 A：强制 current 固定 + 限制 bak）

1. `currentDb/currentAssets`：**忽略 tx 中的值**，强制使用：
   - `currentDb = join(userDataPath, "travel-map.sqlite")`
   - `currentAssets = join(userDataPath, "assets")`
2. `dbBak/assetsBak`：仅允许使用满足以下条件的路径，否则视为 tx 无效：
   - `resolve(path)` 必须位于 `userDataPath` 下
   - `basename` 必须匹配允许前缀：
     - db：`travel-map.sqlite.bak-`
     - assets：`assets.bak-`
   - 拒绝 symlink（`lstat` 检测为符号链接则跳过/失败）
3. `tx.version` 必须为 `1`；`tx.phase` 必须为白名单之一，否则删除 tx 并返回 false。
4. `stagingPath` 必须位于 `userDataPath` 下且目录名以 `restore-staging-` 开头（现有规则保持）。

### 校验失败时的 fail-safe

- 删除 `restore-transaction.json`
- 尽力删除 `restore-pending.json`（避免循环卡死）
- 若 `stagingPath` 存在且合法，重命名为 `*.failed-*` 保留现场（尽力而为）
- 返回 `false`（不抛异常）

## 设计 2：restore 产物 retention 清理（保守策略）

### 触发时机

- 启动时：`applyPendingRestoreIfPresent(...)` 执行完成后、`initDb()` 之前执行一次 `cleanupRestoreArtifacts({ userDataPath, now })`
- 互斥条件（保守）：若存在 `restore-transaction.json` 或 `restore-pending.json`，则跳过清理

### 扫描范围（避免误删）

- 仅枚举 `userDataPath` 顶层（不递归）
- 仅匹配明确模式（拒绝 symlink）：
  - `travel-map.sqlite.bak-*`（文件）
  - `assets.bak-*`（目录）
  - `restore-staging-*.failed*`（目录）

### 保留规则（TTL + Top-K）

- `*.failed*`：
  - 保留最近 `K_failed=3`
  - 删除超过 `TTL_failed=7d` 且超出 Top-K 的项目
- `*.bak-*`：
  - db 备份保留最近 `K_dbBak=5`
  - assets 备份保留最近 `K_assetsBak=3`
  - 仅删除超过 `TTL_bak=30d` 且超出 Top-K 的项目

> 规则同时使用 “时间 + 数量” 双保险，降低误删风险。

### 清理实现注意点

- 用 `lstat` 拒绝 symlink（避免链接攻击/误删外部路径）
- 删除使用 `fs.promises.rm(..., { recursive:true, force:true })`
- 对每一项错误吞掉并继续（清理不应阻塞启动）

## 测试计划

### transaction 路径强校验

- tx.paths 越界（currentDb/dbBak 指向 userData 之外）：
  - 断言：不触碰越界路径；tx 被删除；pending 被清理；返回 false
- tx.phase 非法：
  - 断言：删除 tx 返回 false

### retention 清理

在临时 userData 目录中构造：

- 多个 `restore-staging-*.failed*`，验证 Top-K + TTL 删除行为
- 多个 `travel-map.sqlite.bak-*` / `assets.bak-*`，验证按 TTL + Top-K 仅删多余项
- 构造 symlink 项，验证不会删除 symlink 指向外部的内容

## 变更范围（预期）

- `packages/app/src/main/backupRestore.ts`：加强 tx 校验 + 新增 cleanupRestoreArtifacts
- `packages/app/src/main/index.ts`：挂载启动时 cleanup 调用点
- `packages/app/test/*`：新增测试覆盖
- `docs/adr/ADR-0037...`、`docs/adr/ADR-0038...`

