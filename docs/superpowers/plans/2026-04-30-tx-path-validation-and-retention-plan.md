# Tx Path Validation & Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 强化 restore-transaction 的路径信任边界并加入 userData 目录的 restore 产物保留清理策略，确保安全、幂等、长期可维护。

**Architecture:** 在 `applyRestoreTransaction()` 中强制 current 路径固定、对 bak 路径做 userData 约束与前缀白名单校验；新增 `cleanupRestoreArtifacts()` 在启动时 apply 完成后执行，按 TTL+Top-K 清理 `.bak-*`/`.failed*`，并拒绝 symlink。

**Tech Stack:** Node.js fs/path、node:test、TypeScript

---

## 文件结构

**修改**
- `packages/app/src/main/backupRestore.ts`
- `packages/app/src/main/index.ts`

**新增/修改测试**
- `packages/app/test/backupRestoreTransactionalApply.test.ts`（新增 tx 越界与非法 phase 测试）
- Create: `packages/app/test/restoreArtifactsCleanup.test.ts`

---

### Task 1: Transaction 路径校验（测试先行，RED）

**Files:**
- Modify: `packages/app/test/backupRestoreTransactionalApply.test.ts`

- [ ] **Step 1: 写 failing test：tx.paths 越界不会触碰越界路径**

```ts
test("applyPendingRestoreIfPresent rejects tx paths outside userData and does not touch external files", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outsideDir = path.join(tmp, "outside");
  await fs.promises.mkdir(outsideDir, { recursive: true });
  const outsideFile = path.join(outsideDir, "outside.sqlite");
  await fs.promises.writeFile(outsideFile, "DO-NOT-TOUCH", "utf8");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "new-db", "utf8");

  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
  await writeJson(path.join(userDataPath, "restore-transaction.json"), {
    version: 1,
    now: 1,
    stagingPath,
    phase: "db_swapped",
    paths: {
      currentDb: outsideFile,
      currentAssets: path.join(tmp, "outside-assets"),
      dbBak: path.join(tmp, "outside-bak"),
      assetsBak: path.join(tmp, "outside-assets-bak"),
    },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, false);
  assert.equal(await fs.promises.readFile(outsideFile, "utf8"), "DO-NOT-TOUCH");
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});
```

- [ ] **Step 2: 写 failing test：tx.phase 非法时清理 tx 并返回 false**

```ts
test("applyPendingRestoreIfPresent clears tx when phase is invalid", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "db", "utf8");

  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
  await writeJson(path.join(userDataPath, "restore-transaction.json"), { version: 1, now: 1, stagingPath, phase: "unknown" });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});
```

- [ ] **Step 3: 跑测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: 上述至少 1 条测试失败（因为当前 tx.paths 仍会被信任/phase 未校验）

- [ ] **Step 4: Commit（仅测试）**

```bash
git add packages/app/test/backupRestoreTransactionalApply.test.ts
git commit -m "test(app): add tx path/phase validation cases"
```

---

### Task 2: Transaction 路径强校验实现（GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`
- Test: `packages/app/test/backupRestoreTransactionalApply.test.ts`

- [ ] **Step 1: 固定 currentDb/currentAssets**

```ts
const currentDb = path.join(input.userDataPath, "travel-map.sqlite");
const currentAssets = path.join(input.userDataPath, "assets");
```

- [ ] **Step 2: 校验 dbBak/assetsBak 位于 userData 且前缀白名单**

```ts
function isUnder(base: string, p: string) {
  const b = path.resolve(base);
  const r = path.resolve(p);
  return r === b || r.startsWith(b + path.sep);
}

function validateBakPath(kind: "db" | "assets", userDataPath: string, p: string) {
  if (!p) return null;
  if (!isUnder(userDataPath, p)) return null;
  const base = path.basename(p);
  if (kind === "db" && !base.startsWith("travel-map.sqlite.bak-")) return null;
  if (kind === "assets" && !base.startsWith("assets.bak-")) return null;
  return p;
}
```

- [ ] **Step 3: 校验 tx.version/tx.phase 白名单**

```ts
const allowed = new Set(["init", "backed_up", "db_swapped", "assets_swapped", "committed", "cleaned"]);
if (tx.version !== 1 || !allowed.has(String(tx.phase))) { /* unlink tx; maybe unlink pending; return false */ }
```

- [ ] **Step 4: bak/symlink 处理**
  - 对候选 bak path 做 `lstat`，若为 symlink 则判无效并 fail-safe

- [ ] **Step 5: 跑测试确保通过**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/backupRestoreTransactionalApply.test.ts
git commit -m "fix(app): enforce tx path trust boundary"
```

---

### Task 3: 恢复产物 retention 清理（测试先行，RED）

**Files:**
- Create: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 写 failing test：按 Top-K 清理 .failed**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { cleanupRestoreArtifacts } from "../src/main/backupRestore.ts";

test("cleanupRestoreArtifacts keeps only latest failed dirs", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  const mk = async (name: string, ageMs: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.mkdir(p, { recursive: true });
    const t = new Date(now - ageMs);
    await fs.promises.utimes(p, t, t);
  };
  await mk("restore-staging-1.failed", 10 * 24 * 3600_000);
  await mk("restore-staging-2.failed", 9 * 24 * 3600_000);
  await mk("restore-staging-3.failed", 8 * 24 * 3600_000);
  await mk("restore-staging-4.failed", 7 * 24 * 3600_000);

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.has("restore-staging-4.failed"), true);
  assert.equal(names.has("restore-staging-3.failed"), true);
  assert.equal(names.has("restore-staging-2.failed"), true);
  assert.equal(names.has("restore-staging-1.failed"), false);
});
```

- [ ] **Step 2: 跑测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: FAIL（因为 cleanupRestoreArtifacts 尚不存在）

- [ ] **Step 3: Commit（仅测试）**

```bash
git add packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "test(app): add retention cleanup cases"
```

---

### Task 4: 实现 cleanupRestoreArtifacts 并挂载启动 Hook（GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`
- Modify: `packages/app/src/main/index.ts`
- Test: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 导出 cleanupRestoreArtifacts（仅清理白名单模式）**

```ts
export async function cleanupRestoreArtifacts(input: { userDataPath: string; now: number }) {
  // if pending/tx exists: return
  // readdir userData top-level
  // lstat reject symlink
  // group: failed/dbBak/assetsBak
  // sort by mtime desc
  // delete items older than TTL AND beyond Top-K
}
```

- [ ] **Step 2: 在启动时调用**

在 `packages/app/src/main/index.ts` 的 `applyPendingRestoreIfPresent(...)` 之后、`initDb()` 之前插入：

```ts
await cleanupRestoreArtifacts({ userDataPath, now: Date.now() });
```

- [ ] **Step 3: 跑测试/构建**

Run:
- `pnpm --filter @travel-map/app test`
- `pnpm typecheck`
- `pnpm build`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/src/main/index.ts packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "feat(app): cleanup restore artifacts with retention policy"
```

---

### Task 5: 并行 sub-agent 审核与最终回归

**Review:**
- [ ] 并行 sub-agent 复核：tx 校验边界是否还有越界点、清理策略是否会误删
- [ ] 主分支全套验证：`pnpm typecheck && pnpm -r test && pnpm build`
- [ ] Push：`git push origin HEAD`

