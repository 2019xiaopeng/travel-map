# 任务计划：地图底图 + 行政区下钻

## 目标
1. Electron 窗口内显示高德地图真实底图作为全屏背景
2. 实现"省→市下钻"最小闭环：全国→省→市（点击市高亮+开抽屉）
3. 右侧抽屉维持现状，不破坏

## 真相源
- `docs/travel-map-docs/01-交互与动效规范.md`
- `docs/travel-map-docs/03-技术栈与架构方案.md`
- `docs/travel-map-docs/07-UI视觉与布局风格.md`
- `docs/travel-map-docs/12-POI录入与地图交互细则.md`

## 约束
- 高德 Key 从 `import.meta.env.VITE_AMAP_KEY` 读取
- 不引入 Tauri/R2/SQLite/Milkdown
- GeoJSON 本地打包 `packages/renderer/src/assets/geo/`，按省懒加载
- 地图层与 UI 层分层（z-index / pointer-events）
- 代码组织到 `features/map/`，不塞 App.tsx

## 发现

### 现有代码
- `App.tsx`：暗色全屏 + MAP PLACEHOLDER + 顶栏 + Drawer
- `Drawer.tsx`：三段式（city/tripList/tripDetail）+ 面包屑，硬编码"杭州市"
- 抽屉子组件：CityHome/TripList/TripDetail，全部静态占位
- CSS 变量：暗色基调 `--color-bg: #0a0a0a`，`--color-accent: #3b82f6`
- `.env.local` 已有 `AMAP_KEY=0532ebb20ce405b17ec00808ee3a96fb`

### Vite env 配置
- 需要确保 `.env.local` 中的 key 被 Vite 识别为 `VITE_AMAP_KEY`
- 当前 `.env.local` 写的是 `AMAP_KEY`，需要改为 `VITE_AMAP_KEY` 或在 Vite envPrefix 配置
- 更简单的方案：直接改 `.env.local` 中的变量名为 `VITE_AMAP_KEY`

### 高德 JS SDK 加载
- 不在 index.html 写死，用 `loadAmapSdk()` 动态插入 script
- 需要等 `_AMapSecurityConfig` 设置后再加载
- 高德 JS API 2.0 需要 key + securityJsCode（或设置 securityConfig）

### GeoJSON 数据
- 需要 `china-provinces.json`（全国省级边界概要，含 id/name/center/边界）
- 需要 `provinces/330000.json`（浙江省地级市边界）
- 这些数据需要预先准备或创建占位

## 步骤

### Step 1: 修改 .env.local 变量名
- 将 `AMAP_KEY` 改为 `VITE_AMAP_KEY`，使 Vite 可通过 `import.meta.env.VITE_AMAP_KEY` 访问

### Step 2: 创建 GeoJSON 占位数据
- `packages/renderer/src/assets/geo/china-provinces.json`：全国省级边界（至少包含浙江省的 Polygon）
- `packages/renderer/src/assets/geo/provinces/330000.json`：浙江省各地级市边界
- 数据来源：可用简化版 GeoJSON（坐标点数不必极多，够渲染边界即可）

### Step 3: 创建 AMap SDK 加载工具
- `packages/renderer/src/features/map/loadAmapSdk.ts`
- 动态创建 script 标签加载高德 JS API 2.0
- 返回 Promise<window.AMap>

### Step 4: 创建地图状态管理 (Zustand store)
- `packages/renderer/src/features/map/mapStore.ts`
- 状态：level (country/province/city)、provinceId、cityId、center、zoom、selectedCity
- 操作：enterProvince、enterCity、backToCountry、backToProvince

### Step 5: 创建 MapView 组件
- `packages/renderer/src/features/map/MapView.tsx`
- 全屏地图容器，初始化高德地图
- 管理地图实例、图层渲染

### Step 6: 创建省边界图层
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- 全国视图：渲染各省 Polygon，hover 高亮，click 进入省视图
- 样式：半透明填充 + 描边，hover 时填充变亮

### Step 7: 创建市边界图层
- `packages/renderer/src/features/map/layers/CityLayer.tsx`
- 省视图：渲染地级市 Polygon，hover 高亮，click 高亮市 + 开抽屉
- 市高亮：描边加粗/变色，填充轻量强调

### Step 8: 创建面包屑覆盖层
- `packages/renderer/src/features/map/BreadCrumb.tsx`
- 地图左上角浮层：全国 / 浙江省 / 杭州市
- 点击可回退层级

### Step 9: 改造 App.tsx
- 移除 MAP PLACEHOLDER
- 嵌入 MapView 作为地图底层
- Drawer 接收城市信息（从 mapStore 获取）
- 顶栏保持在地图上方

### Step 10: 改造 Drawer 组件
- Drawer 从 mapStore 读取 selectedCity
- CityHome 显示实际选中的城市名
- 点击省/市时联动抽屉内容

### Step 11: 验证
- `pnpm dev` 启动 → 显示高德底图
- 点击浙江省 → 镜头缩放平移进入省内 → 显示地级市边界
- 点击杭州市 → 高亮杭州 + 右侧抽屉打开显示"杭州市"
