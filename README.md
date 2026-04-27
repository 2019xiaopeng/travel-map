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

## 验证路径（手动点按）

1. 启动 `pnpm dev:electron`
2. 在地图上点击任一省份边界进入省视图
3. 点击地级市边界进入市视图，右侧抽屉打开
4. 进入“旅行记录” → 新建一条 Trip → 在正文写内容/插入图片
5. 在地图右键添加 POI → 点击 POI 打开详情 → 编辑类别/标签
6. 在 Trip 详情页：
   - 相关地点：查看行程 POI 顺序
   - 记账明细：新增/删除一笔花费并确认总花费同步
   - 附件：上传任意文件，确认在 `userData/assets/` 下落盘

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

## 常见问题

- 地图提示 `VITE_AMAP_KEY is not set`：确认 `.env.local` 存在且变量名为 `VITE_AMAP_KEY`
- 地图加载失败：检查 Key 是否开通 Web JS API、是否配置了 `VITE_AMAP_SECURITY_JS_CODE`
- 打包后启动报 native 模块问题：优先使用 `pnpm --filter @travel-map/app build:*` 生成安装包，并确保 `electron-builder` 配置里包含 `better_sqlite3.node`

## Roadmap

- 旅行与 POI 的更强关联（在 Trip 中编辑 POI 顺序、路线规划）
- 附件面板：列表化展示、快速打开、预览（图片/PDF）
- 导入导出：一键打包 `userData` 目录、迁移到新设备
- 可选云同步（后续阶段）

## 文档

产品交互、动效规范、数据模型与架构说明都在 [docs/travel-map-docs](file:///workspace/docs/travel-map-docs/README.md)。

## License

暂未指定。
