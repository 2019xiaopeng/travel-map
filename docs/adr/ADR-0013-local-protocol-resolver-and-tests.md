# ADR-0013：local:// 协议解析函数化与可回归测试

## 状态

已采纳

## 背景

本项目的 `local://` 协议同时承担两类要求：

- 与文档约定一致的 URL 结构（`local://assets/...`，并兼容历史 `local:///assets/...`）
- 安全边界：只允许访问 `userData/assets` 目录内资源，并可对 path traversal 做防御

此前协议解析逻辑内联在主进程 `protocol.handle('local', ...)` 中，且依赖 WHATWG URL 的 `host/pathname` 组合与隐式的 dot-segment 归一化行为，容易出现：

- 某些 URL 形态解析不一致（host/pathname 丢失前缀）
- `..` / `%2e%2e` 等路径穿越边界在不同解析路径下表现不稳定
- 缺少可回归测试，改动时容易引入安全/兼容性回归

## 决策

1. 抽取纯函数 `resolveLocalAssetRequest`：
   - 输入：`requestUrl`、`userDataPath`
   - 输出：`allowed`、`relativePath`、`absolutePath`
   - 手写解析 `local://` 前缀后的剩余部分，避免依赖 URL 解析器的隐式归一化行为
2. 使用 Node 内置测试运行器做回归测试：
   - `node --experimental-strip-types --test`
   - 覆盖：`local://assets/...`、`local:///assets/...`、路径穿越拒绝
3. 主进程协议处理统一使用该函数，避免逻辑分叉。

## 相关实现

- 解析函数：[localProtocol.ts](file:///workspace/packages/app/src/main/localProtocol.ts)
- 协议处理：[index.ts](file:///workspace/packages/app/src/main/index.ts)
- 回归测试：[localProtocol.test.ts](file:///workspace/packages/app/test/localProtocol.test.ts)

