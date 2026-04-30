# 设计：Restore 可观测性（结构化日志 + 诊断包导出）

## 背景

restore 相关链路（导入 zip → staging → pending/transaction apply → retention cleanup）已经在安全性与幂等性上做了多轮加固，但仍缺少“可观测性”：

- 失败时难以定位：用户只能看到 toast/alert，缺少可复现的状态快照与事件序列
- 现场排障成本高：pending/tx、staging、bak/failed 的状态需要可解释输出

本轮目标是提供“专业成熟本地项目”级别的排障能力，同时遵守隐私边界（不落盘用户敏感内容/绝对路径）。

## 目标

- 记录 restore/apply/cleanup 的关键事件序列（结构化日志）
- 失败时自动生成诊断包（JSON），支持 UI 一键导出
- 日志与诊断信息默认不包含绝对路径，仅包含相对 `userDataPath` 路径
- 不引入第三方日志库（减少依赖与攻击面）

## 非目标

- 不导出 DB 内容/资产内容（仅记录元信息与计数）
- 不做跨进程的完整 tracing（先聚焦 main 进程 restore 相关）

## 设计 1：本地结构化日志（JSONL）

### 文件与轮转

- 路径：`<userData>/logs/restore.log`
- 格式：JSON Lines（每行一个 JSON）
- 轮转：按大小（默认 1MiB）
  - 超过阈值时：`restore.log -> restore.log.1`，`.1 -> .2`，`.2 -> .3`（保留 3 份）

### 事件结构

字段（建议）：

- `ts`：ISO 时间字符串
- `level`：`info | warn | error`
- `event`：例如 `restore.apply.start` / `restore.apply.fail` / `restore.cleanup.done`
- `phase`：`init/backed_up/db_swapped/assets_swapped/committed/cleaned`（如适用）
- `error_code`：短枚举（避免直接暴露 stack）
- `message`：简短描述
- `paths`：相对 `userDataPath` 的路径列表（可为空）
- `meta`：计数/耗时/配置快照等

### 隐私与脱敏

- 仅允许写入相对 `userDataPath` 路径：
  - `path.relative(userDataPath, abs)` 结果若以 `..` 开头则写 `<outside>`
  - `stagingPath` 等敏感字段同理，仅写 `restore-staging-*` 形式
- 不写绝对路径、不写 DB 内容、不写用户输入文本

## 设计 2：诊断包（JSON）

### 输出

- 路径：`<userData>/diagnostics/restore-diagnostic-<timestamp>.json`
- 写入：原子写（tmp + rename）

### 内容

建议字段：

- `generated_at`
- `versions`：`app_version`, `node`, `electron`, `chrome`, `platform`, `arch`
- `restore_state`：
  - `has_pending` / `has_transaction`
  - pending/tx 的白名单字段（例如 phase/version），以及 staging 的相对路径
- `retention`：最终配置快照（默认值 + env 覆盖后的结果）
- `recent_events`：最近 N 条 restore 事件（来自内存 ring buffer，默认 200）

### 触发

- 自动：`restore.apply.fail` / `restore.cleanup.fail` 时生成 1 份诊断包（尽力而为，不阻塞启动）
- 手动：UI 一键导出（IPC 调用）

## 设计 3：API 与接入点

### main 模块

新增：`packages/app/src/main/diagnostics/restoreDiagnostics.ts`

导出接口：

- `initRestoreDiagnostics({ userDataPath, appVersion })`
- `logRestoreEvent(input)`
- `exportRestoreDiagnostic({ reason })` → `{ ok, relativePath }`
- `revealInFileManager({ relativePath })`（安全限制：只允许 `diagnostics/` 与 `logs/` 下）

### 事件接入点

- `applyPendingRestoreIfPresent` / `applyRestoreTransaction`：
  - start / success / fail
  - phase 推进点
  - fail-safe：staging → failed、tx/pending 清理
- `cleanupRestoreArtifacts`：
  - start / done / fail
  - 删除计数、跳过计数、最终 retention cfg
- 启动流程（`index.ts`）：
  - 对 restore/cleanup 抛错捕获并记录

### IPC（手动导出）

新增 IPC：

- `diagnostics:exportRestoreDiagnostic` → `{ ok, relativePath }`
- `diagnostics:reveal`（参数：`relativePath`）→ `{ ok }`

renderer 侧：

- 在一个现有入口（例如 drawer 菜单项）增加“导出诊断”动作
- 导出成功后 toast 展示相对路径，并调用 reveal 打开所在目录

## 测试计划（TDD）

- 日志落盘：
  - 写入一条事件，断言 `restore.log` 中不包含绝对路径且为合法 JSONL
  - 超过阈值触发轮转，断言 `restore.log.1` 存在
- 诊断包：
  - 导出后文件存在且 JSON 可 parse
  - `recent_events` 包含最近事件，且路径字段已脱敏为相对路径或 `<outside>`
- reveal 限制：
  - 仅允许 `diagnostics/` 与 `logs/` 下相对路径

