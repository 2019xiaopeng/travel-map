# City Assets And City Home States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable city home experience with explicit loading/error/empty/ready states, plus a city-scoped local-assets view that previews images, Markdown/txt, and PDF.

**Architecture:** Keep the current Electron IPC + preload + renderer service layering. Add two focused main-process helpers for city asset aggregation and safe local text reading, then extend the drawer with a new `city-assets` view and small renderer-side helpers for state derivation and preview decisions.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript, better-sqlite3, Node test runner

---

## File Map

- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Create: `packages/app/src/main/cityAssetsQuery.ts`
- Create: `packages/app/src/main/readLocalText.ts`
- Create: `packages/app/test/cityAssetsQuery.test.ts`
- Create: `packages/app/test/readLocalText.test.ts`
- Modify: `packages/renderer/src/services/db.ts`
- Modify: `packages/renderer/src/types/index.ts`
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`
- Create: `packages/renderer/src/components/drawer/cityHomeState.ts`
- Create: `packages/renderer/src/components/drawer/CityAssets.tsx`
- Create: `packages/renderer/src/components/drawer/cityAssetsPreview.ts`
- Create: `packages/renderer/test/cityHomeState.test.ts`
- Create: `packages/renderer/test/cityAssetsPreview.test.ts`

---

### Task 1: Add City Asset Aggregation In Main Process

**Files:**
- Create: `packages/app/src/main/cityAssetsQuery.ts`
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/renderer/src/services/db.ts`
- Modify: `packages/renderer/src/types/index.ts`
- Test: `packages/app/test/cityAssetsQuery.test.ts`

- [ ] **Step 1: Write the failing aggregation test**

Create `packages/app/test/cityAssetsQuery.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { getCityAssets } from "../src/main/cityAssetsQuery";

function seedDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE Trip (
      trip_id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL,
      title TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE Asset (
      asset_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      local_path TEXT NOT NULL,
      remote_url TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE Tag (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      name TEXT NOT NULL
    );
  `);

  db.prepare(`INSERT INTO Trip (trip_id, city_id, title, updated_at) VALUES (?, ?, ?, ?)`).run("trip-a", "330100", "春游杭州", 200);
  db.prepare(`INSERT INTO Trip (trip_id, city_id, title, updated_at) VALUES (?, ?, ?, ?)`).run("trip-b", "330100", "夏游杭州", 100);

  db.prepare(`
    INSERT INTO Asset (asset_id, type, original_filename, mime, size, sha256, local_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("asset-1", "image", "west-lake.jpg", "image/jpeg", 10, "sha-a", "assets/cities/330100/trips/trip-a/photos/asset-1__west-lake.jpg", 300);
  db.prepare(`
    INSERT INTO Asset (asset_id, type, original_filename, mime, size, sha256, local_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("asset-2", "file", "plan.pdf", "application/pdf", 20, "sha-b", "assets/cities/330100/trips/trip-a/docs/asset-2__plan.pdf", 250);

  db.prepare(`INSERT INTO Tag (entity_type, entity_id, name) VALUES ('trip_attachment', 'trip-a', 'asset-1')`).run();
  db.prepare(`INSERT INTO Tag (entity_type, entity_id, name) VALUES ('trip_inline_asset', 'trip-a', 'asset-1')`).run();
  db.prepare(`INSERT INTO Tag (entity_type, entity_id, name) VALUES ('trip_attachment', 'trip-a', 'asset-2')`).run();

  return db;
}

test("getCityAssets merges attachment and inline assets and deduplicates by asset_id", () => {
  const db = seedDb();
  const rows = getCityAssets(db, "330100");

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => ({
      asset_id: row.asset_id,
      source_kind: row.source_kind,
      trip_title: row.trip_title,
    })),
    [
      { asset_id: "asset-1", source_kind: "attachment", trip_title: "春游杭州" },
      { asset_id: "asset-2", source_kind: "attachment", trip_title: "春游杭州" },
    ],
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityAssetsQuery.test.ts
```

Expected: FAIL with a module-not-found error for `../src/main/cityAssetsQuery`.

- [ ] **Step 3: Write the minimal aggregation helper**

Create `packages/app/src/main/cityAssetsQuery.ts`:

```ts
import type Database from "better-sqlite3";

export interface CityAssetRow {
  asset_id: string;
  type: string;
  original_filename: string;
  mime: string;
  size: number;
  local_path: string;
  created_at: number;
  trip_id: string;
  trip_title: string;
  source_kind: "attachment" | "inline";
}

export function getCityAssets(db: Database.Database, cityId: string): CityAssetRow[] {
  const rows = db.prepare(`
    SELECT
      a.asset_id,
      a.type,
      a.original_filename,
      a.mime,
      a.size,
      a.local_path,
      a.created_at,
      t.trip_id,
      t.title AS trip_title,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM Tag ta
          WHERE ta.entity_type = 'trip_attachment'
            AND ta.entity_id = t.trip_id
            AND ta.name = a.asset_id
        ) THEN 'attachment'
        ELSE 'inline'
      END AS source_kind,
      t.updated_at
    FROM Trip t
    JOIN Tag tag
      ON tag.entity_id = t.trip_id
     AND tag.entity_type IN ('trip_attachment', 'trip_inline_asset')
    JOIN Asset a
      ON a.asset_id = tag.name
    WHERE t.city_id = ?
    ORDER BY t.updated_at DESC, a.created_at DESC
  `).all(cityId) as Array<CityAssetRow & { updated_at: number }>;

  const deduped = new Map<string, CityAssetRow>();
  for (const row of rows) {
    const previous = deduped.get(row.asset_id);
    if (!previous || previous.source_kind === "inline") {
      deduped.set(row.asset_id, {
        asset_id: row.asset_id,
        type: row.type,
        original_filename: row.original_filename,
        mime: row.mime,
        size: row.size,
        local_path: row.local_path,
        created_at: row.created_at,
        trip_id: row.trip_id,
        trip_title: row.trip_title,
        source_kind: row.source_kind,
      });
    }
  }

  return Array.from(deduped.values());
}
```

- [ ] **Step 4: Wire the helper into IPC, preload, renderer service, and types**

Modify `packages/app/src/main/ipc.ts` near the other DB handlers:

```ts
import { getCityAssets } from "./cityAssetsQuery";

ipcMain.handle("db:getCityAssets", (event, payload: { cityId: string }) => {
  assertSender(event);
  const db = getDb();
  return getCityAssets(db, payload.cityId);
});
```

Modify `packages/app/src/preload/index.ts`:

```ts
getCityAssets: (payload: { cityId: string }) => ipcRenderer.invoke("db:getCityAssets", payload),
```

Modify `packages/renderer/src/services/db.ts`:

```ts
async getCityAssets(cityId: string) {
  return await window.travelMap.db.getCityAssets({ cityId });
},
```

Modify `packages/renderer/src/types/index.ts`:

```ts
export interface CityAsset extends Asset {
  trip_id: string;
  trip_title: string;
  source_kind: "attachment" | "inline";
}
```

- [ ] **Step 5: Run the targeted test to verify it passes**

Run:

```bash
pnpm --filter @travel-map/app test -- test/cityAssetsQuery.test.ts
```

Expected: PASS with 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/main/cityAssetsQuery.ts packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/app/test/cityAssetsQuery.test.ts packages/renderer/src/services/db.ts packages/renderer/src/types/index.ts
git commit -m "feat: add city asset aggregation query"
```

---

### Task 2: Add Safe Local Text Reading For Previews

**Files:**
- Create: `packages/app/src/main/readLocalText.ts`
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/app/src/preload/index.ts`
- Test: `packages/app/test/readLocalText.test.ts`

- [ ] **Step 1: Write the failing text-read safety test**

Create `packages/app/test/readLocalText.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLocalText } from "../src/main/readLocalText";

test("readLocalText reads markdown inside assets and blocks traversal", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "travel-map-read-local-"));
  const assetsDir = path.join(root, "assets", "notes");
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, "guide.md"), "# Guide\n\nHello", "utf8");

  const ok = await readLocalText({
    userDataPath: root,
    localPath: "assets/notes/guide.md",
    maxBytes: 1024,
  });
  assert.equal(ok.ok, true);
  assert.match(ok.text ?? "", /Guide/);

  const denied = await readLocalText({
    userDataPath: root,
    localPath: "../secret.txt",
    maxBytes: 1024,
  });
  assert.equal(denied.ok, false);
  assert.match(denied.error ?? "", /Access Denied/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/app test -- test/readLocalText.test.ts
```

Expected: FAIL with a module-not-found error for `../src/main/readLocalText`.

- [ ] **Step 3: Implement the safe text reader**

Create `packages/app/src/main/readLocalText.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export async function readLocalText(input: {
  userDataPath: string;
  localPath: string;
  maxBytes: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const assetsRoot = path.resolve(path.join(input.userDataPath, "assets"));
  const absolutePath = path.resolve(path.join(input.userDataPath, input.localPath));
  if (!absolutePath.startsWith(assetsRoot + path.sep)) {
    return { ok: false, error: "Access Denied" };
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Unsupported text file" };
  }

  const stat = await fs.stat(absolutePath);
  if (stat.size > input.maxBytes) {
    return { ok: false, error: "File too large to preview" };
  }

  return { ok: true, text: await fs.readFile(absolutePath, "utf8") };
}
```

- [ ] **Step 4: Wire the file IPC and preload API**

Modify `packages/app/src/main/ipc.ts`:

```ts
import { readLocalText } from "./readLocalText";

ipcMain.handle("file:readLocalText", async (event, payload: { localPath: string }) => {
  assertSender(event);
  return await readLocalText({
    userDataPath: app.getPath("userData"),
    localPath: payload.localPath,
    maxBytes: 1024 * 1024,
  });
});
```

Modify `packages/app/src/preload/index.ts`:

```ts
readLocalText: (localPath: string) => ipcRenderer.invoke("file:readLocalText", { localPath }),
```

- [ ] **Step 5: Run the targeted test to verify it passes**

Run:

```bash
pnpm --filter @travel-map/app test -- test/readLocalText.test.ts
```

Expected: PASS with traversal protection and in-assets reading both covered.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/main/readLocalText.ts packages/app/src/main/ipc.ts packages/app/src/preload/index.ts packages/app/test/readLocalText.test.ts
git commit -m "feat: add safe local text preview reader"
```

---

### Task 3: Refactor CityHome Into Explicit UI States

**Files:**
- Create: `packages/renderer/src/components/drawer/cityHomeState.ts`
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Test: `packages/renderer/test/cityHomeState.test.ts`

- [ ] **Step 1: Write the failing state-derivation test**

Create `packages/renderer/test/cityHomeState.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { deriveCityHomeState } from "../src/components/drawer/cityHomeState";

test("deriveCityHomeState returns empty for a newly created city record", () => {
  const state = deriveCityHomeState({
    loading: false,
    error: null,
    city: {
      city_id: "330100",
      province_id: "330000",
      name: "杭州市",
      tripCount: 0,
      poiCount: 0,
      totalCost: 0,
    },
  });

  assert.equal(state, "empty");
});

test("deriveCityHomeState returns error before evaluating city content", () => {
  const state = deriveCityHomeState({
    loading: false,
    error: "boom",
    city: null,
  });

  assert.equal(state, "error");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityHomeState.test.ts
```

Expected: FAIL with a module-not-found error for `cityHomeState`.

- [ ] **Step 3: Implement the state helper**

Create `packages/renderer/src/components/drawer/cityHomeState.ts`:

```ts
import type { City } from "../../types";

export type CityHomeViewState = "loading" | "error" | "empty" | "ready";

export function deriveCityHomeState(input: {
  loading: boolean;
  error: string | null;
  city: City | null;
}): CityHomeViewState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (!input.city) return "loading";

  const city = input.city;
  const hasContent =
    Boolean(city.summary?.trim()) ||
    Boolean(city.cover_path) ||
    Boolean(city.cover_remote) ||
    Number(city.tripCount ?? 0) > 0 ||
    Number(city.poiCount ?? 0) > 0;

  return hasContent ? "ready" : "empty";
}
```

- [ ] **Step 4: Update `CityHome.tsx` to use explicit loading/error/empty/ready UI**

Modify `packages/renderer/src/components/drawer/CityHome.tsx`:

```tsx
const [data, setData] = useState<City | null>(null);
const [summary, setSummary] = useState("");
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const loadCity = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await db.getCity(cityId, provinceId, cityName, provinceName);
    setData(res);
    setSummary(res?.summary || "");
  } catch (err) {
    console.error("Failed to load city:", err);
    setError("城市资料加载失败");
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  void loadCity();
}, [cityId, provinceId, cityName, provinceName]);
```

Then branch rendering through `deriveCityHomeState(...)`:

```tsx
const viewState = deriveCityHomeState({ loading, error, city: data });

if (viewState === "loading") {
  return <CityHomeSkeleton />;
}

if (viewState === "error") {
  return (
    <div className="p-5 space-y-4">
      <h2 className="text-base font-semibold text-white">{cityName}</h2>
      <p className="text-sm text-neutral-400">城市资料加载失败，请重试。</p>
      <button onClick={() => void loadCity()} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm text-white">
        重试
      </button>
    </div>
  );
}

if (viewState === "empty") {
  return (
    <div className="p-5 space-y-5 animate-fade-in-up">
      <section className="rounded-2xl border border-white/10 bg-white/4 p-5">
        <h2 className="text-lg font-semibold text-white">{cityName}</h2>
        <p className="mt-2 text-sm text-neutral-400">这个城市还没有本地资料，可先新建旅行或查看本地资料页。</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onOpenTrips} className="rounded-lg bg-[var(--color-accent)] py-2 text-sm font-medium text-white">
            查看旅行记录
          </button>
          <button onClick={onOpenAssets} className="rounded-lg border border-[var(--color-border)] py-2 text-sm font-medium text-white">
            本地资料
          </button>
        </div>
      </section>
    </div>
  );
}
```

Also update the props interface to accept:

```ts
onOpenAssets: () => void;
```

- [ ] **Step 5: Extend `Drawer.tsx` with the new `city-assets` view enum and navigation**

Modify `packages/renderer/src/components/Drawer.tsx`:

```tsx
type DrawerView = "city-home" | "city-assets" | "trip-list" | "trip-detail" | "poi-detail";
```

Pass the new callback into `CityHome`:

```tsx
<CityHome
  cityId={cityId}
  cityName={cityName}
  provinceId={provinceId}
  provinceName={provinceName}
  onOpenTrips={() => setView("trip-list")}
  onOpenAssets={() => setView("city-assets")}
/>
```

Update the existing back-button branch:

```tsx
} else if (view === "city-assets") {
  setView("city-home");
}
```

- [ ] **Step 6: Run the renderer test to verify it passes**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityHomeState.test.ts
```

Expected: PASS with state derivation covering empty and error cases.

- [ ] **Step 7: Commit**

```bash
git add packages/renderer/src/components/drawer/cityHomeState.ts packages/renderer/src/components/drawer/CityHome.tsx packages/renderer/src/components/Drawer.tsx packages/renderer/test/cityHomeState.test.ts
git commit -m "feat: add explicit city home view states"
```

---

### Task 4: Build The City Assets View And Preview Helpers

**Files:**
- Create: `packages/renderer/src/components/drawer/cityAssetsPreview.ts`
- Create: `packages/renderer/src/components/drawer/CityAssets.tsx`
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Modify: `packages/renderer/src/services/db.ts`
- Test: `packages/renderer/test/cityAssetsPreview.test.ts`

- [ ] **Step 1: Write the failing preview-decision test**

Create `packages/renderer/test/cityAssetsPreview.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getCityAssetPreviewKind } from "../src/components/drawer/cityAssetsPreview";

test("getCityAssetPreviewKind classifies supported preview formats", () => {
  assert.equal(getCityAssetPreviewKind({ mime: "image/png", original_filename: "a.png" }), "image");
  assert.equal(getCityAssetPreviewKind({ mime: "application/pdf", original_filename: "a.pdf" }), "pdf");
  assert.equal(getCityAssetPreviewKind({ mime: "text/plain", original_filename: "a.txt" }), "text");
  assert.equal(getCityAssetPreviewKind({ mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", original_filename: "a.docx" }), "external");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityAssetsPreview.test.ts
```

Expected: FAIL with a module-not-found error for `cityAssetsPreview`.

- [ ] **Step 3: Implement the preview helper**

Create `packages/renderer/src/components/drawer/cityAssetsPreview.ts`:

```ts
export type CityAssetPreviewKind = "image" | "pdf" | "text" | "external";

export function getCityAssetPreviewKind(input: {
  mime: string;
  original_filename: string;
}): CityAssetPreviewKind {
  const mime = String(input.mime ?? "").toLowerCase();
  const filename = String(input.original_filename ?? "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    filename.endsWith(".txt") ||
    filename.endsWith(".md") ||
    filename.endsWith(".markdown")
  ) {
    return "text";
  }
  return "external";
}
```

- [ ] **Step 4: Create the city assets component**

Create `packages/renderer/src/components/drawer/CityAssets.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../../services/db";
import type { CityAsset } from "../../types";
import { getCityAssetPreviewKind } from "./cityAssetsPreview";

interface CityAssetsProps {
  cityId: string;
}

export function CityAssets({ cityId }: CityAssetsProps) {
  const [items, setItems] = useState<CityAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await db.getCityAssets(cityId);
        setItems(rows);
        setSelectedId(rows[0]?.asset_id ?? null);
      } catch (err) {
        console.error("Failed to load city assets:", err);
        setError("本地资料加载失败");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [cityId]);

  const selected = useMemo(
    () => items.find((item) => item.asset_id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    const run = async () => {
      if (!selected) return;
      const kind = getCityAssetPreviewKind(selected);
      if (kind !== "text") {
        setTextPreview("");
        return;
      }
      const res = await window.travelMap.file.readLocalText(selected.local_path);
      setTextPreview(res?.ok ? res.text : "无法预览此文本文件，可用系统打开。");
    };
    void run();
  }, [selected]);

  if (loading) return <div className="p-5 text-sm text-neutral-400">正在加载本地资料...</div>;
  if (error) return <div className="p-5 text-sm text-neutral-400">{error}</div>;
  if (items.length === 0) return <div className="p-5 text-sm text-neutral-400">这个城市还没有附件或正文图片。</div>;

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[220px] shrink-0 border-r border-[var(--color-border)] overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.asset_id}
            onClick={() => setSelectedId(item.asset_id)}
            className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-white/5"
          >
            <span className="truncate text-sm text-white">{item.original_filename}</span>
            <span className="text-[11px] text-neutral-500">{item.trip_title} · {item.source_kind === "attachment" ? "附件" : "正文图片"}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {selected && getCityAssetPreviewKind(selected) === "image" && (
          <img
            src={selected.local_path.startsWith("assets/") ? `local://assets/${selected.local_path.slice("assets/".length)}` : `local:///${selected.local_path}`}
            alt={selected.original_filename}
            className="max-h-full rounded-lg"
          />
        )}
        {selected && getCityAssetPreviewKind(selected) === "pdf" && (
          <iframe
            title={selected.original_filename}
            src={selected.local_path.startsWith("assets/") ? `local://assets/${selected.local_path.slice("assets/".length)}` : `local:///${selected.local_path}`}
            className="h-full min-h-[480px] w-full rounded-lg border border-[var(--color-border)]"
          />
        )}
        {selected && getCityAssetPreviewKind(selected) === "text" && (
          <pre className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] p-4 text-sm text-neutral-200">{textPreview}</pre>
        )}
        {selected && getCityAssetPreviewKind(selected) === "external" && (
          <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-4 text-sm text-neutral-300">
            <p>此格式暂不支持站内预览。</p>
            <button
              onClick={() => void window.travelMap.file.openLocal(selected.local_path)}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
            >
              用系统打开
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire the new view into `Drawer.tsx`**

Modify `packages/renderer/src/components/Drawer.tsx`:

```tsx
import { CityAssets } from "./drawer/CityAssets";

{view === "city-assets" && (
  <CityAssets cityId={cityId} />
)}
```

Place it inside the existing `isCityDetail` fragment before the `trip-list` branch.

- [ ] **Step 6: Add the renderer test and run focused verification**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityAssetsPreview.test.ts
pnpm --filter @travel-map/renderer typecheck
pnpm --filter @travel-map/app typecheck
```

Expected:

- `cityAssetsPreview.test.ts`: PASS
- renderer typecheck: PASS
- app typecheck: PASS

- [ ] **Step 7: Run end-to-end manual verification in Electron**

Run:

```bash
pnpm dev:electron
```

Manual checks:

- Enter a fresh city and confirm the side panel shows an empty-state card instead of looking broken
- Create or open a Trip, upload one attachment, and insert one image into Markdown
- Return to city home, open `本地资料`, and verify both resources appear
- Preview an image, preview a `.md` or `.txt`, preview a `.pdf`, and open a non-previewable file externally

- [ ] **Step 8: Commit**

```bash
git add packages/renderer/src/components/drawer/cityAssetsPreview.ts packages/renderer/src/components/drawer/CityAssets.tsx packages/renderer/src/components/Drawer.tsx packages/renderer/test/cityAssetsPreview.test.ts
git commit -m "feat: add city local assets drawer view"
```

---

## Self-Review

### Spec coverage

- City home four-state behavior: covered in Task 3
- City asset aggregation and dedupe: covered in Task 1
- Safe local text preview: covered in Task 2
- Drawer `city-assets` view and preview matrix: covered in Task 4
- Targeted tests only for high-value logic: covered in Tasks 1, 2, 3, and 4

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation placeholders remain
- Every task includes file paths, concrete code, commands, and expected outcomes

### Type consistency

- `CityAsset` is introduced once in `packages/renderer/src/types/index.ts` and then reused by `CityAssets.tsx`
- `getCityAssets`, `readLocalText`, and `deriveCityHomeState` use the same names throughout all tasks

---

Plan complete and saved to `docs/superpowers/plans/2026-05-10-city-assets-and-city-home-states-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
