# ADR-0019：备份导出时对 manifest 进行“实物校验”

## 状态

已采纳

## 背景

文档 [06-存储与附件规范](file:///workspace/docs/travel-map-docs/06-存储与附件规范.md) 提到“用 hash/manifest 校验完整性，减少丢图/丢附件”。如果导出时仅把数据库中的 `sha256/size` 原样写入 manifest：

- 若本地文件被手动改动/损坏，manifest 仍显示旧值，导出并不能发现问题
- 若 DB 与磁盘出现不一致，备份文件表面“正常”，但恢复后才暴雷

## 决策

1. 导出 zip 时对 Asset 表条目做实物校验：
   - 若 `assets/<...>` 文件存在：计算实际文件的 `sha256` 与 `size` 写入 manifest
   - 若与 DB 值不一致：记录 `warnings`（但仍以导出文件的实际值为准）
   - 若文件缺失/路径非法：记录 `warnings` 并保留 DB 值
2. manifest 增加 `warnings` 数组，用于在 UI/日志层提示用户导出数据存在异常。
3. 添加回归测试覆盖“DB 伪值 → manifest 以实物为准 + warnings”。

## 相关实现

- manifest 校验与写入：[backupZip.ts](file:///workspace/packages/app/src/main/backupZip.ts)
- 回归测试：[backupZipManifest.test.ts](file:///workspace/packages/app/test/backupZipManifest.test.ts)

