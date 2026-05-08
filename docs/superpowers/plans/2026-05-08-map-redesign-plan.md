# Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the map drill-down, real-boundary rendering, and sidebar interaction model so the China view, province view, and city details match the approved design spec.

**Architecture:** Keep the existing React + Zustand + AMap structure, but separate the work into stable units: geometry/layout helpers, map layers, and sidebar/control surfaces. Remove fake city-boundary fallback, unify drawer state semantics, and move repeated map/sidebar constants into shared helpers so province and city flows behave consistently.

**Tech Stack:** React 19, TypeScript, Zustand, AMap JS API, node:test, Vite, Electron renderer

---

## File Structure

**Modify**
- `packages/renderer/src/features/map/geoUtils.ts`
  - Replace rough centroid logic with reusable geometry helpers and drawer-aware fit padding helpers.
- `packages/renderer/src/features/map/mapStore.ts`
  - Simplify drill-down and drawer semantics so province and city views share one source of truth.
- `packages/renderer/src/features/map/MapView.tsx`
  - Inject boundary warning UI and wire the revised layer/sidebar flow.
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
  - Rework province rendering, tooltip, and focus behavior to use the new visual language.
- `packages/renderer/src/features/map/layers/CityLayer.tsx`
  - Remove fake fallback, surface boundary availability state, and stop city-click auto-fit.
- `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`
  - Reduce label density and align positions with improved geometry helpers.
- `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
  - Reduce responsibilities to navigation + lightweight instructions only.
- `packages/renderer/src/App.tsx`
  - Remove duplicated top-right drawer controls and keep a single sidebar entry path.
- `packages/renderer/src/components/Drawer.tsx`
  - Split province weak sidebar vs city strong sidebar inside a single shell.
- `packages/renderer/src/components/drawer/CityHome.tsx`
  - Adjust the city-home entry section to fit the stronger sidebar hierarchy.
- `packages/renderer/src/styles/globals.css`
  - Replace current boundary/drawer visual tokens and stop hiding AMap attribution.

**Create**
- `packages/renderer/src/features/map/mapLayout.ts`
  - Shared drawer width, map fit padding, and map-layer visual tokens.
- `packages/renderer/src/components/drawer/ProvinceOverview.tsx`
  - Province weak-sidebar content.
- `packages/renderer/test/geoUtils.test.ts`
  - Geometry helper and padding tests.
- `packages/renderer/test/mapStore.test.ts`
  - Drawer/level semantics tests.

**Validate**
- `packages/renderer/test/ui.test.ts`
  - Keep as regression reference for the existing node:test style.
- `docs/superpowers/specs/2026-05-08-map-redesign-design.md`
  - Source-of-truth spec for all requirements below.

---

### Task 1: Stabilize geometry and state primitives

**Files:**
- Create: `packages/renderer/src/features/map/mapLayout.ts`
- Modify: `packages/renderer/src/features/map/geoUtils.ts`
- Modify: `packages/renderer/src/features/map/mapStore.ts`
- Test: `packages/renderer/test/geoUtils.test.ts`
- Test: `packages/renderer/test/mapStore.test.ts`

- [ ] **Step 1: Write the failing geometry and store tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  featureCenter,
  getDrawerFitPadding,
} from "../src/features/map/geoUtils.ts";
import { useMapStore } from "../src/features/map/mapStore.ts";

test("getDrawerFitPadding uses drawer width when sidebar is open", () => {
  assert.deepEqual(getDrawerFitPadding({ drawerOpen: true }), [80, 560, 80, 80]);
  assert.deepEqual(getDrawerFitPadding({ drawerOpen: false }), [80, 80, 80, 80]);
});

test("featureCenter falls back to polygon bounds midpoint", () => {
  const center = featureCenter({
    type: "Polygon",
    coordinates: [[[120, 30], [124, 30], [124, 34], [120, 34], [120, 30]]],
  });
  assert.deepEqual(center, [122, 32]);
});

test("enterProvince opens province context without clearing province identity", () => {
  useMapStore.getState().enterProvince("330000", "浙江");
  const state = useMapStore.getState();
  assert.equal(state.level, "province");
  assert.equal(state.provinceName, "浙江");
  assert.equal(state.drawerOpen, true);
});

test("closing drawer keeps selected city context", () => {
  useMapStore.getState().enterCity("330100", "杭州");
  useMapStore.getState().setDrawerOpen(false);
  const state = useMapStore.getState();
  assert.equal(state.level, "city");
  assert.equal(state.cityName, "杭州");
  assert.equal(state.drawerOpen, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/geoUtils.test.ts test/mapStore.test.ts
```

Expected: FAIL because `getDrawerFitPadding` does not exist yet and store semantics are not fully locked down by tests.

- [ ] **Step 3: Add shared layout tokens and geometry helpers**

Create `packages/renderer/src/features/map/mapLayout.ts`:

```ts
export const DRAWER_WIDTH = 480;
export const DRAWER_COLLAPSED_OFFSET = 16;

export const MAP_FIT_PADDING_CLOSED: [number, number, number, number] = [80, 80, 80, 80];
export const MAP_FIT_PADDING_OPEN: [number, number, number, number] = [80, DRAWER_WIDTH + 80, 80, 80];

export const PROVINCE_STROKE = "#b6c2cf";
export const PROVINCE_HOVER_STROKE = "#e6edf5";
export const CITY_STROKE = "#65a9d9";
export const CITY_HOVER_STROKE = "#9dd7ff";
```

Update `packages/renderer/src/features/map/geoUtils.ts`:

```ts
import { MAP_FIT_PADDING_CLOSED, MAP_FIT_PADDING_OPEN } from "./mapLayout";

export function featureCenter(geometry: {
  type: string;
  coordinates: number[][][] | number[][][][];
}): [number, number] {
  const rings =
    geometry.type === "Polygon"
      ? (geometry.coordinates as number[][][])
      : (geometry.coordinates as number[][][][]).flat();

  const points = rings.flat();
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

export function getDrawerFitPadding(input: { drawerOpen: boolean }) {
  return input.drawerOpen ? MAP_FIT_PADDING_OPEN : MAP_FIT_PADDING_CLOSED;
}
```

Update `packages/renderer/src/features/map/mapStore.ts` only minimally:

```ts
setDrawerOpen: (open) => set((state) => ({
  drawerOpen: open,
  provinceId: state.provinceId,
  cityId: state.cityId,
})),
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/geoUtils.test.ts test/mapStore.test.ts
```

Expected: PASS for both new test files.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/mapLayout.ts packages/renderer/src/features/map/geoUtils.ts packages/renderer/src/features/map/mapStore.ts packages/renderer/test/geoUtils.test.ts packages/renderer/test/mapStore.test.ts
git commit -m "refactor: stabilize map geometry and drawer state"
```

---

### Task 2: Rebuild province and city boundary rendering

**Files:**
- Modify: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Modify: `packages/renderer/src/features/map/layers/CityLayer.tsx`
- Modify: `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`
- Modify: `packages/renderer/src/features/map/MapView.tsx`
- Test: `packages/renderer/test/geoUtils.test.ts`

- [ ] **Step 1: Extend tests for real-boundary-only behavior**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeProvinceAdcode, hasRealCityBoundaryData } from "../src/features/map/layers/CityLayer.tsx";

test("normalizeProvinceAdcode pads 2-digit province ids", () => {
  assert.equal(normalizeProvinceAdcode("33"), "330000");
  assert.equal(normalizeProvinceAdcode("330000"), "330000");
});

test("hasRealCityBoundaryData rejects empty collections", () => {
  assert.equal(hasRealCityBoundaryData([]), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/geoUtils.test.ts
```

Expected: FAIL because the city-layer helpers are not exported yet.

- [ ] **Step 3: Remove fake fallback and align rendering behavior**

Update `packages/renderer/src/features/map/layers/CityLayer.tsx`:

```ts
export function normalizeProvinceAdcode(provinceId: string): string {
  return provinceId.length === 2 ? `${provinceId}0000` : provinceId;
}

export function hasRealCityBoundaryData(features: GeoFeature[]) {
  return features.length > 0;
}

async function loadLocalCities(provinceId: string): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const dedicated = await loadGeoJson(`provinces/${provinceAdcode}.json`);
    if (hasRealCityBoundaryData(dedicated.features)) return dedicated.features;
  } catch {}

  const response = await fetch("/geo/china-provinces-cities.geojson");
  if (!response.ok) return [];

  const raw = (await response.json()) as { features?: RawMasterFeature[] };
  return (raw.features ?? [])
    .filter((item) => item.properties?.level === "city")
    .filter((item) => toAdcode(item.properties?.parent?.adcode) === provinceAdcode)
    .map(toGeoFeature)
    .filter((item): item is GeoFeature => item !== null);
}

polygon.on("click", () => {
  const { id, name } = feature.properties;
  enterCity(id, name);
});
```

Update `packages/renderer/src/features/map/MapView.tsx`:

```tsx
const [boundaryWarning, setBoundaryWarning] = useState<string | null>(null);

{boundaryWarning && (
  <div className="absolute left-4 top-26 z-30 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-neutral-200 backdrop-blur">
    {boundaryWarning}
  </div>
)}

<CityLayer
  map={map}
  provinceId={provinceId}
  onBoundaryWarning={setBoundaryWarning}
/>
```

Update `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`:

```ts
const NORMAL_STYLE = {
  strokeColor: PROVINCE_STROKE,
  strokeWeight: 2.2,
  strokeOpacity: 0.9,
  fillColor: "#dbe4ee",
  fillOpacity: 0.035,
  cursor: "pointer" as const,
  zIndex: 60,
};
```

Update `packages/renderer/src/features/map/ProvinceTagOverlay.tsx` so hidden labels are filtered:

```ts
const tags = features
  .filter((feature) => map.getZoom() >= 4.3 || feature.properties.name.length <= 2)
  .map(/* existing projection logic */);
```

- [ ] **Step 4: Run tests and manual map smoke check**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/geoUtils.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS.

Manual smoke check:
- Country view shows restrained province outlines.
- Entering Zhejiang uses real province drill-down.
- Missing province city-boundary data shows warning text instead of fake boxes.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/layers/ProvinceLayer.tsx packages/renderer/src/features/map/layers/CityLayer.tsx packages/renderer/src/features/map/ProvinceTagOverlay.tsx packages/renderer/src/features/map/MapView.tsx packages/renderer/test/geoUtils.test.ts
git commit -m "refactor: render only real map boundaries"
```

---

### Task 3: Rebuild the sidebar shell and control model

**Files:**
- Create: `packages/renderer/src/components/drawer/ProvinceOverview.tsx`
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Modify: `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- Modify: `packages/renderer/src/App.tsx`
- Modify: `packages/renderer/src/features/map/mapStore.ts`
- Test: `packages/renderer/test/mapStore.test.ts`

- [ ] **Step 1: Write the failing store and sidebar tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { useMapStore } from "../src/features/map/mapStore.ts";

test("enterProvince opens weak sidebar content", () => {
  useMapStore.getState().enterProvince("330000", "浙江");
  const state = useMapStore.getState();
  assert.equal(state.level, "province");
  assert.equal(state.drawerOpen, true);
});

test("backToProvince preserves drawer visibility for province overview", () => {
  useMapStore.getState().enterCity("330100", "杭州");
  useMapStore.getState().backToProvince();
  const state = useMapStore.getState();
  assert.equal(state.level, "province");
  assert.equal(state.drawerOpen, true);
});
```

- [ ] **Step 2: Run tests to verify they fail where behavior differs**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/mapStore.test.ts
```

Expected: FAIL or expose missing sidebar assumptions while refactor is in progress.

- [ ] **Step 3: Implement a single sidebar shell**

Create `packages/renderer/src/components/drawer/ProvinceOverview.tsx`:

```tsx
interface ProvinceOverviewProps {
  provinceName: string;
}

export function ProvinceOverview({ provinceName }: ProvinceOverviewProps) {
  return (
    <section className="flex h-full flex-col gap-4 p-5">
      <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="text-sm text-neutral-400">当前省份</div>
        <div className="mt-2 text-2xl font-semibold text-white">{provinceName}</div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-neutral-300">
        单击地图中的城市边界或城市标签，打开该城市的详情侧边栏。
      </div>
    </section>
  );
}
```

Update `packages/renderer/src/components/Drawer.tsx`:

```tsx
const showShell = level !== "country";
const isProvinceOverview = level === "province";

{isProvinceOverview && provinceName && (
  <ProvinceOverview provinceName={provinceName} />
)}

{level === "city" && cityName && cityId && provinceId && provinceName && (
  // existing city-home / trip-list / trip-detail / poi-detail flow
)}
```

Update `packages/renderer/src/App.tsx` to remove top-right duplicated buttons:

```tsx
<Drawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  onToggle={() => setDrawerOpen(!drawerOpen)}
/>
```

Update `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`:

```tsx
{level !== "country" && (
  <button
    onClick={() => setDrawerOpen(!drawerOpen)}
    type="button"
    className="ml-2 rounded border border-white/10 bg-black/35 px-2 py-1 text-[10px] text-neutral-200"
  >
    {drawerOpen ? "收起侧栏" : "展开侧栏"}
  </button>
)}
```

- [ ] **Step 4: Run tests and manual interaction checks**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/mapStore.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS.

Manual checks:
- Province view shows a real weak sidebar.
- City click opens a strong sidebar without losing context after collapse.
- There is only one obvious drawer toggle path.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/components/drawer/ProvinceOverview.tsx packages/renderer/src/components/Drawer.tsx packages/renderer/src/features/map/BreadCrumbOverlay.tsx packages/renderer/src/App.tsx packages/renderer/src/features/map/mapStore.ts packages/renderer/test/mapStore.test.ts
git commit -m "refactor: rebuild map sidebar flow"
```

---

### Task 4: Unify map and sidebar visuals

**Files:**
- Modify: `packages/renderer/src/styles/globals.css`
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Modify: `packages/renderer/src/components/drawer/CityHome.tsx`
- Modify: `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- Modify: `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`

- [ ] **Step 1: Add a minimal visual regression checklist to the plan notes**

Use this checklist during manual verification:

```md
- Province borders look restrained instead of neon orange
- City borders remain readable on dark basemap
- Province sidebar feels like an overview, not an error placeholder
- City sidebar header, action bar, and body spacing feel consistent
- Map attribution remains visible
```

- [ ] **Step 2: Implement the token and spacing cleanup**

Update `packages/renderer/src/styles/globals.css`:

```css
:root {
  --drawer-width: 480px;
  --color-accent: #6ea8d7;
  --color-bg: #081018;
  --color-surface: rgba(11, 18, 26, 0.88);
  --color-surface-elevated: rgba(18, 28, 39, 0.96);
  --color-border: rgba(205, 220, 235, 0.12);
}

.amap-logo,
.amap-copyright {
  display: block !important;
}
```

Update `packages/renderer/src/components/Drawer.tsx` header/body styles:

```tsx
<aside className="absolute top-0 right-0 bottom-0 flex w-[var(--drawer-width)] max-w-full flex-col border-l border-white/10 bg-[var(--color-surface)] shadow-2xl backdrop-blur-xl">
```

Update `packages/renderer/src/components/drawer/CityHome.tsx` top card styles so they match the stronger shell:

```tsx
<section className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
```

- [ ] **Step 3: Run typecheck and perform browser/Electron visual pass**

Run:

```bash
pnpm --filter @travel-map/renderer typecheck
pnpm dev
pnpm dev:electron:local
```

Expected:
- Typecheck PASS
- Browser and Electron open successfully
- No map-attribution hiding remains

- [ ] **Step 4: Commit**

```bash
git add packages/renderer/src/styles/globals.css packages/renderer/src/components/Drawer.tsx packages/renderer/src/components/drawer/CityHome.tsx packages/renderer/src/features/map/BreadCrumbOverlay.tsx packages/renderer/src/features/map/ProvinceTagOverlay.tsx
git commit -m "style: unify map and sidebar visuals"
```

---

### Task 5: Full verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-05-08-map-redesign-design.md` (only if implementation scope changes)
- Validate: `packages/renderer/src/App.tsx`
- Validate: `packages/renderer/src/features/map/MapView.tsx`
- Validate: `packages/renderer/src/components/Drawer.tsx`

- [ ] **Step 1: Run the focused automated checks**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/geoUtils.test.ts test/mapStore.test.ts test/ui.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS.

- [ ] **Step 2: Run end-to-end manual smoke checks**

Manual checks:

```md
1. Open country view and confirm province borders/labels are readable.
2. Click 浙江 and confirm map focuses on province and weak sidebar appears.
3. Click 杭州 and confirm city details open without a second large camera jump.
4. Collapse and reopen the sidebar; city context persists.
5. Press Esc; sidebar collapses but map level stays unchanged.
6. Navigate back to country via breadcrumb.
7. Open a province without dedicated city GeoJSON and confirm a warning is shown instead of fake boxes.
```

- [ ] **Step 3: Review diagnostics and git status**

Run:

```bash
pnpm --filter @travel-map/renderer typecheck
git status --short
```

Expected: no unexpected uncommitted files after final commit prep.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: overhaul map drilldown and sidebar UX"
```

- [ ] **Step 5: Push after review**

```bash
git push origin HEAD:main
```

Expected: push succeeds; if remote rejects, stop and ask for guidance before rewriting history.

---

## Self-Review

### Spec coverage
- Real boundary only, no fake fallback: covered by Task 2.
- Single, stable sidebar control model: covered by Task 3.
- Province weak sidebar and city strong sidebar: covered by Task 3.
- Visual cleanup for borders, labels, and shell: covered by Task 4.
- Browser/Electron verification and commit discipline: covered by Task 5.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Each task includes explicit file paths, commands, and expected outcomes.

### Type consistency
- Shared geometry and padding helpers live in `geoUtils.ts` and `mapLayout.ts`.
- Sidebar semantics remain centered on `level`, `drawerOpen`, `provinceId`, and `cityId`.
- Boundary loading behavior is defined in `CityLayer.tsx` and consumed by `MapView.tsx`.
