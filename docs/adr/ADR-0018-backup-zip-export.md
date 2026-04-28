# ADR-0018：Zip 全量导出（manifest.json + db.sqlite + assets/）

## 状态

已采纳

## 背景

文档 [06-存储与附件规范](file:///workspace/docs/travel-map-docs/06-存储与附件规范.md#L105-L121) 定义了备份导出的最小结构：

```text
backup.zip
├── manifest.json
├── db.sqlite
└── assets/
    └── ...
```

此前代码中没有任何可触达的导出能力（无 IPC、无 UI 入口），属于“文档写了但功能缺失”的典型半成品。

## 决策

1. 在主进程提供导出 IPC：`file:exportBackupZip`
   - 弹出保存对话框选择 zip 目标路径
   - 使用 SQLite 快照导出（`better-sqlite3` 的 `backup()`）生成一致性的 `db.sqlite` 文件
2. Zip 内容与 manifest 最小字段：
   - `manifest.json`：导出时间、应用版本、db sha256、assets 列表（asset_id/sha256/relative_path/size/remote_url）
   - `assets/`：遍历打包 `userData/assets` 子树所有文件
3. 关键 zip 生成逻辑抽为可测试函数，并使用 `yazl` 创建 zip、`yauzl` 在测试中验证条目存在。
4. 在 CityHome 增加按钮入口“导出备份（zip）”，确保功能可触达而不是仅存在 IPC。

## 相关实现

- Zip 生成与 manifest：[backupZip.ts](file:///workspace/packages/app/src/main/backupZip.ts)
- IPC 与 DB 快照：[ipc.ts](file:///workspace/packages/app/src/main/ipc.ts)
- UI 入口：[CityHome.tsx](file:///workspace/packages/renderer/src/components/drawer/CityHome.tsx)
- 回归测试：[backupZip.test.ts](file:///workspace/packages/app/test/backupZip.test.ts)

