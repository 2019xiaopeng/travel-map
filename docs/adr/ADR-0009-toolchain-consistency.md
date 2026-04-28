# ADR-0009：工具链一致性（TypeScript 版本与 pnpm 构建脚本）

## 状态

已采纳

## 背景

本项目是 Electron + React + better-sqlite3 的桌面应用，依赖本地安装阶段执行一部分构建脚本（native 模块、bundler 依赖等）。

同时，TypeScript 版本需要保证在公共 registry 可获取，否则新环境执行 `pnpm install` 会直接失败，阻断本地开发闭环。

## 决策

1. 将 workspace 内 `typescript` 版本收敛到公共 registry 可获取的版本范围（当前使用 `^5.6.3`），确保 `pnpm install` 在新环境可直接成功。
2. 在 README 中明确 `pnpm approve-builds` 的步骤，确保 `better-sqlite3`、`electron`、`esbuild` 等依赖允许执行构建脚本，从而完成桌面端可运行/可打包闭环。

## 影响

- 正向：新机器/新成员拉取仓库后可以一条龙完成安装与运行；避免“装不上依赖”或“native 模块没编译”的半成品体验。
- 代价：首次安装需要额外一步批准构建脚本（pnpm 安全机制）。

## 相关实现

- 版本收敛：根与各 package 的 `package.json`
- 安装指引：[README.md](file:///workspace/README.md)

