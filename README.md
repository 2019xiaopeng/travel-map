# Travel Map

本地优先的旅行地图与游记系统：以中国地图为入口，支持省→市下钻、POI 标记、旅行记录、花费明细与附件归档。

**仓库简介（GitHub About 建议）**：Local-first travel journal with an interactive China map, POIs, trips, costs, and offline attachments — built with Electron + React + SQLite.

## 功能概览

- 中国地图下钻：全国 → 省 → 地级市（边界高亮 + 过渡动画）
- 城市抽屉：城市封面/统计/旅行列表
- 旅行记录：正文（Markdown）、关联地点列表、记账明细
- POI 标记：地图点击查看详情，支持标签与备注
- 附件与图片：本地落盘，DB 记录元数据，通过 `local://` 协议加载

## 技术栈

- 桌面：Electron
- 前端：React + TailwindCSS
- 地图：高德地图 Web JS API (AMap)
- 数据：SQLite（better-sqlite3）
- Monorepo：pnpm workspaces

## 项目结构

```text
.
├── packages/
│   ├── app/                 # Electron 主进程 + preload + DB/IPC
│   ├── renderer/            # React 渲染进程（地图、抽屉、编辑器）
│   └── core/                # 可复用的公共模块（如后续抽出）
├── docs/travel-map-docs/    # 产品/架构真相源文档
└── README.md
```

## 本地开发

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量（高德）

复制并创建 `.env.local`（不要提交到仓库）：

```env
VITE_AMAP_KEY=your_amap_key
VITE_AMAP_SECURITY_JS_CODE=your_security_js_code
```

### 3) 启动

```bash
pnpm dev:electron
```

如果只想单独启动渲染进程（Vite）用于调试 UI：

```bash
pnpm dev
```

## 打包构建

```bash
pnpm build
pnpm --filter @travel-map/app build:mac
pnpm --filter @travel-map/app build:win
```

产物默认输出到 `packages/app/dist/`。

## 数据存储与备份

应用数据存储在操作系统的 `userData` 目录中（Electron `app.getPath('userData')`），其中包含：

- `travel-map.sqlite`：SQLite 数据库
- `assets/`：图片与附件归档目录

备份方式：关闭应用后将整个 `userData` 目录打包复制即可。

## 安全边界说明

该项目采用 `preload` + `contextBridge` 暴露能力到渲染进程，并且：

- DB 操作不透传 SQL，采用白名单 IPC API
- 附件落盘路径做了规范化与目录约束，防止路径穿越写入
- `local://` 协议对本地路径做前缀校验，防止越权读取

## 文档

产品交互、动效规范、数据模型与架构说明都在 [docs/travel-map-docs](file:///workspace/docs/travel-map-docs/README.md)。

## License

暂未指定。
