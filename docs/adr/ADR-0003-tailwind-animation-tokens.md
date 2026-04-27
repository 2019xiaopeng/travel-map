# ADR-0003：Tailwind v4 动画实现方式

## 状态

已接受

## 背景

代码中使用了 `animate-fade-in-up` 等动画类名，但项目采用 Tailwind v4 的 `@import "tailwindcss"` 方式，默认不再依赖传统 `tailwind.config.js` 来扩展 keyframes。

如果动画 keyframes 未在 CSS 中声明，`animate-*` 类名会变成无效果样式，导致交互过渡与文档基线不一致。

## 决策

使用 Tailwind v4 的 `@theme` 在全局样式中声明动画 token 与 keyframes，确保在 Electron/Chromium 环境下稳定工作，并避免依赖额外的构建配置文件。

## 影响

- 正向：动画定义与主题变量集中在全局样式，构建链路更直接；避免类名存在但无效果的“假动效”。
- 代价：动画 token 需要在 CSS 层维护；如需更多 motion token，需要继续在 `@theme` 里扩展。

## 相关实现

- 全局动画 token：[globals.css](file:///workspace/packages/renderer/src/styles/globals.css)

