# ADR-0026：导入备份时对 assets 做 sha256 校验（阈值内）

## 状态

已采纳

## 背景

ADR-0025 只做了 assets 的“存在性/size”核对，仍可能遗漏 silent corruption（内容被改但大小不变）。导入阶段属于高风险窗口，适合利用 manifest 的 `sha256` 进一步验证数据完整性。

但对大量 assets 全量计算 sha256 可能导致导入耗时过长，因此需要阈值策略。

## 决策

1. 若 manifest.assets 条目包含 `sha256`：
   - 在导入 staging 阶段对前 N 条（阈值内）实际文件计算 sha256 并对比
   - 不一致时追加 warning `import_asset_sha256_mismatch`
2. 当 assets 数量超过阈值时：
   - 仅对前 N 条做 sha256 校验，并追加 warning `import_asset_sha256_validation_partial`
3. sha256 mismatch 不阻断导入（与 warnings 体系一致），但会在 UI 确认重启前提示用户风险。

## 相关实现

- 校验逻辑：[backupRestore.ts](file:///workspace/packages/app/src/main/backupRestore.ts)
- 回归测试：[backupRestoreAssetsShaValidation.test.ts](file:///workspace/packages/app/test/backupRestoreAssetsShaValidation.test.ts)

