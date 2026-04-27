# ADR-0002：资源落盘与 local:// 访问边界

## 状态

已接受

## 背景

项目需要支持图片/附件落盘，并在渲染进程中加载展示。

Electron 中常见风险包括：

- 写入路径穿越（把文件写到 `userData` 之外）
- 读取路径穿越（通过 `local://` 或 `file://` 读取系统敏感文件）
- 渲染进程直接打开任意本机路径

## 决策

1. 资源落盘统一写入 `userData/assets/` 子树，并对目标路径做 `resolve + startsWith` 约束。
2. `local://` 协议只允许读取 `userData/assets/` 子树，不允许读取整个 `userData`。
3. 附件“打开”能力不通过 `window.open(local://...)` 实现，改为主进程 `shell.openPath`，并同样校验必须落在 `assets/` 下。

## 影响

- 正向：把资源访问边界收敛到单一目录，降低越权读取/写入风险；附件打开行为在主进程可控。
- 代价：所有需要访问资源的路径必须是 `assets/` 下的相对路径；如果未来需要访问 `userData` 下其他文件，需要新增明确白名单能力。

## 相关实现

- 资源写入与路径约束：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- `local://` 协议实现与访问范围：[index.ts](file:///workspace/packages/app/src/main/index.ts)
- 渲染侧附件打开：[TripDetail.tsx](file:///workspace/packages/renderer/src/components/drawer/TripDetail.tsx)

