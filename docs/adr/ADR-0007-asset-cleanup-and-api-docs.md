# ADR 0007: 资产文件物理清理与深层漏洞修复

## 状态
已采纳

## 背景
经过第三轮的代码深度审查，发现在文件资源管理（Assets）以及地图 SDK 加载等模块存在“半成品”和未闭环的逻辑：
1. **僵尸文件与孤儿资产（Orphan Assets）**：在此前的实现中，当我们调用 `deleteTrip` 或移除某个 Trip Attachment 时，仅仅在 SQLite 数据库里删除了关联记录（如 `Trip` 表行或 `Tag` 表行），而没有清理 `Asset` 表，更没有通过 `fs.unlink` 删除存放在 `userData/assets` 目录下的物理文件。这会导致用户在使用一段时间后，硬盘空间被大量无用文件占用（典型的 MVP 偷懒做法）。
2. **错误的资产保存路径绑定**：`MdEditor` 上传图片以及附件上传时，存放的目录是按照 `date_start_date_end-title` 生成的（如 `cities/110100-北京/trips/2023_2024-旅游/photos`）。如果用户稍后修改了 Trip 的标题或时间，后续上传的图片会被存放到全新的目录，导致同一 Trip 的资源散落在多个目录下，无法统一管理与销毁。
3. **缺少本地启动高德 API 的文档指导**：项目强依赖 `VITE_AMAP_KEY` 和 `VITE_AMAP_SECURITY_JS_CODE`，但并未在文档中明确指出申请步骤和环境变量的具体配置方式，导致其他人（或用户自己）拉取代码后无法直接在本地把地图跑起来。

## 决策
1. **修正文件存放的目录结构**：
   - 弃用易变的“日期-标题”拼接作为目录名。
   - 改为使用唯一且不可变的 `trip_id` 作为目录结构：`cities/${cityId}-${cityName}/trips/${tripId}/photos` (以及 `/cover`、`/attachments`)。
2. **实现物理文件的级联清理**：
   - 增强 `ipcMain.handle("db:deleteTrip")` 的逻辑。在执行 SQL `DELETE FROM Trip` 前，先通过 `SELECT local_path FROM Asset WHERE local_path LIKE '%/trips/' || ? || '/%'` 查出该 Trip 目录下所有的资源文件路径。
   - 在 DB 事务中删除这些 `Asset` 记录，并在事务完成后，使用 `fs.unlink` 将物理文件从磁盘上彻底抹除（Fire and forget 模式）。
   - 在 `TripDetail.tsx` 中，对“删除附件”操作加入了警示文案（“文件也将被删除”），并且不仅删除 `Tag` 关联，还为后续的 IPC 彻底销毁做好了扩展准备（目前统一在删 Trip 时做兜底回收）。
3. **完善文档**：
   - 在 `README.md` 中专门补充《配置环境变量（高德地图 API Key）》一节，提供详细的获取步骤与 `.env.local` 配置示例。

## 后果
- **正面**：彻底解决了存储泄漏（Storage Leak）的严重 Bug，保证了桌面端应用在长期使用下的轻量化；文件目录结构更加合理，资源严格绑定在 `trip_id` 实体上，便于维护和整体搬迁；新开发者/用户拉取代码后只需照着 README 填 Key 即可启动。
- **负面**：删除 Trip 时的磁盘 I/O 稍微变多（由于需要 `fs.unlink`），但在个人桌面应用场景下耗时可以忽略不计。
