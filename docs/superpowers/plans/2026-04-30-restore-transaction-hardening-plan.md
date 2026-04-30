# Restore Transaction Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将备份恢复的 apply 事务状态机补齐“更多崩溃点/坏状态”的自愈与回归测试，确保不会出现半交换、不会卡死、不会无界残留。

**Architecture:** 以 `restore-transaction.json` 为恢复锚点，按 `phase` 推进并在每一步原子落盘；在每个 phase 做磁盘状态一致性判定，决定“继续/回滚/失败保留现场”。

**Tech Stack:** Node.js fs/path、yauzl/yazl、node:test、TypeScript

---

## 文件结构

**修改**
- `packages/app/src/main/backupRestore.ts`

**新增/修改测试**
- `packages/app/test/backupRestoreTransactionalApply.test.ts`（扩展崩溃矩阵）

**文档**
- Create: `docs/adr/ADR-0036-backup-restore-transaction-recovery-matrix.md`
- Modify: `docs/adr/README.md`

---

### Task 1: 扩展事务恢复的崩溃矩阵测试（RED）

**Files:**
- Modify: `packages/app/test/backupRestoreTransactionalApply.test.ts`

- [ ] **Step 1: 添加测试工具函数（仅测试内）**

```ts
async function writeJson(p: string, v: any) {
  await fs.promises.writeFile(p, JSON.stringify(v, null, 2), "utf8");
}

async function writePending(userDataPath: string, stagingPath: string) {
  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
}

async function writeTx(userDataPath: string, tx: any) {
  await writeJson(path.join(userDataPath, "restore-transaction.json"), tx);
}
```

- [ ] **Step 2: 增加崩溃点：phase=backed_up**

```ts
test("applyPendingRestoreIfPresent recovers from phase=backed_up and completes swap", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  const currentDb = path.join(userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(currentAssets, "cities/old"), { recursive: true });
  await fs.promises.writeFile(currentDb, "old-db");
  await fs.promises.writeFile(path.join(currentAssets, "cities/old/a.txt"), "old");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  const stagedDb = path.join(stagingPath, "travel-map.sqlite");
  const stagedAssets = path.join(stagingPath, "assets");
  await fs.promises.mkdir(path.join(stagedAssets, "cities/new"), { recursive: true });
  await fs.promises.writeFile(stagedDb, "new-db");
  await fs.promises.writeFile(path.join(stagedAssets, "cities/new/b.txt"), "new");

  const now = 2;
  const dbBak = `${currentDb}.bak-${now}`;
  const assetsBak = path.join(userDataPath, `assets.bak-${now}`);
  await fs.promises.rename(currentDb, dbBak);
  await fs.promises.rename(currentAssets, assetsBak);

  await writePending(userDataPath, stagingPath);
  await writeTx(userDataPath, {
    version: 1,
    now,
    stagingPath,
    phase: "backed_up",
    paths: { currentDb, currentAssets, dbBak, assetsBak },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 3 });
  assert.equal(applied, true);
  assert.equal(await fs.promises.readFile(currentDb, "utf8"), "new-db");
  assert.equal(fs.existsSync(path.join(currentAssets, "cities/new/b.txt")), true);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});
```

- [ ] **Step 3: 增加崩溃点：phase=assets_swapped（pending 未删除）**

```ts
test("applyPendingRestoreIfPresent recovers from phase=assets_swapped and commits/cleans", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  const currentDb = path.join(userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(currentAssets, "cities/new"), { recursive: true });
  await fs.promises.writeFile(currentDb, "new-db");
  await fs.promises.writeFile(path.join(currentAssets, "cities/new/b.txt"), "new");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });

  await writePending(userDataPath, stagingPath);
  await writeTx(userDataPath, {
    version: 1,
    now: 2,
    stagingPath,
    phase: "assets_swapped",
    paths: { currentDb, currentAssets, dbBak: `${currentDb}.bak-2`, assetsBak: path.join(userDataPath, "assets.bak-2") },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 3 });
  assert.equal(applied, true);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});
```

- [ ] **Step 4: 增加坏状态：transaction 损坏 JSON**

```ts
test("applyPendingRestoreIfPresent clears invalid restore-transaction.json and does not crash", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });
  const txPath = path.join(userDataPath, "restore-transaction.json");
  await fs.promises.writeFile(txPath, "{", "utf8");

  const res = await applyPendingRestoreIfPresent({ userDataPath, now: 1 });
  assert.equal(res, false);
  assert.equal(fs.existsSync(txPath), false);
});
```

- [ ] **Step 5: 运行测试并确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`

Expected:
- 新增测试至少 1 条失败（因为当前 applyRestoreTransaction 尚未覆盖这些 phase/坏状态的完整逻辑）

- [ ] **Step 6: Commit（仅测试）**

```bash
git add packages/app/test/backupRestoreTransactionalApply.test.ts
git commit -m "test(app): expand transactional restore crash matrix"
```

---

### Task 2: 实现 phase=backed_up / assets_swapped 的自愈（GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`
- Test: `packages/app/test/backupRestoreTransactionalApply.test.ts`

- [ ] **Step 1: 让 phase=backed_up 可推进**
  - 若 `currentDb` 不存在且 `stagedDb` 存在：rename staged→current
  - 若 `currentAssets` 不存在且 `stagedAssets` 存在：后续在 `db_swapped` 再 swap
  - 若 staged 缺失但 bak 存在：走回滚并清理 tx/pending（返回 false）

- [ ] **Step 2: 让 phase=assets_swapped 自动 commit/clean**
  - 删除 pending（忽略 ENOENT）
  - rm staging（忽略错误）
  - 删除 tx（忽略错误）
  - 返回 true

- [ ] **Step 3: 对 transaction JSON 读取失败的行为对齐测试**
  - 读取失败：删除 tx，返回 false（不抛异常）

- [ ] **Step 4: 运行测试并确保全部通过**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 5: Commit（实现）**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/backupRestoreTransactionalApply.test.ts
git commit -m "fix(app): improve transactional restore recovery phases"
```

---

### Task 3: 增加“磁盘状态一致性判定”与更严格的回滚触发（REFACTOR）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`
- Modify: `packages/app/test/backupRestoreTransactionalApply.test.ts`

- [ ] **Step 1: 提取状态探测函数**

```ts
function exists(p: string) { return fs.existsSync(p); }
type DiskState = { hasCurrentDb: boolean; hasCurrentAssets: boolean; hasStagedDb: boolean; hasStagedAssets: boolean; hasDbBak: boolean; hasAssetsBak: boolean; };
```

- [ ] **Step 2: 在每个 phase 进入前做一致性检查**
  - `db_swapped` 阶段：若 currentDb 存在但 currentAssets 也存在且 stagedAssets 也存在，优先继续 assets swap（而不是直接标记 assets_swapped）
  - `assets_swapped` 阶段：若 pending 仍存在则 commit；若 staging 仍存在则 clean

- [ ] **Step 3: 补 1 条测试覆盖“db_swapped 时 currentAssets 还在（旧）但 stagedAssets 也在”**

Expected: 能继续 swap 到新 assets 并完成。

- [ ] **Step 4: 跑测试**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/backupRestoreTransactionalApply.test.ts
git commit -m "refactor(app): tighten transactional restore disk-state checks"
```

---

### Task 4: 写 ADR-0036（恢复矩阵与自愈规则）并 push

**Files:**
- Create: `docs/adr/ADR-0036-backup-restore-transaction-recovery-matrix.md`
- Modify: `docs/adr/README.md`

- [ ] **Step 1: 写 ADR-0036**
  - 列出 phase × 磁盘状态 → 行为（继续/回滚/失败保留现场）
  - 明确“不一致优先回滚”的规则

- [ ] **Step 2: 更新 ADR 索引并提交**

```bash
git add docs/adr/ADR-0036-backup-restore-transaction-recovery-matrix.md docs/adr/README.md
git commit -m "docs: add ADR for restore transaction recovery matrix"
git push origin HEAD
```

