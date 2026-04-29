# ADR-0025：导入备份时对 assets 做“清单核对”校验

## 状态

已采纳

## 背景

导入备份 zip 时即使 db.sqlite 完整，assets 仍可能出现：

- zip 内缺文件（导出/传输/解压过程中丢失）
- 文件 size 与 manifest 不一致（损坏或不完整）

如果不在导入阶段校验，用户会在重启恢复后才发现“图片缺失/附件打不开”，属于高成本问题。

## 决策

1. 若 manifest 存在且包含 `assets` 数组：
   - 对每个条目的 `relative_path`（要求以 `assets/` 开头）检查 zip 解压后的 staging 是否存在该文件
   - 如果存在且 manifest 有 `size`：核对文件大小是否一致
2. 校验结果不阻断导入（除非 db_sha256 mismatch），以 warnings 形式返回并在 UI 确认重启前提示。
3. 为避免极端大备份阻塞导入，校验条目数量超过阈值时跳过并记录 warnings。
4. 添加回归测试覆盖“清单声明了 asset 但 zip 缺文件 → 返回 warnings”。

## 相关实现

- 校验逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 回归测试：[backupRestoreAssetsValidation.test.ts](file:///workspace/packages/app/test/backupRestoreAssetsValidation.test.ts)

