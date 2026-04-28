# ADR-0022：导入备份时提前展示 manifest.warnings

## 状态

已采纳

## 背景

导入备份属于高风险操作：重启后会替换当前 DB 与 assets。若导入的备份在导出时已经存在 `manifest.warnings`（例如缺失文件、hash/size 不一致），用户应该在确认重启前就能感知风险。

如果只把 warnings 留在 zip 内部或只在导出时展示，导入路径仍属于“半成品闭环”。

## 决策

1. `stageRestoreFromZip` 在 staging 完成后解析 staging 的 `manifest.json`，提取 `warnings` 并返回。
2. `file:importBackupZip` IPC 返回 `warnings` 给渲染进程。
3. UI 的“导入备份（zip）”确认弹窗中追加 warnings 摘要，提示用户谨慎重启。

## 相关实现

- warnings 提取：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- IPC 透传：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- UI 提示：[CityHome.tsx](file:///workspace/packages/renderer/src/components/drawer/CityHome.tsx)
- 回归测试：[backupRestoreWarnings.test.ts](file:///workspace/packages/app/test/backupRestoreWarnings.test.ts)

