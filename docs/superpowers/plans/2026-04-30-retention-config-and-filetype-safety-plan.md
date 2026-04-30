# Retention Config & Filetype Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 restore 产物清理增加 env 可配置参数，并对非普通文件类型（socket/pipe/device）做防御式跳过，补齐回归测试。

**Architecture:** `cleanupRestoreArtifacts()` 每次调用读取 env 配置（默认值不变），lstat 后仅接受预期类型（dbBak=file、assetsBak/failed=dir、symlink/其他类型跳过）。测试用例覆盖 env 覆盖与 unix socket 文件跳过。

**Tech Stack:** Node.js fs/path/net、node:test、TypeScript

---

## 文件结构

**修改**
- `packages/app/src/main/backupRestore.ts`
- `packages/app/test/restoreArtifactsCleanup.test.ts`

---

### Task 1: env 覆盖测试（RED）

**Files:**
- Modify: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 添加用例：env 覆盖使 dbBak 全部删除（TopK=0 + TTL=1ms）**

```ts
test("cleanupRestoreArtifacts supports env overrides for dbBak retention", async () => {
  const prevTtl = process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS;
  const prevTopK = process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK;
  process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS = "1";
  process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK = "0";

  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });
  const now = Date.now();

  const mkFile = async (name: string, ageMs: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.writeFile(p, "x", "utf8");
    const t = new Date(now - ageMs);
    await fs.promises.utimes(p, t, t);
  };

  await mkFile("travel-map.sqlite.bak-1", 10);
  await mkFile("travel-map.sqlite.bak-2", 10);

  try {
    await cleanupRestoreArtifacts({ userDataPath, now });
    const names = await fs.promises.readdir(userDataPath);
    assert.equal(names.some((n) => n.startsWith("travel-map.sqlite.bak-")), false);
  } finally {
    if (prevTtl === undefined) delete process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS;
    else process.env.TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS = prevTtl;
    if (prevTopK === undefined) delete process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK;
    else process.env.TRAVEL_MAP_RETENTION_DB_BAK_TOPK = prevTopK;
  }
});
```

- [ ] **Step 2: 跑测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: FAIL（当前 cleanup 不读取 env）

- [ ] **Step 3: Commit（仅测试）**

```bash
git add packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "test(app): cover env overrides for cleanup retention"
```

---

### Task 2: filetype 安全测试（RED）

**Files:**
- Modify: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 添加用例：unix socket（命名为 dbBak）应被跳过**

```ts
import net from "node:net";

test("cleanupRestoreArtifacts skips unix socket even if name matches dbBak pattern", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const sockPath = path.join(userDataPath, "travel-map.sqlite.bak-999");
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(sockPath, () => resolve());
  });
  server.close();

  await cleanupRestoreArtifacts({ userDataPath, now: Date.now() });

  const st = await fs.promises.lstat(sockPath);
  assert.equal(st.isSocket(), true);
});
```

- [ ] **Step 2: 跑测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: FAIL（当前实现可能会尝试 rm socket）

- [ ] **Step 3: Commit（仅测试）**

```bash
git add packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "test(app): cover non-regular filetype safety in cleanup"
```

---

### Task 3: 实现 env 覆盖 + 文件类型跳过（GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`
- Test: `packages/app/test/restoreArtifactsCleanup.test.ts`

- [ ] **Step 1: 增加 env 解析工具函数（TTL/TopK）**

```ts
function envMs(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}
function envInt(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && Number.isInteger(v) && v >= 0 ? v : fallback;
}
```

- [ ] **Step 2: cleanupRestoreArtifacts 内按 env 覆盖 cfg**
  - 逐组读取 env（见 ADR-0039）

- [ ] **Step 3: 基于 lstat 过滤类型**
  - symlink：跳过
  - failed/assetsBak：必须目录
  - dbBak：必须普通文件
  - 其他类型：跳过

- [ ] **Step 4: 跑测试确保通过**

Run:
- `pnpm --filter @travel-map/app test`
- `pnpm typecheck`
- `pnpm build`

Expected: PASS

- [ ] **Step 5: Commit（实现）**

```bash
git add packages/app/src/main/backupRestore.ts packages/app/test/restoreArtifactsCleanup.test.ts
git commit -m "fix(app): make cleanup retention configurable and filetype-safe"
git push origin HEAD
```

