# ADR-0011：POI 点选添加流程与坐标约定对齐

## 状态

已采纳

## 背景

文档 [12-POI录入与地图交互细则](file:///workspace/docs/travel-map-docs/12-POI录入与地图交互细则.md) 对 POI 录入的 MVP 交互与坐标约定有明确要求：

- 主形态：点击工具栏“添加地标”后在地图点击落点（避免桌面端右键冲突）
- 落点后弹出小表单：名称、分类、简介
- 坐标约定：入库 WGS84，同时缓存 gcj02_lng/gcj02_lat（与高德交互时转换）
- 辅助形态：允许精确坐标编辑

此前实现存在偏差：

- 使用 `rightclick + prompt()` 直接创建 POI，交互与文档不符
- 写入 DB 时将高德返回的 GCJ02 直接写入 `lng/lat`，违反“入库 WGS84”的约定
- POI 详情页没有经纬度字段，无法精确编辑

## 决策

1. 采用“添加模式”而不是右键：
   - 地图左上角工具栏增加“添加地标/取消添加”按钮
   - 进入添加模式后，下一次地图点击捕获落点并打开表单
2. 落点表单收敛为一个轻量 modal：
   - 名称必填，分类/简介可选
   - 保存后自动选中该 POI（打开抽屉详情）
3. 坐标写入规则对齐：
   - 地图点击拿到的是 GCJ02
   - 创建 POI 时将 GCJ02 转为 WGS84 写入 `lng/lat`，同时保存 `gcj02_lng/gcj02_lat`
4. POI 详情补充精确坐标编辑：
   - 允许编辑 WGS84 lng/lat
   - 编辑后同步计算并更新 GCJ02 缓存字段

## 相关实现

- 添加按钮与提示：[BreadCrumbOverlay.tsx](file:///workspace/packages/renderer/src/features/map/BreadCrumbOverlay.tsx)、[MapView.tsx](file:///workspace/packages/renderer/src/features/map/MapView.tsx)
- 落点表单：[PoiAddModal.tsx](file:///workspace/packages/renderer/src/features/map/PoiAddModal.tsx)
- 地图点击捕获：[PoiLayer.tsx](file:///workspace/packages/renderer/src/features/map/layers/PoiLayer.tsx)
- 坐标转换工具：[coord.ts](file:///workspace/packages/renderer/src/utils/coord.ts)
- 坐标编辑：[PoiDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/PoiDetail.tsx)

