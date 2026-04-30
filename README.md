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

如果终端输出包含 `Ignored build scripts`，需要执行一次：

```bash
pnpm approve-builds
```

在列表里勾选允许构建的依赖（至少包含 `better-sqlite3`、`electron`、`esbuild`），否则本地开发/打包时可能出现 native 模块未编译或 Electron 相关资源缺失。

### 2) 配置环境变量（高德地图 API Key）

为了让地图正常加载，你需要自己去[高德开放平台](https://console.amap.com/dev/key/app)申请一个 Web 端 (JS API) 的 Key。

1. 登录高德开放平台，进入“应用管理” -> “我的应用” -> “创建新应用”。
2. 在应用下点击“添加 Key”，服务平台选择 **Web 端 (JS API)**。
3. 提交后，你会获得一个 **Key** 和一个 **安全密钥 (Security JS Code)**。
4. 在项目根目录（或 `packages/renderer` 目录）下创建 `.env.local` 文件（该文件已被 git 忽略）：

```env
VITE_AMAP_KEY=你的高德Key
VITE_AMAP_SECURITY_JS_CODE=你的高德安全密钥
```

> **注意**：如果你申请的是新版高德 Key，必须同时配置 `VITE_AMAP_SECURITY_JS_CODE`，否则地图会因鉴权失败而无法加载。

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

### 一键备份（推荐）

在应用内（城市抽屉底部）点击：

- `导出备份（zip）`：导出包含 `travel-map.sqlite` 与 `assets/` 的备份包
- `导入备份（zip）`：导入备份包到 staging，并在确认后重启应用完成替换

该流程具备事务化 apply 与崩溃自愈：即使在替换过程中异常退出，下次启动也会继续推进或回滚到一致状态，避免 “db 新但 assets 旧” 的半交换。

### 手工备份（兜底）

关闭应用后将整个 `userData` 目录打包复制即可。

## 诊断与日志（可观测性）

用于排障的本地输出（默认仅写入 `userData` 下的相对路径，不包含绝对路径或用户数据内容）：

- `userData/logs/restore.log`：restore/apply/cleanup 结构化日志（JSONL，按大小轮转）
- `userData/diagnostics/restore-diagnostic-<timestamp>.json`：诊断包（版本/状态/最近事件）

在应用内（城市抽屉底部）点击 `导出诊断` 可手动生成诊断包并打开所在目录；restore 失败时也会尽力自动生成一份诊断包。

> 诊断包与日志默认对可能包含路径的 message 做脱敏（写入 `<redacted>`），并对 `logs/diagnostics` 目录 symlink 做防护，避免越界写盘。

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
- 可观测性增强：更完善的诊断包内容、导出更多非敏感运行信息
- 可选云同步（后续阶段）

## 文档

产品交互、动效规范、数据模型与架构说明都在 [docs/travel-map-docs](file:///workspace/docs/travel-map-docs/README.md)。

## License

暂未指定。
