# ADR-0028：高风险 warnings 增加样例行以便定位

## 状态

已采纳

## 背景

ADR-0027 将 warnings 按风险分组后，用户能快速看到“哪个类型有多少条”。但仅有统计仍不够：

- 用户无法定位具体缺了哪个文件 / 哪个 asset 校验失败
- 需要再打开 zip 或手工排查，体验割裂

## 决策

1. 对高风险类型的 warnings 在摘要中增加 1–3 条样例行（asset_id + path/message）：
   - `import_missing_asset`
   - `import_asset_sha256_mismatch`
   - `import_asset_size_mismatch`
2. 样例行属于辅助信息，不替代完整清单；超出数量的仍用统计展示。
3. 用纯函数生成摘要并用测试保障格式稳定。

## 相关实现

- 摘要生成：[backupWarnings.ts](file:///workspace/packages/renderer/src/utils/backupWarnings.ts)
- 测试：[backupWarningsGrouped.test.ts](file:///workspace/packages/renderer/test/backupWarningsGrouped.test.ts)

