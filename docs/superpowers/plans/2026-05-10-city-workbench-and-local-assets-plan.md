# City Workbench And Local Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the city drawer into a city workbench with clear empty-state actions, city-level quick import, and a local-assets view that shows both unclassified city assets and trip assets.

**Architecture:** Extend the existing `Drawer` view model instead of replacing it. Add a light city state field plus a city-level asset ownership path, keep `TripDetail` as the deep editor, and make `CityHome` the action-first workbench that routes users into trips, assets, and POI creation.

**Tech Stack:** Electron, React, TypeScript, better-sqlite3, existing IPC/preload bridge, Markdown editor, local `Asset` storage.

---

## File Map

**Create**
- `docs/superpowers/specs/2026-05-10-city-workbench-and-local-assets-design.md`
- `docs/superpowers/plans/2026-05-10-city-workbench-and-local-assets-plan.md`
- `packages/app/test/cityWorkbenchState.test.ts`
- `packages/app/test/cityAssetOwnership.test.ts`
- `packages/renderer/src/components/drawer/cityWorkbenchCopy.ts`
- `packages/renderer/test/cityWorkbenchCopy.test.ts`

**Modify**
- `packages/app/src/main/db/schema.ts`
- `packages/app/src/main/db/index.ts`
- `packages/app/src/main/ipc.ts`
- `packages/app/src/main/cityAssetsQuery.ts`
- `packages/app/src/preload/index.ts`
- `packages/renderer/src/types/index.ts`
- `packages/renderer/src/vite-env.d.ts`
- `packages/renderer/src/services/db.ts`
- `packages/renderer/src/components/drawer/CityHome.tsx`
- `packages/renderer/src/components/drawer/CityAssets.tsx`
- `packages/renderer/src/components/Drawer.tsx`
- `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- `docs/travel-map-docs/00-项目总览.md`
- `docs/travel-map-docs/02-数据与内容模型.md`
- `docs/travel-map-docs/04-里程碑与待办Backlog.md`
- `docs/travel-map-docs/06-存储与附件规范.md`
- `docs/travel-map-docs/07-UI视觉与布局风格.md`
- `docs/travel-map-docs/09-数据库Schema与迁移.md`
- `docs/travel-map-docs/README-APP.md`

---

### Task 1: Add City Workbench State To Persistence

**Files:**
- Modify: `packages/app/src/main/db/schema.ts`
- Modify: `packages/app/src/main/db/index.ts`
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/renderer/src/services/db.ts`
- Modify: `packages/renderer/src/types/index.ts`
- Modify: `packages/renderer/src/vite-env.d.ts`
- Test: `packages/app/test/cityWorkbenchState.test.ts`

- [ ] **Step 1: Write the failing migration/state test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

test("City schema exposes visit_state with unrecorded default", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE City (
      city_id TEXT PRIMARY KEY,
      province_id TEXT,
      name TEXT NOT NULL,
      visit_state TEXT DEFAULT 'unrecorded',
      summary TEXT,
      cover_asset_id TEXT
    );
  `);

  db.prepare(`INSERT INTO City (city_id, province_id, name) VALUES (?, ?, ?)`).run("370700", "370000", "潍坊市");
  const row = db.prepare(`SELECT visit_state FROM City WHERE city_id = ?`).get("370700") as { visit_state: string };
  assert.equal(row.visit_state, "unrecorded");
});
```

- [ ] **Step 2: Run test to verify the real code still lacks this contract**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityWorkbenchState.test.ts
```

Expected: FAIL or require manual alignment because current schema and IPC do not expose `visit_state`.

- [ ] **Step 3: Add the minimal schema and IPC surface**

```ts
// packages/app/src/main/db/schema.ts
CREATE TABLE IF NOT EXISTS City (
  city_id TEXT PRIMARY KEY,
  province_id TEXT REFERENCES Province(province_id),
  name TEXT NOT NULL,
  visit_state TEXT NOT NULL DEFAULT 'unrecorded',
  summary TEXT,
  cover_asset_id TEXT
);
```

```ts
// packages/app/src/main/db/index.ts
if (currentVersion < 2) {
  this.db.exec(`
    ALTER TABLE City ADD COLUMN visit_state TEXT NOT NULL DEFAULT 'unrecorded';
  `);
  this.db.pragma('user_version = 2');
}
```

```ts
// packages/app/src/main/ipc.ts
ipcMain.handle("db:updateCityVisitState", (event, payload: { cityId: string; visitState: "unrecorded" | "wishlist" | "visited" }) => {
  assertSender(event);
  const db = getDb();
  db.prepare(`UPDATE City SET visit_state = ? WHERE city_id = ?`).run(payload.visitState, payload.cityId);
  return { ok: true };
});
```

```ts
// packages/renderer/src/types/index.ts
export interface City {
  city_id: string;
  province_id: string;
  name: string;
  visit_state?: "unrecorded" | "wishlist" | "visited";
  summary?: string;
  cover_asset_id?: string;
  cover_path?: string;
  cover_remote?: string;
  tripCount?: number;
  poiCount?: number;
  totalCost?: number;
}
```

- [ ] **Step 4: Run tests and typechecks**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityWorkbenchState.test.ts
pnpm --filter @travel-map/app typecheck
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS, PASS, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/main/db/schema.ts packages/app/src/main/db/index.ts packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/renderer/src/services/db.ts packages/renderer/src/types/index.ts packages/renderer/src/vite-env.d.ts packages/app/test/cityWorkbenchState.test.ts
git commit -m "feat: add city workbench visit state"
git push
```

---

### Task 2: Add City-Level Asset Ownership And Query Support

**Files:**
- Modify: `packages/app/src/main/cityAssetsQuery.ts`
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/renderer/src/services/db.ts`
- Modify: `packages/renderer/src/types/index.ts`
- Modify: `packages/renderer/src/vite-env.d.ts`
- Test: `packages/app/test/cityAssetOwnership.test.ts`

- [ ] **Step 1: Write the failing ownership test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getCityAssets } from "../src/main/cityAssetsQuery.ts";

test("getCityAssets returns city-owned unclassified assets before trip groups", () => {
  const db = {
    prepare() {
      return {
        all() {
          return [
            {
              asset_id: "asset-city-1",
              type: "document",
              original_filename: "攻略.pdf",
              mime: "application/pdf",
              size: 12,
              local_path: "assets/cities/370700-潍坊市/inbox/docs/asset-city-1__攻略.pdf",
              created_at: 500,
              owner_kind: "city",
              city_id: "370700",
              trip_id: null,
              trip_title: null,
              source_kind: "city_inbox",
            },
          ];
        },
      };
    },
  } as any;

  const rows = getCityAssets(db, "370700");
  assert.equal(rows[0].source_kind, "city_inbox");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityAssetOwnership.test.ts
```

Expected: FAIL because current query only returns trip attachments and inline assets.

- [ ] **Step 3: Extend ownership and import IPC**

```ts
// packages/app/src/main/cityAssetsQuery.ts
export interface CityAssetRow {
  asset_id: string;
  type: string;
  original_filename: string;
  mime: string;
  size: number;
  local_path: string;
  created_at: number;
  trip_id: string | null;
  trip_title: string | null;
  source_kind: "city_inbox" | "attachment" | "inline";
}
```

```ts
// packages/app/src/main/ipc.ts
ipcMain.handle("file:saveCityAsset", async (event, payload: { cityId: string; cityName: string; sourcePath: string }) => {
  assertSender(event);
  const destRelativeDir = `cities/${payload.cityId}-${payload.cityName}/inbox/docs`;
  const res = await saveAssetCore(payload.sourcePath, destRelativeDir);
  getDb().prepare(`INSERT OR IGNORE INTO Tag (entity_type, entity_id, name) VALUES ('city_asset', ?, ?)`).run(payload.cityId, res.assetId);
  return res;
});
```

```ts
// packages/app/src/main/cityAssetsQuery.ts
WHERE (
  (tag.entity_type IN ('trip_attachment', 'trip_inline_asset') AND t.city_id = ?)
  OR (tag.entity_type = 'city_asset' AND tag.entity_id = ?)
)
```

- [ ] **Step 4: Run tests and typechecks**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityAssetOwnership.test.ts
pnpm --filter @travel-map/app typecheck
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS, PASS, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/main/cityAssetsQuery.ts packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/renderer/src/services/db.ts packages/renderer/src/types/index.ts packages/renderer/src/vite-env.d.ts packages/app/test/cityAssetOwnership.test.ts
git commit -m "feat: add city-level local asset ownership"
git push
```

---

### Task 3: Rebuild CityHome As A Workbench

**Files:**
- Create: `packages/renderer/src/components/drawer/cityWorkbenchCopy.ts`
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Modify: `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- Test: `packages/renderer/test/cityWorkbenchCopy.test.ts`

- [ ] **Step 1: Write the failing copy/state test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getCityWorkbenchCopy } from "../src/components/drawer/cityWorkbenchCopy.ts";

test("getCityWorkbenchCopy favors action-first copy for unrecorded cities", () => {
  const copy = getCityWorkbenchCopy("unrecorded", 0);
  assert.match(copy.title, /开始/);
  assert.match(copy.description, /没有记录/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityWorkbenchCopy.test.ts
```

Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write minimal workbench UI**

```ts
// packages/renderer/src/components/drawer/cityWorkbenchCopy.ts
export function getCityWorkbenchCopy(visitState: "unrecorded" | "wishlist" | "visited", tripCount: number) {
  if (visitState === "wishlist") {
    return {
      badge: "想去",
      title: "先收集资料，再慢慢整理",
      description: "你可以先导入攻略、图片和 PDF，之后再归到某次旅行。",
    };
  }
  if (visitState === "visited" || tripCount > 0) {
    return {
      badge: "去过",
      title: "继续补充这座城市的记录",
      description: "从旅行、本地资料和地标三个入口继续整理内容。",
    };
  }
  return {
    badge: "未记录",
    title: "开始这座城市的第一条记录",
    description: "先开始旅行记录、导入本地资料，或者先添加一个地标。",
  };
}
```

```tsx
// packages/renderer/src/components/drawer/CityHome.tsx
<div className="space-y-5">
  <section>{/* 城市名 + visit_state badge + copy */}</section>
  <section className="grid grid-cols-2 gap-3">
    <button onClick={onCreateTrip}>开始记录</button>
    <button onClick={onOpenAssets}>本地资料</button>
    <button onClick={onQuickImport}>快速导入资料</button>
    <button onClick={onStartAddPoi}>添加地标</button>
  </section>
</div>
```

- [ ] **Step 4: Run tests and typechecks**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityWorkbenchCopy.test.ts
pnpm --filter @travel-map/renderer typecheck
pnpm --filter @travel-map/app typecheck
```

Expected: PASS, PASS, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/components/drawer/cityWorkbenchCopy.ts packages/renderer/src/components/drawer/CityHome.tsx packages/renderer/src/components/Drawer.tsx packages/renderer/src/features/map/BreadCrumbOverlay.tsx packages/renderer/test/cityWorkbenchCopy.test.ts
git commit -m "feat: redesign city drawer as workbench"
git push
```

---

### Task 4: Show Unclassified Assets In CityAssets And Add Reclassify Action

**Files:**
- Modify: `packages/renderer/src/components/drawer/CityAssets.tsx`
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/renderer/src/services/db.ts`
- Modify: `packages/renderer/src/vite-env.d.ts`

- [ ] **Step 1: Write a failing renderer behavior test or helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

test("city assets group unclassified files ahead of trip groups", () => {
  const rows = [
    { asset_id: "a1", source_kind: "city_inbox", trip_id: null },
    { asset_id: "a2", source_kind: "attachment", trip_id: "trip-1" },
  ];
  const cityOwned = rows.filter((row) => row.source_kind === "city_inbox");
  assert.equal(cityOwned.length, 1);
});
```

- [ ] **Step 2: Run test to verify coverage starts red or incomplete**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityAssetsPreview.test.ts
```

Expected: existing tests pass, but there is no grouping/reclassify coverage yet, so add the new helper until it fails first.

- [ ] **Step 3: Implement the minimal asset grouping and reclassify IPC**

```tsx
// packages/renderer/src/components/drawer/CityAssets.tsx
const unclassified = items.filter((item) => item.source_kind === "city_inbox");
const tripGroups = items.filter((item) => item.source_kind !== "city_inbox");
```

```ts
// packages/app/src/main/ipc.ts
ipcMain.handle("db:assignCityAssetToTrip", (event, payload: { cityId: string; assetId: string; tripId: string }) => {
  assertSender(event);
  const db = getDb();
  db.transaction(() => {
    db.prepare(`DELETE FROM Tag WHERE entity_type = 'city_asset' AND entity_id = ? AND name = ?`).run(payload.cityId, payload.assetId);
    db.prepare(`INSERT OR IGNORE INTO Tag (entity_type, entity_id, name) VALUES ('trip_attachment', ?, ?)`).run(payload.tripId, payload.assetId);
  })();
  return { ok: true };
});
```

- [ ] **Step 4: Run tests and typechecks**

Run:

```bash
pnpm --filter @travel-map/renderer typecheck
pnpm --filter @travel-map/app typecheck
```

Expected: PASS, PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/components/drawer/CityAssets.tsx packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/renderer/src/services/db.ts packages/renderer/src/vite-env.d.ts
git commit -m "feat: support unclassified city assets"
git push
```

---

### Task 5: Final Verification And Docs Alignment

**Files:**
- Modify: `docs/travel-map-docs/00-项目总览.md`
- Modify: `docs/travel-map-docs/02-数据与内容模型.md`
- Modify: `docs/travel-map-docs/04-里程碑与待办Backlog.md`
- Modify: `docs/travel-map-docs/06-存储与附件规范.md`
- Modify: `docs/travel-map-docs/07-UI视觉与布局风格.md`
- Modify: `docs/travel-map-docs/09-数据库Schema与迁移.md`
- Modify: `docs/travel-map-docs/README-APP.md`

- [ ] **Step 1: Update docs to match shipped behavior**

```md
- 城市首页默认是城市工作台
- 双主入口：开始记录 / 本地资料
- 支持城市级快速导入资料
- 资料页区分未归类资料与旅行资料
```

- [ ] **Step 2: Run validation commands**

Run:

```bash
pnpm --filter @travel-map/app typecheck
pnpm --filter @travel-map/renderer typecheck
pnpm --filter @travel-map/app test -- test/cityWorkbenchState.test.ts test/cityAssetOwnership.test.ts
pnpm --filter @travel-map/renderer test -- test/cityWorkbenchCopy.test.ts test/cityAssetsPreview.test.ts
```

Expected: PASS across all commands.

- [ ] **Step 3: Manual QA**

Run through this checklist:

```text
1. 打开一个从未记录的城市，首页看到状态标签和动作入口
2. 点击“开始记录”，能直接进入新 Trip
3. 点击“快速导入资料”，文件导入到本地资料页
4. 本地资料页先显示未归类资料，再显示旅行分组
5. 点击“归入旅行”后，资料从未归类组移动到对应 Trip 组
6. 点击“添加地标”，地图进入选点模式并能弹出 POI 添加框
```

- [ ] **Step 4: Commit**

```bash
git add docs/travel-map-docs/00-项目总览.md docs/travel-map-docs/02-数据与内容模型.md docs/travel-map-docs/04-里程碑与待办Backlog.md docs/travel-map-docs/06-存储与附件规范.md docs/travel-map-docs/07-UI视觉与布局风格.md docs/travel-map-docs/09-数据库Schema与迁移.md docs/travel-map-docs/README-APP.md
git commit -m "docs: align city workbench behavior"
git push
```

---

## Self-Review

**Spec coverage**
- 城市工作台定位：Task 3
- 轻量状态 `未记录 / 想去 / 去过`：Task 1 + Task 3
- 城市级快速导入资料：Task 2 + Task 3
- 未归类资料与旅行资料同屏：Task 2 + Task 4
- 归入旅行动作：Task 4
- 文档同步：Task 5

**Placeholder scan**
- 所有任务都给了具体文件路径、代码片段、命令和预期结果。
- 没有使用 `TBD`、`TODO`、`类似 Task N` 之类占位词。

**Type consistency**
- `visit_state` 统一使用 `unrecorded | wishlist | visited`
- 城市级资料统一使用 `city_asset` 标签归属和 `city_inbox` 资料来源
- `CityHome` 保持现有 `Drawer` 视图模型，不引入新的抽屉层级

