# ADR-0038：Restore 产物 retention 清理策略（.bak / .failed）

## 状态

已采纳

## 背景

恢复流程会产生：

- `.bak-*`：旧 db / 旧 assets 的备份
- `.failed*`：失败现场（staging 的保留目录）

长期使用时它们会持续累积，造成磁盘膨胀；但清理如果做得激进又可能误删仍需恢复/排障的现场。

## 决策

1. **保守触发**：
   - 仅当不存在 `restore-transaction.json` 与 `restore-pending.json` 时才执行清理
   - 清理放在启动时 `applyPendingRestoreIfPresent` 之后、`initDb()` 之前
2. **白名单匹配（不递归）**：
   - 仅枚举 `userDataPath` 顶层
   - 仅处理：
     - `travel-map.sqlite.bak-*`（文件）
     - `assets.bak-*`（目录）
     - `restore-staging-*.failed*`（目录）
   - 通过 `lstat` 拒绝 symlink
3. **保留规则（TTL + Top-K）**：
   - `.failed*`：保留最近 3 个；删除超过 7 天且超出 Top-K 的项目
   - db bak：保留最近 5 个；删除超过 30 天且超出 Top-K 的项目
   - assets bak：保留最近 3 个；删除超过 30 天且超出 Top-K 的项目
4. **清理不阻塞启动**：
   - 单项失败吞掉并继续

## 相关文档

- 设计：[2026-04-30-tx-path-validation-and-retention-design.md](file:///workspace/docs/superpowers/specs/2026-04-30-tx-path-validation-and-retention-design.md)

