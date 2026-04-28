# ADR-0021：备份 zip 的导入与启动时恢复

## 状态

已采纳

## 背景

此前只实现了导出（ADR-0018/0019/0020），属于“只做了一半”的备份链路：用户无法把备份恢复回来。

恢复的关键约束：

- 当前进程启动后 DB 已被打开，导入时直接覆盖会导致锁冲突/不一致
- 需要避免误覆盖导致数据不可逆丢失

## 决策

1. 导入阶段只做“落地与标记”，不直接替换：
   - 选择 zip → 解压到 `userData/restore-staging-<ts>`（包含 `travel-map.sqlite` 与 `assets/`）
   - 写入 `userData/restore-pending.json` 作为启动时恢复标记
2. 启动阶段在 `initDb()` 之前应用恢复：
   - 把现有 `travel-map.sqlite` 与 `assets/` 分别移动到 `.bak-<ts>` 备份位置
   - 把 staging 内容移动到正式位置
   - 删除 pending 标记
3. UI 入口在 CityHome 提供“导入备份（zip）”，导入完成后引导用户重启（可一键重启）。
4. 核心流程提供回归测试：
   - staging 解压与 pending 写入
   - 启动时替换与备份生成

## 相关实现

- staging 与启动替换：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 启动时应用恢复：[index.ts](file:///workspace/packages/app/src/main/index.ts)
- IPC 与重启：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)、[preload/index.ts](file:///workspace/packages/app/src/preload/index.ts)
- UI 入口：[CityHome.tsx](file:///workspace/packages/renderer/src/components/drawer/CityHome.tsx)
- 回归测试：[backupRestorePlan.test.ts](file:///workspace/packages/app/test/backupRestorePlan.test.ts)、[applyRestore.test.ts](file:///workspace/packages/app/test/applyRestore.test.ts)

