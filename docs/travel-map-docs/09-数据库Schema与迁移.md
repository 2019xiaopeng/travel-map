# 09｜数据库 Schema 与迁移

> 目标：在 SQLite 中具体落实《02-数据与内容模型》，确定表结构、字段约束、删除策略与数据演进（迁移）规范。

## 1. 核心表结构（Schema V1）

### 1.1 行政区基础表（低频更新）

#### Province（省）
- `province_id` (TEXT, PK)：六位行政区划代码，如 `330000`
- `name` (TEXT, NOT NULL)：如 `浙江省`

#### City（地级市/直辖市下辖区）
- `city_id` (TEXT, PK)：如 `330100`
- `province_id` (TEXT, FK → Province.province_id)
- `name` (TEXT, NOT NULL)：如 `杭州市`
- `summary` (TEXT)：城市简介（可选）
- `cover_asset_id` (TEXT, FK → Asset.asset_id)：城市封面（可选）

> 备注：行政区表可作为“缓存表”，后续允许从本地 GeoJSON/官方数据源刷新。

### 1.2 核心业务表

#### Trip（旅行记录）
- `trip_id` (TEXT, PK)：UUID v4
- `city_id` (TEXT, FK → City.city_id)：需建立索引
- `title` (TEXT, NOT NULL)
- `date_start` (TEXT)：`YYYY-MM-DD`
- `date_end` (TEXT)：`YYYY-MM-DD`
- `companions` (TEXT)：JSON Array，如 `["张三","李四"]`
- `route` (TEXT)：路线概览
- `cost_total` (REAL)：总花费
- `cover_asset_id` (TEXT, FK → Asset.asset_id)：旅行封面（可选）
- `content` (TEXT)：正文（Markdown 存储；当前以本地编辑与本地阅读闭环为主）
- `created_at` (INTEGER)：Unix 时间戳
- `updated_at` (INTEGER)：Unix 时间戳

#### POI（地标点）
- `poi_id` (TEXT, PK)：UUID v4
- `city_id` (TEXT, FK → City.city_id)：需建立索引
- `name` (TEXT, NOT NULL)
- `lng` (REAL)：WGS84 经度 ✅
- `lat` (REAL)：WGS84 纬度 ✅
- `gcj02_lng` (REAL)：GCJ-02 缓存 ✅
- `gcj02_lat` (REAL)：GCJ-02 缓存 ✅
- `category` (TEXT)：如 `景点/美食/住宿/交通/拍照点/其他`
- `summary` (TEXT)
- `created_at` (INTEGER)
- `updated_at` (INTEGER)

#### Asset（附件/资源）
- `asset_id` (TEXT, PK)：UUID v4
- `type` (TEXT)：`image` / `document` / `cover` / `receipt` / `other`（建议建索引）
- `original_filename` (TEXT)
- `mime` (TEXT)
- `size` (INTEGER)：字节
- `sha256` (TEXT)：UNIQUE（防重复导入/便于校验）
- `local_path` (TEXT)：相对于 APP_DATA_DIR 的相对路径（按城市/旅行目录）✅
- `remote_url` (TEXT)：预留字段；未来若恢复上云/对象存储再写入
- `created_at` (INTEGER)

### 1.3 关联与拆分表

#### Trip_POI（旅行-POI 关联）
- `trip_id` (TEXT, FK → Trip.trip_id)
- `poi_id` (TEXT, FK → POI.poi_id)
- `sort_order` (INTEGER)：在某次旅行中的顺序
- 约束：联合主键/唯一约束 `(trip_id, poi_id)`

#### Tag（标签系统）
- `entity_type` (TEXT)：`city` / `trip` / `poi`
- `entity_id` (TEXT)
- `name` (TEXT)
- 索引：`(entity_type, entity_id)`

#### CostBreakdown（花销拆分）
- `trip_id` (TEXT, FK → Trip.trip_id)
- `category` (TEXT)：`transport` / `hotel` / `food` / `ticket` / `other`
- `amount` (REAL)
- 约束：`(trip_id, category)` 唯一（单次旅行每个分类最多一行）

## 2. 删除策略（已采用：硬删 + 级联 + 资产生命周期）

主策略：**硬删结合外键级联（Hard Delete + Cascade）**。

### 2.1 原因
- 个人本地知识库：图片/附件占用大，软删会导致磁盘持续膨胀
- 备份走 zip 全量：保留“历史版本”意义不大，且可通过 zip 本地恢复

### 2.2 规则
1) 关联表（`Tag`、`CostBreakdown`、`Trip_POI`）：建议外键 `ON DELETE CASCADE`  
2) 核心表（`Trip`、`POI`）：应用层直接硬删  
3) **Asset 生命周期拦截（关键）**  
   - 从 SQLite 删除 Asset 记录前：应用层必须先判断引用计数（是否仍被 City/Trip/POI 引用）
   - 若无引用：先删除本地文件（local_path）→ 再 DELETE Asset 记录

## 3. 迁移策略（Migration）

### 3.1 版本记录
- 使用 SQLite 原生：`PRAGMA user_version`（整数递增：1,2,3…）

### 3.2 升级流水线（推荐）
1) 应用启动时读取 `user_version`
2) 若发现低于代码要求版本：按版本顺序执行迁移脚本（V1→V2→V3…）
3) **安全保障**：迁移前做文件级备份  
   - `db.sqlite` → `db.sqlite.bak`  
   - 迁移失败则直接回滚恢复 bak

### 3.3 回滚策略
- 不提供 down.sql 自动回滚（风险高、意义低）
- 出错时引导用户恢复 `db.sqlite.bak`

