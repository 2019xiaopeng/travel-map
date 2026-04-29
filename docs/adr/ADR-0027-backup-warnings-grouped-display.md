# ADR-0027：备份 warnings 在 UI 中按风险分组展示

## 状态

已采纳

## 背景

随着 ADR-0023/0024/0025/0026 引入更多导入校验项，warnings 类型增多。如果仍按“逐条列出前几条”展示：

- 用户难以快速判断风险级别
- 容易被低风险提示淹没，忽略缺失文件 / sha256 不一致等高风险问题

## 决策

1. 在 UI 文案中把 warnings 按风险分组展示：
   - 高风险：`import_missing_asset` / `import_asset_sha256_mismatch` / `import_asset_size_mismatch`
   - 其他：按类型统计展示
2. 摘要逻辑抽为纯函数并加入测试，避免 UI 分散拼接。
3. 导出/导入提示统一使用分组摘要，若无分组输出再回退到原始摘要。

## 相关实现

- 分组摘要：[backupWarnings.ts](file:///workspace/packages/renderer/src/utils/backupWarnings.ts)
- 回归测试：[backupWarningsGrouped.test.ts](file:///workspace/packages/renderer/test/backupWarningsGrouped.test.ts)
- UI 应用：[CityHome.tsx](file:///workspace/packages/renderer/src/components/drawer/CityHome.tsx)

