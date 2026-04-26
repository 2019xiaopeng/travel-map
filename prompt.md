你现在在 `travel-map` 仓库中工作。请严格以 `docs/travel-map-docs/` 为唯一真相源（特别是：`01-交互与动效规范.md`、`03-技术栈与架构方案.md`、`07-UI视觉与布局风格.md`、`12-POI录入与地图交互细则.md`）。**不要引入 Tauri、不要做 R2、不要做 SQLite、不要做 Milkdown**，本次只做“地图底图 + 行政区下钻”并保持现有 UI 不破坏。

## 目标（本次交付）
1) 在 Electron 窗口内，让 `packages/renderer` 的页面显示 **高德地图真实底图（道路）**，作为全屏背景；右侧抽屉维持现状（玻璃拟态、暗色霓虹蓝风格）。
2) 实现“省→市下钻”最小闭环（先不接 DB）：
   - 全国视图显示省级边界可点击；
   - 点击省：按文档的“镜头缩放平移（500–800ms）”进入省内，并加载该省地级市边界；
   - 点击地级市：地图不移动，只高亮该市并打开右侧抽屉（可先用假城市数据填充抽屉标题/简介）。
3) 按文档 12：边界 GeoJSON **本地打包**在 `packages/renderer/src/assets/geo/`，按省懒加载（`china-provinces.json` + `provinces/{province_id}.json`）。先用 1 个省做示例（例如浙江 330000）即可，其余省可后续补。

## 约束
- 高德 Key 从 `import.meta.env.VITE_AMAP_KEY` 读取。
- 不要把任何 secret 写进前端 bundle（本次只有 AMap Key）。
- 地图层与 UI 层要分层：地图在底，抽屉浮层不受影响（z-index / pointer-events 处理好）。
- 代码组织要清晰：新增 `features/map/` 或 `components/MapView.tsx` 等目录，避免把地图逻辑塞进 App.tsx。

## 实现提示（你可以自行选择细节，但要符合文档交互）
- 高德 JS SDK 的加载方式：可以在 renderer 侧实现一个 `loadAmapSdk()`（动态插入 script），避免在 index.html 写死。
- 行政区边界渲染：用 AMap 的 Polygon 图层绘制 GeoJSON 的 MultiPolygon/Polygon（把坐标转成 AMap 的 lng/lat 数组）。
- 点击省/市的高亮：改 polygon 的 stroke/fill 样式即可。
- “镜头缩放平移”：使用 AMap 的 `setFitView` 或 `setZoomAndCenter` + 动画参数实现接近 500–800ms 的过渡（能体现先快后慢的 easing 即可）。
- 面包屑：暂时可复用现有 Drawer 面包屑占位（或在地图左上角加一个小 overlay），本次重点是下钻闭环。

## 验收标准（必须满足）
- `pnpm dev` 可启动，Electron 窗口显示高德底图。
- 点击浙江省（或你选的示例省）：能进入省内视图并看到地级市边界。
- 点击任一地级市：高亮该市，地图不移动，右侧抽屉打开并显示该市名称（先假数据也可以）。
- 代码可读、无明显 hack；新增文件/目录结构合理；不要引入超出本次目标的依赖。

完成后请简要说明你改了哪些文件、如何验证（命令 + 点击路径）。

---