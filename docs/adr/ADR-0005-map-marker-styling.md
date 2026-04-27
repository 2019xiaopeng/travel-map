# ADR-0005：地图标注 DOM 样式不依赖 Tailwind 扫描

## 状态

已接受

## 背景

POI 标注使用高德地图 `Marker.content` 注入 DOM 字符串。

如果字符串中使用 Tailwind class（如 `bg-blue-500`、`group-hover:*`），需要依赖 Tailwind 的内容扫描把对应 class 编译进 CSS。该链路在生产构建/裁剪时容易出现“标注无样式但不报错”的问题，导致 UI 表现不闭环。

## 决策

POI 标注的 DOM 样式使用 inline style（并保留 `title` 作为基础提示），避免依赖 Tailwind 内容扫描。

## 影响

- 正向：标注样式在 dev/build 下表现一致；不受 Tailwind 扫描与裁剪影响。
- 代价：标注样式与页面样式不再共享 Tailwind token，需要在代码中维护一份简单的颜色与布局规则。

## 相关实现

- POI 标注生成：[PoiLayer.tsx](file:///workspace/packages/renderer/src/features/map/layers/PoiLayer.tsx)

