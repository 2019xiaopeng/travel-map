# Retention Defaults & Env Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 retention 默认值集中管理，并补齐 env 无效值回退默认的回归测试与实现，确保行为稳定可预测。

**Architecture:** 在 `backupRestore.ts` 内新增统一的默认配置对象 + env 解析工具（TTL/TopK），业务逻辑只依赖该配置；测试覆盖 NaN/负数/小数/空字符串等无效输入均回退默认值。

**Tech Stack:** Node.js fs/path、node:test、TypeScript

---

## 文件结构

**修改**
- `packages/app/src/main/backupRestore.ts`
- `packages/app/test/restoreArtifactsCleanup.test.ts`

---

### Task 1: 补齐 env 无效值回退默认测试（RED）

**Files:**
- Modify: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 写 failing test：TopK 非整数应回退默认（不应误删）**

```ts
test("cleanupRestoreArtifacts falls back to defaults when env topK is invalid", async () => {
  const prevTopK = process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK;
  process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK = "1.5";

  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });
  const now = Date.now();

  for (let i = 1; i <= 8; i++) {
    const p = path.join(userDataPath, `travel-map.sqlite.bak-${i}`);
    await fs.promises.writeFile(p, "x", "utf8");
    const t = new Date(now - 10 * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  }

  try {
    await cleanupRestoreArtifacts({ userDataPath, now });
    const names = await fs.promises.readdir(userDataPath);
    // 若错误把 topK 解析为 1，会删掉很多；回退默认时应保持 8 个（仍在 TTL 内）
    assert.equal(names.filter((n) => n.startsWith("travel-map.sqlite.bak-")).length, 8);
  } finally {
    if (prevTopK === undefined) delete process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK;
    else process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK = prevTopK;
  }
});
```

- [ ] **Step 2: 写 failing test：TTL 负数/NaN 应回退默认（不应误删）**

```ts
test("cleanupRestoreArtifacts falls back to defaults when env ttl is invalid", async () => {
  const prevTtl = process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS;
  process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS = "-1";

  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });
  const now = Date.now();

  for (let i = 1; i <= 8; i++) {
    const p = path.join(userDataPath, `travel-map.sqlite.bak-${i}`);
    await fs.promises.writeFile(p, "x", "utf8");
    const t = new Date(now - 10 * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  }

  try {
    await cleanupRestoreArtifacts({ userDataPath, now });
    const names = await fs.promises.readdir(userDataPath);
    assert.equal(names.filter((n) => n.startsWith("travel-map.sqlite.bak-")).length, 8);
  } finally {
    if (prevTtl === undefined) delete process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS;
    else process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS = prevTtl;
  }
});
```

- [ ] **Step 3: 运行测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: 以上至少 1 条失败（如果当前实现已符合，也保留用例作为回归）

- [ ] **Step 4: Commit（仅测试）**

```bash
git add packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "test(app): cover invalid env fallback for cleanup retention"
```

---

### Task 2: 默认值集中 + 统一 env 回退（GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`

- [ ] **Step 1: 引入 DEFAULT_RETENTION 常量与 env 解析工具**

```ts
const DEFAULT_RETENTION = {
  failed: { ttlMs: 7 * 24 * 3600_000, topK: 3, envTtl: "TRAVEL_MAP_RETENTION_FAILED_TTL_MS", envTopK: "TRAVEL_MAP_RETENTION_FAILED_TOPK" },
  dbBak: { ttlMs: 30 * 24 * 3600_000, topK: 5, envTtl: "TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS", envTopK: "TRAVEL_MAP_RETENTION_DB_BAK_TOPK" },
  assetsBak: { ttlMs: 30 * 24 * 3600_000, topK: 3, envTtl: "TRAVEL_MAP_RETENTION_ASSETS_BAK_TTL_MS", envTopK: "TRAVEL_MAP_RETENTION_ASSETS_BAK_TOPK" },
} as const;
```

- [ ] **Step 2: cleanupRestoreArtifacts 使用 DEFAULT_RETENTION 生成 cfg（每次调用读取 env）**
  - TTL：有限数且 >=0 才接受，否则 fallback
  - TopK：整数且 >=0 才接受，否则 fallback

- [ ] **Step 3: 跑测试/构建**

Run:
- `pnpm --filter @travel-map/app test`
- `pnpm typecheck`
- `pnpm build`

Expected: PASS

- [ ] **Step 4: Commit（实现）**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "refactor(app): centralize retention defaults and env fallback"
git push origin HEAD
```

