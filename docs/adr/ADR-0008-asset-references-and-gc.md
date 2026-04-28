# ADR-0008：资产引用关系与垃圾回收（GC）

## 状态

已采纳

## 背景

在桌面端本地优先应用里，资源文件（图片/附件）是“长期增长数据”。如果只做“上传写盘 + 写 DB”，但缺少“引用关系建模 + 删除回收”，长期使用必然出现：

- 删除附件/正文图片后，DB/磁盘遗留孤儿资源
- 资源无法判断是否仍被引用，导致不敢删或误删
- 按路径猜引用（LIKE trips/xxx）不可靠，且不覆盖正文内联图片

## 决策

1. 通过 `Tag` 表新增 `entity_type = 'trip_inline_asset'` 来维护“Trip 正文内联资源”的引用集合：`Tag(entity_type, entity_id=tripId, name=assetId)`。
2. 提供主进程白名单 IPC：
   - `db:setTripInlineAssets(tripId, assetIds[])`：用集合覆盖写入，并对移除的 assetId 触发“若无引用则删除”的回收逻辑
   - `db:removeTripAttachment(tripId, assetId)`：删除附件关联，并触发“若无引用则删除”的回收逻辑
3. 回收逻辑以“引用计数”为准：若 assetId 同时不被以下引用，则删除：
   - Tag：`trip_attachment` / `trip_inline_asset`
   - Trip.cover_asset_id
   - City.cover_asset_id
4. `file:saveAsset` 对 sha256 去重冲突增加补偿逻辑：写库失败时删除已拷贝文件，避免僵尸文件；若 sha256 已存在则复用已有 Asset 记录。

## 影响

- 正向：附件删除与正文图片删除实现闭环；可持续运行而不产生资源膨胀；避免误删仍被封面/其他引用使用的资源。
- 代价：需要在 Trip 内容变更时维护 inline asset 集合（渲染层解析 Markdown 并同步到主进程）。

## 相关实现

- 引用维护：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)
- IPC 与回收：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- DB 封装收口：[db.ts](file:///workspace/packages/renderer/src/services/db.ts)

