# ADR-0001：限制 DB IPC 暴露面

## 状态

已接受

## 背景

早期实现通过 IPC 暴露了 `db:query / db:get / db:run`，允许渲染进程传入任意 SQL。

在 Electron 安全模型下，一旦渲染进程出现 XSS、依赖注入或 DevTools 滥用，透传 SQL 会把数据库读写能力完全交给攻击面，属于高风险暴露。

## 方案选项

1. 继续透传 SQL，但增加 SQL 解析与黑名单过滤
2. 透传 SQL，但仅允许参数化，并对 sender 做严格校验
3. 取消透传 SQL，改为白名单业务 API（主进程固定 SQL + 参数绑定）

## 决策

选择方案 3：取消透传 SQL，改为白名单 IPC API。

渲染进程仅可调用主进程提供的特定方法（如 `db:getCity`、`db:getTrip`、`db:updateTripCost` 等），SQL 与表结构访问均由主进程固定实现并参数化。

## 影响

- 正向：显著收敛攻击面；SQL 注入类风险转为主进程可控；更利于做权限分层与审计。
- 代价：新增/变更查询需要同步更新主进程 handler 与 preload 暴露；业务迭代成本略增。

## 相关实现

- 主进程 IPC 白名单实现：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- preload 暴露与类型边界：[index.ts](file:///workspace/packages/app/src/preload/index.ts)、[vite-env.d.ts](file:///workspace/packages/renderer/src/vite-env.d.ts)
- 渲染侧 DB service 只调用白名单 API：[db.ts](file:///workspace/packages/renderer/src/services/db.ts)

