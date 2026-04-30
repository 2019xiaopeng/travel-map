# Retention Tests & Restore Fail-safe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对齐 ADR-0038 的分组 retention 规则，补齐 .bak/.failed/symlink 的回归测试，并补齐 tx 校验失败时 staging .failed 现场保留的回归测试。

**Architecture:** 通过 node:test 先补充失败用例（RED），再最小修改 `cleanupRestoreArtifacts()` 与 tx fail-safe 分支以满足测试（GREEN），最后做小范围重构（REFACTOR）并提交 ADR（如需）。

**Tech Stack:** Node.js fs/path、node:test、TypeScript

---

## 文件结构

**修改**
- `packages/app/src/main/backupRestore.ts`
- `packages/app/test/restoreArtifactsCleanup.test.ts`
- `packages/app/test/backupRestoreTransactionalApply.test.ts`

---

### Task 1: 补齐 bak retention 测试（RED）

**Files:**
- Modify: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 追加测试：dbBak 的 TTL+Top-K**

```ts
test("cleanupRestoreArtifacts deletes old db bak beyond topK and TTL", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  const mkFile = async (name: string, ageDays: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.writeFile(p, "x", "utf8");
    const t = new Date(now - ageDays * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  };

  for (let i = 1; i <= 7; i++) {
    await mkFile(`travel-map.sqlite.bak-${i}`, 40 + (7 - i));
  }

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.has("travel-map.sqlite.bak-7"), true);
  assert.equal(names.has("travel-map.sqlite.bak-6"), true);
  assert.equal(names.has("travel-map.sqlite.bak-5"), true);
  assert.equal(names.has("travel-map.sqlite.bak-4"), true);
  assert.equal(names.has("travel-map.sqlite.bak-3"), true);
  assert.equal(names.has("travel-map.sqlite.bak-2"), false);
  assert.equal(names.has("travel-map.sqlite.bak-1"), false);
});
```

- [ ] **Step 2: 追加测试：assetsBak 的 TTL+Top-K（目录）**

```ts
test("cleanupRestoreArtifacts deletes old assets bak beyond topK and TTL", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  const mkDir = async (name: string, ageDays: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.mkdir(p, { recursive: true });
    await fs.promises.writeFile(path.join(p, "x.txt"), "x", "utf8");
    const t = new Date(now - ageDays * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  };

  for (let i = 1; i <= 5; i++) {
    await mkDir(`assets.bak-${i}`, 40 + (5 - i));
  }

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.has("assets.bak-5"), true);
  assert.equal(names.has("assets.bak-4"), true);
  assert.equal(names.has("assets.bak-3"), true);
  assert.equal(names.has("assets.bak-2"), false);
  assert.equal(names.has("assets.bak-1"), false);
});
```

- [ ] **Step 3: 追加测试：超过 Top-K 但未超过 TTL 的不删除**

```ts
test("cleanupRestoreArtifacts does not delete bak when within TTL even if beyond topK", async () => {
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

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.size, 8);
});
```

- [ ] **Step 4: 运行测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: 新增 bak 用例失败（因为目前 cleanup 对三组使用相同 TTL/TopK）

- [ ] **Step 5: Commit（仅测试）**

```bash
git add packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "test(app): expand retention coverage for bak artifacts"
```

---

### Task 2: 补齐 symlink 防护测试（RED）

**Files:**
- Modify: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 添加测试：symlink 必须跳过且不影响目标**

```ts
test("cleanupRestoreArtifacts skips symlink and does not delete external target", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outside = path.join(tmp, "outside.txt");
  await fs.promises.writeFile(outside, "DO-NOT-TOUCH", "utf8");

  const link = path.join(userDataPath, "travel-map.sqlite.bak-999");
  await fs.promises.symlink(outside, link);

  await cleanupRestoreArtifacts({ userDataPath, now: Date.now() });

  assert.equal(await fs.promises.readFile(outside, "utf8"), "DO-NOT-TOUCH");
  const st = await fs.promises.lstat(link);
  assert.equal(st.isSymbolicLink(), true);
});
```

- [ ] **Step 2: 运行测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: 若实现误删/跟随 symlink 会失败；当前应表现为 PASS（若直接 PASS 则保留该用例作为回归）

- [ ] **Step 3: Commit（测试）**

```bash
git add packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "test(app): add symlink safety coverage for cleanup"
```

---

### Task 3: 实现分组 retention（GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`
- Test: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 将 TTL/TopK 拆成分组配置**

```ts
const cfg = {
  failed: { ttlMs: 7 * 24 * 3600_000, topK: 3 },
  dbBak: { ttlMs: 30 * 24 * 3600_000, topK: 5 },
  assetsBak: { ttlMs: 30 * 24 * 3600_000, topK: 3 },
} as const;
```

- [ ] **Step 2: 清理时按组应用各自 cfg**
  - 删除条件仍为：`i >= topK && ageMs > ttlMs`

- [ ] **Step 3: 跑测试确保全部通过**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 4: Commit（实现）**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "fix(app): align restore artifacts retention with ADR-0038"
```

---

### Task 4: tx 校验失败时 staging .failed 现场保留（RED→GREEN）

**Files:**
- Modify: `packages/app/test/backupRestoreTransactionalApply.test.ts`
- Modify: `packages/app/src/main/backupRestore.ts`

- [ ] **Step 1: 写 failing test：tx paths 越界时 staging 被重命名为 .failed**

```ts
test("applyPendingRestoreIfPresent preserves staging as .failed when tx paths are invalid", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "db", "utf8");

  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
  await writeJson(path.join(userDataPath, "restore-transaction.json"), {
    version: 1,
    now: 1,
    stagingPath,
    phase: "db_swapped",
    paths: {
      currentDb: path.join(tmp, "outside.sqlite"),
      currentAssets: path.join(tmp, "outside-assets"),
      dbBak: path.join(tmp, "outside-bak"),
      assetsBak: path.join(tmp, "outside-assets-bak"),
    },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(stagingPath), false);
  const names = await fs.promises.readdir(userDataPath);
  assert.equal(names.some((n) => n.startsWith("restore-staging-1.failed")), true);
});
```

- [ ] **Step 2: 跑测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: FAIL（当前 fail-safe 可能只删 tx 不做 failed 保留）

- [ ] **Step 3: 实现 fail-safe：校验失败时 rename staging -> *.failed**
  - 仅当 stagingPath 合法且存在时尝试重命名
  - 无论成功失败，都应删除 tx 并尽力删除 pending

- [ ] **Step 4: 跑测试确保通过（GREEN）**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/backupRestoreTransactionalApply.test.ts
git commit -m "fix(app): preserve staging as failed on tx validation failure"
```

---

### Task 5: 最终回归与 push

- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm -r test`
- [ ] Run: `pnpm build`
- [ ] Push: `git push origin HEAD`

