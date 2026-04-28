# ADR-0010：封面替换时回收旧资源

## 状态

已采纳

## 背景

City/Trip 的封面是典型的“可反复替换资源”。如果替换封面只更新 `cover_asset_id` 而不回收旧的 Asset，会造成：

- 用户频繁更换封面后磁盘持续膨胀
- 旧封面在 DB 中失去引用，但仍占用 `userData/assets/` 空间

## 决策

在主进程更新封面时，读取旧的 `cover_asset_id`：

- 若旧值存在且与新值不同，则在更新完成后触发“若无引用则删除”的回收逻辑
- 回收逻辑复用 ADR-0008 的引用计数规则（Tag 引用 + City/Trip cover 引用）

## 相关实现

- Trip 封面变更回收：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- City 封面变更回收：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)

