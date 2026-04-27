# ADR 0006: 代码健壮性与完整性修复 (Anti-Lazy Code)

## 状态
已采纳

## 背景
在深度代码审查过程中，发现了一些“偷懒（Lazy）”的写法、半成品功能以及未闭环的逻辑，这些问题在“本地完美”的要求下必须被修复：
1. **频繁的数据库写操作**：在 `TripDetail` 和 `PoiDetail` 中，表单的 `onChange` 直接触发了同步的 `db.update()`，导致用户每敲击一个字符都会向 SQLite 写入一次，极大地消耗了性能。
2. **缺乏错误处理**：很多网络/DB请求（如 `db.getCity`、`createPoi`、`updateTripCost` 等）在调用时缺乏 `catch`，失败时会造成静默错误或抛出未处理的 Promise Rejection。
3. **TypeScript 滥用 `any`**：数据模型（Trip、City、POI 等）均使用了 `any`，导致类型约束形同虚设。
4. **孤立的关联关系（未闭环的半成品功能）**：
   - 缺乏将 POI 自动关联至 Trip 的闭环。虽然在“地图交互”里要求了在旅行下右键添加 POI 应该关联该旅行，但底层 `db.createPoi` 没有执行这个关联动作。
   - POI 详情页与 Trip 详情页中，缺乏将已有 POI 加入到 Trip 以及从 Trip 中移除 POI 的操作按钮。
   - 删除 Trip/POI 时，关联的 `Tag` 表记录未做清理（因为不是外键），会导致孤儿记录。

## 决策
1. **防抖与状态分离**：为所有文本输入更新添加 500ms 的防抖机制（Debounce DB Write），在本地维护 React 状态，只在输入停顿时才提交给 DB 保存，避免高频写入。
2. **补全 `try/catch` 与提示**：全面排查所有异步 IPC 和 DB 接口，并添加 `.catch()`，对用户行为产生的失败（如添加 POI、添加账单、加载城市）给出明确的 `alert` 提示与 `console.error` 日志。
3. **补充 TypeScript 实体接口**：在 `renderer/src/types/index.ts` 补充 `City`, `Trip`, `POI`, `Asset`, `TripCost`, `Tag` 接口，并替换了相关组件中的 `any`。
4. **彻底打通 Trip-POI 关系**：
   - 增强 `db.createPoi` 接口，支持传入 `trip_id` 参数，实现在同一事务中创建 POI 并插入 `Trip_POI`。
   - 在 `PoiDetail` 增加“+ 添加到当前行程”的功能按钮。
   - 在 `TripDetail` 的“相关地点”列表中，增加 `×`（移除）按钮。
5. **手动实现 `Tag` 级联删除**：在主进程 `deleteTrip` 和 `deletePoi` 时，加入 `db.transaction()`，一并删除 `Tag` 表中相关的多态实体标签，防止产生孤儿记录。

## 后果
- **正面**：极大提高了应用的健壮性，防止了数据库被高频 I/O 击穿；逻辑交互完全对齐了产品需求，不再存在“死胡同”操作；避免了脏数据的残留。
- **负面**：无明显负面，防抖带来了极少量的延迟（500ms），但在本地应用中体验依然流畅，是平衡性能的最佳实践。
