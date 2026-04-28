# ADR-0020：备份导出 warnings 需要在 UI 可见

## 状态

已采纳

## 背景

ADR-0019 引入了导出时对 Asset 实物校验，并在 `manifest.json` 写入 `warnings`。如果 UI 不提示：

- 用户仍然以为“导出成功 = 数据健康”
- `warnings` 只存在于 zip 内部，等到恢复或迁移时才发现丢图/损坏

这属于典型“有校验但无闭环反馈”的半成品。

## 决策

1. `file:exportBackupZip` 返回 `warnings` 给渲染进程。
2. UI 导出完成后：
   - 若 warnings 为空：仅提示导出路径
   - 若 warnings 非空：在弹窗中追加摘要（条数 + 前几条）
3. 摘要逻辑抽为纯函数并加入测试，避免 UI 字符串拼接散落在各处。

## 相关实现

- IPC 返回 warnings：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- UI 提示与摘要：[CityHome.tsx](file:///workspace/packages/renderer/src/components/drawer/CityHome.tsx)、[backupWarnings.ts](file:///workspace/packages/renderer/src/utils/backupWarnings.ts)
- 摘要测试：[backupWarnings.test.ts](file:///workspace/packages/renderer/test/backupWarnings.test.ts)

