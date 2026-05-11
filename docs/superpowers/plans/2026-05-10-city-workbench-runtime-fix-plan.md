# City Workbench Runtime Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the city workbench runtime so visit-state updates, quick import, city assets, and trip creation work reliably in Electron without hidden initialization requirements.

**Architecture:** Move city/province initialization into explicit main-process helpers, then call those helpers from every write path that depends on `City` existence. Replace renderer-side file-path guessing with main-process file selection, and tighten renderer error states so runtime failures, data failures, and empty states are visibly distinct.

**Tech Stack:** Electron, React, TypeScript, better-sqlite3, SQLite IPC, Node test runner

---

## File Map

- Modify: `packages/app/src/main/ipc.ts`
  - Add reusable `ensureProvinceExists` / `ensureCityExists`
  - Extend `file:select` to support multi-file and general filters
  - Make `db:updateCityVisitState`, `db:createTrip`, and `file:saveCityAsset` explicitly ensure city rows exist
- Modify: `packages/app/src/preload/index.ts`
  - Expose expanded file-selection IPC API
- Modify: `packages/renderer/src/vite-env.d.ts`
  - Update renderer typings for file selection and runtime checks
- Modify: `packages/renderer/src/services/db.ts`
  - Pass explicit city context into write APIs that need `ensureCityExists`
- Create: `packages/renderer/src/services/runtime.ts`
  - Centralize `window.travelMap` capability checks and readable runtime errors
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`
  - Use runtime guard
  - Replace `input[type=file]` quick-import path with main-process file selection
  - Improve state update and import feedback
- Modify: `packages/renderer/src/components/drawer/TripList.tsx`
  - Show create-trip pending/failed states
- Modify: `packages/renderer/src/components/drawer/CityAssets.tsx`
  - Distinguish runtime/data/empty states
- Test: `packages/app/test/cityWorkbenchRuntime.test.ts`
  - Verify `ensureCityExists` behavior through public IPC-adjacent helpers
- Test: `packages/renderer/test/runtime.test.ts`
  - Verify runtime guard messages
- Test: `packages/renderer/test/tripList.test.tsx` or `packages/renderer/test/tripList.test.ts`
  - Verify create failure feedback logic

## Task 1: Main-Process City Initialization

**Files:**
- Modify: `packages/app/src/main/ipc.ts`
- Test: `packages/app/test/cityWorkbenchRuntime.test.ts`

- [ ] **Step 1: Write the failing tests for explicit city initialization**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SCHEMA_V1 } from "../src/main/db/schema.ts";
import {
  ensureCityExists,
  updateCityVisitStateRecord,
  createTripRecord,
} from "../src/main/ipc.ts";

function createDb() {
  const db = new Database(":memory:");
  db.exec(SCHEMA_V1);
  return db;
}

test("updateCityVisitStateRecord creates missing province/city rows", () => {
  const db = createDb();
  updateCityVisitStateRecord(db, {
    provinceId: "330000",
    provinceName: "浙江省",
    cityId: "330100",
    cityName: "杭州市",
    visitState: "wishlist",
  });

  const city = db.prepare("SELECT province_id, name, visit_state FROM City WHERE city_id = ?").get("330100") as any;
  assert.equal(city.province_id, "330000");
  assert.equal(city.name, "杭州市");
  assert.equal(city.visit_state, "wishlist");
});

test("ensureCityExists does not overwrite user summary or cover", () => {
  const db = createDb();
  db.prepare("INSERT INTO Province (province_id, name) VALUES (?, ?)").run("330000", "旧省名");
  db.prepare(
    "INSERT INTO City (city_id, province_id, name, visit_state, summary, cover_asset_id) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("330100", "330000", "旧城市", "visited", "用户摘要", "cover-1");

  ensureCityExists(db, {
    provinceId: "330000",
    provinceName: "浙江省",
    cityId: "330100",
    cityName: "杭州市",
  });

  const city = db.prepare("SELECT name, visit_state, summary, cover_asset_id FROM City WHERE city_id = ?").get("330100") as any;
  assert.equal(city.name, "杭州市");
  assert.equal(city.visit_state, "visited");
  assert.equal(city.summary, "用户摘要");
  assert.equal(city.cover_asset_id, "cover-1");
});

test("createTripRecord succeeds even when city row does not exist yet", () => {
  const db = createDb();
  const tripId = createTripRecord(db, {
    provinceId: "330000",
    provinceName: "浙江省",
    cityId: "330100",
    cityName: "杭州市",
    title: "新旅行",
  });

  const trip = db.prepare("SELECT city_id, title FROM Trip WHERE trip_id = ?").get(tripId) as any;
  assert.equal(trip.city_id, "330100");
  assert.equal(trip.title, "新旅行");
});
```

- [ ] **Step 2: Run the tests to verify they fail first**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityWorkbenchRuntime.test.ts
```

Expected:

```text
FAIL test/cityWorkbenchRuntime.test.ts
```

- [ ] **Step 3: Implement explicit city initialization helpers and write-path wrappers**

```ts
type CityIdentity = {
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
};

export function ensureProvinceExists(db: Database.Database, input: Pick<CityIdentity, "provinceId" | "provinceName">) {
  db.prepare(
    `INSERT INTO Province (province_id, name)
     VALUES (?, ?)
     ON CONFLICT(province_id) DO UPDATE SET name = excluded.name`,
  ).run(input.provinceId, input.provinceName);
}

export function ensureCityExists(db: Database.Database, input: CityIdentity) {
  ensureProvinceExists(db, input);
  db.prepare(
    `INSERT INTO City (city_id, province_id, name)
     VALUES (?, ?, ?)
     ON CONFLICT(city_id) DO UPDATE SET
       province_id = excluded.province_id,
       name = excluded.name`,
  ).run(input.cityId, input.provinceId, input.cityName);
}

export function updateCityVisitStateRecord(
  db: Database.Database,
  input: CityIdentity & { visitState: "unrecorded" | "wishlist" | "visited" },
) {
  ensureCityExists(db, input);
  db.prepare(`UPDATE City SET visit_state = ? WHERE city_id = ?`).run(input.visitState, input.cityId);
  return { ok: true };
}

export function createTripRecord(
  db: Database.Database,
  input: CityIdentity & { title?: string; date_start?: string; date_end?: string; companions?: string; route?: string; cost_total?: number; cover_asset_id?: string | null; content?: string },
) {
  ensureCityExists(db, input);
  const tripId = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO Trip (trip_id, city_id, title, date_start, date_end, companions, route, cost_total, cover_asset_id, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    tripId,
    input.cityId,
    input.title || "新旅行",
    input.date_start || "",
    input.date_end || "",
    input.companions || "[]",
    input.route || "",
    input.cost_total || 0,
    input.cover_asset_id || null,
    input.content || "",
    now,
    now,
  );
  return tripId;
}
```

- [ ] **Step 4: Wire the IPC handlers to the new explicit inputs**

```ts
ipcMain.handle(
  "db:updateCityVisitState",
  (event, payload: {
    provinceId: string;
    provinceName: string;
    cityId: string;
    cityName: string;
    visitState: "unrecorded" | "wishlist" | "visited";
  }) => {
    assertSender(event);
    return updateCityVisitStateRecord(getDb(), payload);
  },
);

ipcMain.handle(
  "db:createTrip",
  (event, payload: {
    provinceId: string;
    provinceName: string;
    cityId: string;
    cityName: string;
    title?: string;
    date_start?: string;
    date_end?: string;
    companions?: string;
    route?: string;
    cost_total?: number;
    cover_asset_id?: string | null;
    content?: string;
  }) => {
    assertSender(event);
    return createTripRecord(getDb(), payload);
  },
);
```

- [ ] **Step 5: Run the app tests again**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityWorkbenchRuntime.test.ts
```

Expected:

```text
# pass
```

- [ ] **Step 6: Commit the main-process initialization fix**

```bash
git add packages/app/src/main/ipc.ts packages/app/test/cityWorkbenchRuntime.test.ts
git commit -m "fix: make city workbench writes explicit"
git push
```

## Task 2: File Selection and Save-City-Asset Flow

**Files:**
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/renderer/src/vite-env.d.ts`
- Modify: `packages/renderer/src/services/db.ts`
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`

- [ ] **Step 1: Write the failing renderer-side flow expectations**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeImportResults } from "../src/components/drawer/cityWorkbenchImport.ts";

test("summarizeImportResults reports all-success correctly", () => {
  const result = summarizeImportResults([
    { ok: true, assetId: "a1", originalFilename: "a.pdf" },
    { ok: true, assetId: "a2", originalFilename: "b.png" },
  ]);

  assert.equal(result.successCount, 2);
  assert.equal(result.failureCount, 0);
});

test("summarizeImportResults reports missing-path as failure", () => {
  const result = summarizeImportResults([
    { ok: false, error: "未获取到可导入文件路径", originalFilename: "bad.pdf" },
  ]);

  assert.equal(result.successCount, 0);
  assert.equal(result.failureCount, 1);
  assert.match(result.details, /未获取到可导入文件路径/);
});
```

- [ ] **Step 2: Run the renderer tests to verify failure**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/runtime.test.ts
```

Expected:

```text
FAIL
```

- [ ] **Step 3: Expand file selection IPC so the renderer stops depending on `File.path`**

```ts
ipcMain.handle(
  "file:select",
  async (event, payload?: {
    multi?: boolean;
    kind?: "image" | "document" | "any";
  }) => {
    assertSender(event);
    const filters =
      payload?.kind === "image"
        ? [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }]
        : payload?.kind === "document"
          ? [{ name: "Documents", extensions: ["pdf", "md", "txt", "doc", "docx"] }]
          : undefined;

    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: payload?.multi ? ["openFile", "multiSelections"] : ["openFile"],
      filters,
    });

    return {
      canceled,
      filePaths: canceled ? [] : filePaths,
    };
  },
);
```

- [ ] **Step 4: Update preload, types, and service wrappers**

```ts
// preload/index.ts
select: (payload?: { multi?: boolean; kind?: "image" | "document" | "any" }) =>
  ipcRenderer.invoke("file:select", payload),
```

```ts
// vite-env.d.ts
select: (payload?: { multi?: boolean; kind?: "image" | "document" | "any" }) =>
  Promise<{ canceled: boolean; filePaths: string[] }>;
```

```ts
// services/db.ts or a renderer file helper
async function selectImportFiles() {
  return await window.travelMap.file.select({ multi: true, kind: "any" });
}
```

- [ ] **Step 5: Replace `CityHome` quick import implementation**

```ts
const handleQuickImport = useCallback(async () => {
  try {
    const selection = await window.travelMap.file.select({ multi: true, kind: "any" });
    if (selection.canceled) return;

    const filePaths = selection.filePaths.filter(Boolean);
    if (filePaths.length === 0) {
      ui.toast.error("未获取到可导入文件路径");
      return;
    }

    setImporting(true);
    const results = [];
    for (const sourcePath of filePaths) {
      const result = await window.travelMap.file.saveCityAsset({
        provinceId,
        provinceName,
        cityId,
        cityName,
        sourcePath,
      });
      results.push(result);
    }

    const summary = summarizeImportResults(results);
    if (summary.successCount > 0) {
      if ((data?.visit_state ?? "unrecorded") === "unrecorded" && Number(data?.tripCount ?? 0) === 0) {
        await db.updateCityVisitState({
          provinceId,
          provinceName,
          cityId,
          cityName,
          visitState: "wishlist",
        });
      }
      await loadCity();
      onOpenAssets();
    }

    if (summary.failureCount === 0) {
      ui.toast.success(`已导入 ${summary.successCount} 份本地资料`);
    } else if (summary.successCount > 0) {
      ui.toast.info(`已导入 ${summary.successCount} 份资料，${summary.failureCount} 份失败`, { details: summary.details });
    } else {
      ui.toast.error("导入资料失败", { details: summary.details });
    }
  } catch (err: any) {
    ui.toast.error("导入资料失败", { details: err?.message });
  } finally {
    setImporting(false);
  }
}, [provinceId, provinceName, cityId, cityName, data?.tripCount, data?.visit_state, loadCity, onOpenAssets]);
```

- [ ] **Step 6: Run focused checks**

Run:

```bash
pnpm --filter @travel-map/app typecheck
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
Found 0 errors
```

- [ ] **Step 7: Commit the import flow fix**

```bash
git add packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/renderer/src/vite-env.d.ts packages/renderer/src/components/drawer/CityHome.tsx
git commit -m "fix: improve city workbench imports"
git push
```

## Task 3: Runtime Guard and UI Error States

**Files:**
- Create: `packages/renderer/src/services/runtime.ts`
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`
- Modify: `packages/renderer/src/components/drawer/CityAssets.tsx`
- Modify: `packages/renderer/src/components/drawer/TripList.tsx`
- Test: `packages/renderer/test/runtime.test.ts`

- [ ] **Step 1: Write failing runtime guard tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getTravelMapRuntimeError } from "../src/services/runtime.ts";

test("returns null when travelMap API exists", () => {
  const original = (globalThis as any).window;
  (globalThis as any).window = { travelMap: { db: {}, file: {} } };
  assert.equal(getTravelMapRuntimeError(), null);
  (globalThis as any).window = original;
});

test("returns readable runtime error when API is missing", () => {
  const original = (globalThis as any).window;
  (globalThis as any).window = {};
  assert.match(getTravelMapRuntimeError() ?? "", /Electron/);
  (globalThis as any).window = original;
});
```

- [ ] **Step 2: Run the runtime tests to verify failure**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/runtime.test.ts
```

Expected:

```text
FAIL
```

- [ ] **Step 3: Implement the runtime guard helper**

```ts
export function getTravelMapRuntimeError() {
  if (typeof window === "undefined") return null;
  if (!window.travelMap?.db || !window.travelMap?.file) {
    return "当前运行环境不支持本地数据操作，请使用 Electron 启动应用。";
  }
  return null;
}

export function assertTravelMapRuntime() {
  const error = getTravelMapRuntimeError();
  if (error) throw new Error(error);
}
```

- [ ] **Step 4: Use the guard in `CityHome`, `CityAssets`, and `TripList`**

```ts
const runtimeError = getTravelMapRuntimeError();

if (runtimeError) {
  return (
    <div className="p-5">
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4 text-sm text-amber-100">
        {runtimeError}
      </div>
    </div>
  );
}
```

```ts
const [creating, setCreating] = useState(false);

const handleCreate = async () => {
  setCreating(true);
  try {
    const newTripId = await db.createTrip({
      provinceId,
      provinceName,
      cityId,
      cityName,
    });
    onSelectTrip(newTripId);
  } catch (err: any) {
    ui.toast.error("创建旅行失败", { details: err?.message });
  } finally {
    setCreating(false);
  }
};
```

- [ ] **Step 5: Re-run renderer tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/runtime.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
```

- [ ] **Step 6: Commit the runtime/error-state updates**

```bash
git add packages/renderer/src/services/runtime.ts packages/renderer/src/components/drawer/CityHome.tsx packages/renderer/src/components/drawer/CityAssets.tsx packages/renderer/src/components/drawer/TripList.tsx packages/renderer/test/runtime.test.ts
git commit -m "fix: clarify city workbench runtime failures"
git push
```

## Task 4: Manual Regression and Final Verification

**Files:**
- Modify: `packages/renderer/test/cityWorkbenchCopy.test.ts` (only if copy logic changes)
- Modify: `packages/renderer/test/cityAssetsGroups.test.ts` (only if grouping changes)
- Check: `packages/app/test/cityAssetsQuery.test.ts`

- [ ] **Step 1: Run the full focused automated suite**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityWorkbenchState.test.ts test/cityAssetsQuery.test.ts test/cityWorkbenchRuntime.test.ts
pnpm --filter @travel-map/renderer test -- test/cityWorkbenchCopy.test.ts test/cityAssetsGroups.test.ts test/runtime.test.ts
pnpm --filter @travel-map/app typecheck
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# all pass
```

- [ ] **Step 2: Check diagnostics for edited files**

Run via IDE diagnostics on:

```text
packages/app/src/main/ipc.ts
packages/app/src/preload/index.ts
packages/renderer/src/components/drawer/CityHome.tsx
packages/renderer/src/components/drawer/CityAssets.tsx
packages/renderer/src/components/drawer/TripList.tsx
packages/renderer/src/services/runtime.ts
```

Expected:

```text
[]
```

- [ ] **Step 3: Manually validate the four user-reported flows in Electron**

Checklist:

```text
1. 启动 pnpm run dev:electron:local
2. 进入一个全新城市，直接点“想去”或“去过”，确认成功且无失败 toast
3. 进入另一个全新城市，点“快速导入资料”，确认出现成功/失败反馈
4. 导入成功后进入“本地资料”，确认看到未归类资料
5. 进入第三个全新城市，点“开始记录” -> “新建”，确认进入 Trip 详情
6. 若已有未归类资料，确认可归入旅行
```

- [ ] **Step 4: Commit the verified fixset**

```bash
git add packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/renderer/src/components/drawer/CityHome.tsx packages/renderer/src/components/drawer/CityAssets.tsx packages/renderer/src/components/drawer/TripList.tsx packages/renderer/src/services/runtime.ts packages/app/test/cityWorkbenchRuntime.test.ts packages/renderer/test/runtime.test.ts docs/superpowers/specs/2026-05-10-city-workbench-runtime-fix-design.md docs/superpowers/plans/2026-05-10-city-workbench-runtime-fix-plan.md
git commit -m "fix: restore city workbench runtime flows"
git push
```

## Self-Review

- Spec coverage: covered explicit city initialization, file selection refactor, runtime guard, UI feedback, and verification paths.
- Placeholder scan: no `TODO` / `TBD` placeholders remain.
- Type consistency: all new write paths use explicit `provinceId` / `provinceName` / `cityId` / `cityName` inputs; renderer/runtime guard naming stays consistent across tasks.
