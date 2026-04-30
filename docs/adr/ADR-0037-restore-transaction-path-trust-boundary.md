# ADR-0037：Restore Transaction 路径信任边界与强校验

## 状态

已采纳

## 背景

`restore-transaction.json` 位于本地 `userData` 下，可被意外写坏或被恶意篡改。若直接信任其中的绝对路径字段（如 `tx.paths.currentDb/dbBak`），恢复流程会对任意路径执行 `rename/rm` 等破坏性操作。

## 决策

1. **信任边界收敛**：
   - 信任：`userDataPath` 与其下固定文件名
   - 不信任：transaction JSON 中的任意绝对路径
2. **current 路径固定**：
   - `currentDb = join(userDataPath, "travel-map.sqlite")`
   - `currentAssets = join(userDataPath, "assets")`
3. **bak 路径限制**：
   - 必须位于 `userDataPath` 下
   - basename 必须匹配允许前缀（db/asset 分别限制）
   - 拒绝 symlink
4. **tx schema 白名单校验**：
   - `tx.version` 必须为 1
   - `tx.phase` 必须在白名单内
5. **校验失败 fail-safe**：
   - 删除 tx，尽力清理 pending
   - staging 若合法则重命名为 `.failed` 保留现场
   - 返回 false，避免启动循环卡死

## 相关文档

- 设计：[2026-04-30-tx-path-validation-and-retention-design.md](file:///workspace/docs/superpowers/specs/2026-04-30-tx-path-validation-and-retention-design.md)

