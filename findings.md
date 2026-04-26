# 发现记录

## 现有代码审计 (2026-04-25)

### 现有文件结构
```
packages/renderer/src/
├── App.tsx              # 暗色全屏 + MAP PLACEHOLDER 文字 + 顶栏 + Drawer
├── main.tsx             # ReactDOM 入口
├── vite-env.d.ts
├── styles/globals.css   # CSS 变量：暗色基调、蓝色强调
├── components/
│   ├── Drawer.tsx       # 三段式抽屉 + 面包屑导航
│   └── drawer/
│       ├── CityHome.tsx    # 城市封面/统计（硬编码"杭州市"）
│       ├── TripList.tsx    # 旅行列表（mock 3条）
│       └── TripDetail.tsx  # 左表单+右正文Tab
```

### 关键发现
1. `.env.local` 中 key 变量名为 `AMAP_KEY`，需要改为 `VITE_AMAP_KEY`（Vite 要求 `VITE_` 前缀才能暴露到前端）
2. 高德 Key: `0532ebb20ce405b17ec00808ee3a96fb`
3. Drawer 组件硬编码"杭州市"，需要从 mapStore 读取实际选中城市
4. App.tsx 中的 MAP PLACEHOLDER 需要替换为真实 MapView
5. 抽屉状态管理用 useState 在 Drawer 内部，需要改为从 mapStore 驱动

### 文档关键参数
- 省级下钻动画：500–800ms，easing 先快后慢
- 点击市：地图不移动，高亮边界 + 开抽屉
- hover 高亮：100–150ms 过渡
- 抽屉宽度：480px，glassmorphism 风格
