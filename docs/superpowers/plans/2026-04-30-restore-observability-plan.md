# Restore Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 restore/apply/cleanup 增加本地结构化日志（JSONL）与诊断包导出（JSON），并提供 IPC + UI 一键导出入口，同时保证不泄露绝对路径与用户内容。

**Architecture:** main 进程新增 `restoreDiagnostics` 模块：写日志（带轮转）+ 内存 ring buffer + 原子导出诊断包；在 backupRestore 的关键阶段打点；通过 IPC 暴露导出/打开文件夹；renderer 增加一个简单入口触发导出并打开目录。

**Tech Stack:** Node.js fs/path/os、node:test、Electron ipcMain/contextBridge、TypeScript

---

## 文件结构

**新增**
- `packages/app/src/main/diagnostics/restoreDiagnostics.ts`
- `packages/app/test/restoreDiagnostics.test.ts`

**修改**
- `packages/app/src/main/backupRestore.ts`
- `packages/app/src/main/index.ts`
- `packages/app/src/main/ipc.ts`
- `packages/app/src/preload/index.ts`
- `packages/renderer/src/services/file.ts`（或对应 wrapper 文件）
- `packages/renderer/src/components/drawer/CityHome.tsx`（增加入口按钮）

---

### Task 1: restoreDiagnostics 模块测试（RED）

**Files:**
- Create: `packages/app/test/restoreDiagnostics.test.ts`

- [ ] **Step 1: 写 failing test：日志不包含绝对路径且为 JSONL**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { initRestoreDiagnostics, logRestoreEvent, getRestoreLogRelativePath } from "../src/main/diagnostics/restoreDiagnostics.ts";

test("restoreDiagnostics writes JSONL and never writes absolute paths", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });

  const abs = path.join(userDataPath, "restore-staging-1.failed");
  logRestoreEvent({ level: "info", event: "test", paths: [abs] });

  await new Promise((r) => setTimeout(r, 20));
  const logPath = path.join(userDataPath, getRestoreLogRelativePath());
  const content = await fs.promises.readFile(logPath, "utf8");
  assert.equal(content.includes(userDataPath), false);
  const line = content.trim().split("\n").slice(-1)[0];
  const parsed = JSON.parse(line);
  assert.deepEqual(parsed.paths, ["restore-staging-1.failed"]);
});
```

- [ ] **Step 2: 写 failing test：超过阈值触发轮转**

```ts
import { setRestoreLogMaxBytesForTest } from "../src/main/diagnostics/restoreDiagnostics.ts";

test("restoreDiagnostics rotates restore.log when exceeding size limit", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  setRestoreLogMaxBytesForTest(200);

  for (let i = 0; i < 50; i++) logRestoreEvent({ level: "info", event: "spam", meta: { i } });
  await new Promise((r) => setTimeout(r, 50));

  const rotated = path.join(userDataPath, "logs/restore.log.1");
  assert.equal(fs.existsSync(rotated), true);
});
```

- [ ] **Step 3: 写 failing test：导出诊断包包含 recent_events**

```ts
import { exportRestoreDiagnostic } from "../src/main/diagnostics/restoreDiagnostics.ts";

test("exportRestoreDiagnostic writes json with recent_events", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  logRestoreEvent({ level: "info", event: "e1" });
  const r = await exportRestoreDiagnostic({ reason: "test" });
  assert.equal(r.ok, true);

  const abs = path.join(userDataPath, r.relativePath);
  const json = JSON.parse(await fs.promises.readFile(abs, "utf8"));
  assert.equal(Array.isArray(json.recent_events), true);
  assert.equal(json.recent_events.some((x: any) => x.event === "e1"), true);
});
```

- [ ] **Step 4: 运行测试确认失败（RED）**

Run: `pnpm --filter @travel-map/app test`
Expected: FAIL（模块不存在）

- [ ] **Step 5: Commit（仅测试）**

```bash
git add packages/app/test/restoreDiagnostics.test.ts
git commit -m "test(app): add restore diagnostics tests"
```

---

### Task 2: 实现 restoreDiagnostics 模块（GREEN）

**Files:**
- Create: `packages/app/src/main/diagnostics/restoreDiagnostics.ts`
- Test: `packages/app/test/restoreDiagnostics.test.ts`

- [ ] **Step 1: 实现 init + ring buffer + JSONL 写入**
- [ ] **Step 2: 实现路径脱敏（只输出相对 userDataPath）**
- [ ] **Step 3: 实现日志轮转（1MiB，保留 3 份；提供 test 覆盖的 setter）**
- [ ] **Step 4: 实现 exportRestoreDiagnostic（原子写，返回相对路径）**
- [ ] **Step 5: 运行测试确保通过**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 6: Commit（实现）**

```bash
git add packages/app/src/main/diagnostics/restoreDiagnostics.ts packages/app/test/restoreDiagnostics.test.ts
git commit -m "feat(app): add restore diagnostics logger and export"
```

---

### Task 3: 接入 restore/apply/cleanup（RED→GREEN）

**Files:**
- Modify: `packages/app/src/main/backupRestore.ts`

- [ ] **Step 1: 在 applyPendingRestoreIfPresent/applyRestoreTransaction 关键节点打点**
  - start/success/fail + phase
  - fail-safe：staging -> failed、tx/pending 清理
- [ ] **Step 2: 在 cleanupRestoreArtifacts 打点**
  - start/done/fail + 删除/跳过计数 + retention cfg
- [ ] **Step 3: 跑 app tests**

Run: `pnpm --filter @travel-map/app test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main/backupRestore.ts
git commit -m "feat(app): add restore observability events"
```

---

### Task 4: IPC + preload + renderer 入口（导出 + 打开目录）

**Files:**
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/renderer/src/services/file.ts`（或对应 wrapper）
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`

- [ ] **Step 1: main 增加 IPC**
  - `diagnostics:exportRestoreDiagnostic`
  - `diagnostics:reveal`（限制只能打开 `diagnostics/` 与 `logs/` 下）
- [ ] **Step 2: preload 暴露到 renderer**
- [ ] **Step 3: renderer 增加“导出诊断”入口并 toast 提示**
  - 成功：toast 显示 `diagnostics/...json`，并调用 reveal 打开
  - 失败：toast 显示失败信息（不含敏感细节）
- [ ] **Step 4: 跑 renderer tests + build**

Run:
- `pnpm --filter @travel-map/renderer test`
- `pnpm build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/renderer/src/services packages/renderer/src/components/drawer/CityHome.tsx
git commit -m "feat: export restore diagnostics from UI"
```

---

### Task 5: 最终回归与 push

- [ ] Run: `pnpm typecheck`
- [ ] Run: `pnpm -r --if-present test`
- [ ] Run: `pnpm build`
- [ ] Push: `git push origin HEAD`

