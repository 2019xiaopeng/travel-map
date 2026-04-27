# ADR-0004：对齐交互规范：抽屉/面包屑/镜头策略

## 状态

已接受

## 背景

交互规范与 UI 风格文档约束了以下关键点：

- 省份点击需要“镜头缩放 + 平移”并自动对齐到合适级别（[01-交互与动效规范.md](file:///workspace/docs/travel-map-docs/01-%E4%BA%A4%E4%BA%92%E4%B8%8E%E5%8A%A8%E6%95%88%E8%A7%84%E8%8C%83.md)）
- 地级市点击不移动镜头，仅高亮并打开抽屉
- 抽屉作为 UI 浮层常驻，且在全国层级不应出现“可点但不显示”的状态
- 面包屑文案与层级一致

## 决策

1. 顶部“展开/收起抽屉”按钮在全国层级禁用，避免状态与可见性不一致。
2. 面包屑在全国层级显示“`中国`”起点，在省/市层级可回退到上级。
3. 省份点击的镜头进入使用 `setFitView([provincePolygon])`，由地图引擎自动计算缩放级别，满足“清晰看到地级市边界”的目标。

## 影响

- 正向：交互与 `docs/` 描述一致，避免 UI 状态不闭环；镜头缩放适配不同省份大小，减少硬编码 zoom 的偏差。
- 代价：`setFitView` 的最终 zoom 值依赖地图引擎策略，视觉上可能和手工设定略有差异，需要通过 padding 调整。

## 相关实现

- 抽屉禁用逻辑：[App.tsx](file:///workspace/packages/renderer/src/App.tsx)
- 面包屑渲染与文案：[BreadCrumbOverlay.tsx](file:///workspace/packages/renderer/src/features/map/BreadCrumbOverlay.tsx)
- 省份点击镜头处理：[ProvinceLayer.tsx](file:///workspace/packages/renderer/src/features/map/layers/ProvinceLayer.tsx)

