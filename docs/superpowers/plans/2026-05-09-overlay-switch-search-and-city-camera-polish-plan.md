# Overlay Switch Search And City Camera Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the top search UI from the instruction bubble, upgrade search ranking to prefix-first matching with highlight support, keep province hover-and-switch available in province/city views, and replace city `fitView` jumps with a drawer-aware city camera.

**Architecture:** Keep the existing map state and `openCityExperience(...)` flow, but push the new behavior into small focused modules. Search ranking and highlight become pure utilities inside `citySearchIndex.ts`, province hover reuse is handled by adding a lightweight secondary mode to `ProvinceLayer`, and city focusing moves behind a new `cityCamera.ts` utility so map click and search jumps share the same offset-aware camera math.

**Tech Stack:** React 19, TypeScript, Zustand, AMap JS API 2.0, Vite, Node `node:test`

---

## File Structure

**Create**
- `packages/renderer/src/features/map/cityCamera.ts`
- `packages/renderer/src/features/map/provinceLayerMode.ts`
- `packages/renderer/test/cityCamera.test.ts`
- `packages/renderer/test/provinceLayerMode.test.ts`

**Modify**
- `packages/renderer/src/features/map/citySearchIndex.ts`
- `packages/renderer/src/features/map/CitySearchBox.tsx`
- `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- `packages/renderer/src/features/map/MapView.tsx`
- `packages/renderer/src/features/map/geoUtils.ts`
- `packages/renderer/src/features/map/cityExperience.ts`
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- `packages/renderer/test/citySearchIndex.test.ts`

---

### Task 1: Prefix-First Search Ranking And Match Highlight

**Files:**
- Modify: `packages/renderer/src/features/map/citySearchIndex.ts`
- Modify: `packages/renderer/test/citySearchIndex.test.ts`

- [ ] **Step 1: Expand the failing search tests**

`packages/renderer/test/citySearchIndex.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCitySearchIndex,
  getSearchMatchParts,
  searchCityIndex,
} from "../src/features/map/citySearchIndex.ts";

test("searchCityIndex puts prefix matches ahead of contains matches", () => {
  const index = buildCitySearchIndex([
    {
      cityId: "110000",
      cityName: "北京",
      provinceId: "110000",
      provinceName: "北京",
      center: [116.4, 39.9],
    },
    {
      cityId: "310000",
      cityName: "上海",
      provinceId: "310000",
      provinceName: "上海",
      center: [121.47, 31.23],
    },
  ]);

  assert.deepEqual(
    searchCityIndex(index, "北").map((item) => item.cityId),
    ["110000"],
  );
  assert.deepEqual(
    searchCityIndex(index, "海").map((item) => item.cityId),
    ["310000"],
  );
});

test("getSearchMatchParts marks the matched prefix segment", () => {
  assert.deepEqual(getSearchMatchParts("北京", "北"), [
    { text: "北", matched: true },
    { text: "京", matched: false },
  ]);
});
```

- [ ] **Step 2: Run the focused search test to confirm it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/citySearchIndex.test.ts
```

Expected: FAIL because `getSearchMatchParts()` does not exist and `searchCityIndex()` still performs contains-only filtering without ranking.

- [ ] **Step 3: Implement prefix-first ranking and highlight segments**

`packages/renderer/src/features/map/citySearchIndex.ts`

```ts
export interface SearchMatchPart {
  text: string;
  matched: boolean;
}

type SearchableCityEntry = CitySearchEntry & {
  searchableText: string;
  cityNameLower: string;
  provinceNameLower: string;
};

export function buildCitySearchIndex(entries: CitySearchEntry[]) {
  return dedupeEntries(entries).map((entry) => ({
    ...entry,
    searchableText: `${entry.cityName} ${entry.provinceName}`.toLowerCase(),
    cityNameLower: entry.cityName.toLowerCase(),
    provinceNameLower: entry.provinceName.toLowerCase(),
  }));
}

function getMatchRank(entry: SearchableCityEntry, normalized: string) {
  if (entry.cityNameLower.startsWith(normalized)) return 0;
  if (entry.provinceNameLower.startsWith(normalized)) return 1;
  if (entry.cityNameLower.includes(normalized)) return 2;
  if (entry.provinceNameLower.includes(normalized)) return 3;
  return Number.POSITIVE_INFINITY;
}

export function searchCityIndex(index: SearchableCityEntry[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return index
    .map((entry) => ({ entry, rank: getMatchRank(entry, normalized) }))
    .filter((item) => Number.isFinite(item.rank))
    .sort((left, right) => left.rank - right.rank)
    .map((item) => item.entry)
    .slice(0, 8);
}

export function getSearchMatchParts(text: string, query: string): SearchMatchPart[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [{ text, matched: false }];

  const lower = text.toLowerCase();
  const start = lower.indexOf(normalized);
  if (start < 0) return [{ text, matched: false }];

  const end = start + normalized.length;
  return [
    ...(start > 0 ? [{ text: text.slice(0, start), matched: false }] : []),
    { text: text.slice(start, end), matched: true },
    ...(end < text.length ? [{ text: text.slice(end), matched: false }] : []),
  ];
}
```

- [ ] **Step 4: Re-run the focused search test**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/citySearchIndex.test.ts
```

Expected:

```text
# pass
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/citySearchIndex.ts packages/renderer/test/citySearchIndex.test.ts
git commit -m "feat: improve city search ranking and highlights"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 2: Split The Top Search Row From The Instruction Bubble

**Files:**
- Modify: `packages/renderer/src/features/map/CitySearchBox.tsx`
- Modify: `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`

- [ ] **Step 1: Make the search box render highlight segments**

`packages/renderer/src/features/map/CitySearchBox.tsx`

```tsx
import {
  getSearchMatchParts,
  loadCitySearchIndex,
  searchCityIndex,
  type CitySearchEntry,
} from "./citySearchIndex.ts";

function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  return (
    <>
      {getSearchMatchParts(text, query).map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.matched ? "text-white" : undefined}
        >
          {part.text}
        </span>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Split the overlay into an action row and an independent instruction bubble**

`packages/renderer/src/features/map/BreadCrumbOverlay.tsx`

```tsx
return (
  <div className="absolute top-4 left-4 z-10 text-xs">
    <div className="flex items-start gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/76 px-3 py-2 backdrop-blur-md">
        {/* existing breadcrumb content */}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            setSearchOpen((current) => !current);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-neutral-200 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
          aria-label="搜索城市"
        >
          {/* existing svg */}
        </button>

        <CitySearchBox
          open={searchOpen}
          onSelect={(entry) => {
            if (!map) return;
            openCityExperience(map, entry);
            setSearchOpen(false);
          }}
        />
      </div>
    </div>

    <div className="mt-2 rounded-lg border border-white/8 bg-black/45 px-3 py-2 text-[11px] text-neutral-200 backdrop-blur-md">
      {instruction}
    </div>
  </div>
);
```

- [ ] **Step 3: Render the highlighted search result text**

`packages/renderer/src/features/map/CitySearchBox.tsx`

```tsx
<button
  key={item.cityId}
  onMouseDown={(event) => {
    event.preventDefault();
    onSelect(item);
  }}
  className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
    index === activeIndex
      ? "bg-white/10 text-white"
      : "text-neutral-200 hover:bg-white/5"
  }`}
>
  <span>
    <HighlightText text={item.cityName} query={query} />
  </span>
  <span className="text-xs text-neutral-400">
    <HighlightText text={item.provinceName} query={query} />
  </span>
</button>
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/citySearchIndex.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/CitySearchBox.tsx packages/renderer/src/features/map/BreadCrumbOverlay.tsx packages/renderer/src/features/map/citySearchIndex.ts
git commit -m "fix: decouple top search and instruction overlays"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 3: Reuse Province Hover Switching Inside Province And City Views

**Files:**
- Create: `packages/renderer/src/features/map/provinceLayerMode.ts`
- Modify: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Modify: `packages/renderer/src/features/map/MapView.tsx`
- Test: `packages/renderer/test/provinceLayerMode.test.ts`

- [ ] **Step 1: Write the failing province-layer mode tests**

`packages/renderer/test/provinceLayerMode.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceLayerModeConfig } from "../src/features/map/provinceLayerMode.ts";

test("getProvinceLayerModeConfig keeps fitView on for country mode", () => {
  const config = getProvinceLayerModeConfig("country");

  assert.equal(config.fitView, true);
  assert.equal(config.fillOpacity, 0.035);
});

test("getProvinceLayerModeConfig disables fitView and weakens overlay mode", () => {
  const config = getProvinceLayerModeConfig("overlay");

  assert.equal(config.fitView, false);
  assert.ok(config.fillOpacity < 0.02);
  assert.ok(config.zIndex < 60);
});
```

- [ ] **Step 2: Run the focused mode test to confirm it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceLayerMode.test.ts
```

Expected: FAIL because `provinceLayerMode.ts` does not exist.

- [ ] **Step 3: Add the reusable layer mode helper**

`packages/renderer/src/features/map/provinceLayerMode.ts`

```ts
export type ProvinceLayerMode = "country" | "overlay";

export function getProvinceLayerModeConfig(mode: ProvinceLayerMode) {
  if (mode === "overlay") {
    return {
      fitView: false,
      zIndex: 45,
      fillOpacity: 0.012,
      activeFillOpacity: 0.045,
      strokeWeight: 1.3,
      activeStrokeWeight: 2.1,
    };
  }

  return {
    fitView: true,
    zIndex: 60,
    fillOpacity: 0.035,
    activeFillOpacity: 0.08,
    strokeWeight: 2.2,
    activeStrokeWeight: 3.2,
  };
}
```

- [ ] **Step 4: Apply overlay mode in `ProvinceLayer` and mount it in non-country views**

`packages/renderer/src/features/map/layers/ProvinceLayer.tsx`

```tsx
import {
  getProvinceLayerModeConfig,
  type ProvinceLayerMode,
} from "../provinceLayerMode.ts";

export function ProvinceLayer({
  map,
  features,
  hoveredProvinceId,
  onProvinceHoverChange,
  mode = "country",
}: {
  map: any;
  features: GeoFeature[];
  hoveredProvinceId: string | null;
  onProvinceHoverChange: (next: ProvinceHoverState | null) => void;
  mode?: ProvinceLayerMode;
}) {
  const modeConfig = getProvinceLayerModeConfig(mode);

  const normalStyle = {
    strokeColor: PROVINCE_LAYER_TOKENS.stroke,
    strokeWeight: modeConfig.strokeWeight,
    strokeOpacity: 0.92,
    fillColor: PROVINCE_LAYER_TOKENS.fill,
    fillOpacity: modeConfig.fillOpacity,
    cursor: "pointer" as const,
    zIndex: modeConfig.zIndex,
  };

  const activeStyle = {
    strokeColor: PROVINCE_LAYER_TOKENS.hoverStroke,
    strokeWeight: modeConfig.activeStrokeWeight,
    strokeOpacity: 1,
    fillColor: PROVINCE_LAYER_TOKENS.hoverFill,
    fillOpacity: modeConfig.activeFillOpacity,
    cursor: "pointer" as const,
    zIndex: modeConfig.zIndex + 10,
  };

  // reuse normalStyle / activeStyle in the existing polygon render and hoveredProvinceId effect
  // replace options.fitView with modeConfig.fitView
}
```

`packages/renderer/src/features/map/MapView.tsx`

```tsx
{map && provinceBoundaryStatus === "ready" && level === "country" && (
  <ProvinceLayer
    map={map}
    features={provinceFeatures}
    hoveredProvinceId={provinceHover?.provinceId ?? null}
    onProvinceHoverChange={handleProvinceHoverChange}
    mode="country"
  />
)}

{map && provinceBoundaryStatus === "ready" && (level === "province" || level === "city") && (
  <ProvinceLayer
    map={map}
    features={provinceFeatures}
    hoveredProvinceId={provinceHover?.provinceId ?? null}
    onProvinceHoverChange={handleProvinceHoverChange}
    mode="overlay"
  />
)}

{map && (level === "country" || level === "province" || level === "city") && (
  <ProvinceHoverOverlay hover={provinceHover} />
)}
```

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceLayerMode.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/provinceLayerMode.ts packages/renderer/src/features/map/layers/ProvinceLayer.tsx packages/renderer/src/features/map/MapView.tsx packages/renderer/test/provinceLayerMode.test.ts
git commit -m "feat: keep province hover switching in drilldown views"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 4: Replace City `fitView` With A Drawer-Aware City Camera

**Files:**
- Create: `packages/renderer/src/features/map/cityCamera.ts`
- Modify: `packages/renderer/src/features/map/geoUtils.ts`
- Modify: `packages/renderer/src/features/map/cityExperience.ts`
- Test: `packages/renderer/test/cityCamera.test.ts`

- [ ] **Step 1: Write the failing city-camera tests**

`packages/renderer/test/cityCamera.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getCityCameraTarget } from "../src/features/map/cityCamera.ts";

test("getCityCameraTarget shifts the visual center left when the drawer is open", () => {
  const target = getCityCameraTarget({
    bounds: { minLng: 119.8, maxLng: 120.6, minLat: 29.9, maxLat: 30.5 },
    visualCenter: [120.2, 30.2],
    viewport: { width: 1440, height: 900 },
    drawerOpen: true,
  });

  assert.ok(target.center[0] < 120.2);
});

test("getCityCameraTarget keeps top padding large enough to avoid top-clinging framing", () => {
  const target = getCityCameraTarget({
    bounds: { minLng: 121.0, maxLng: 121.8, minLat: 30.8, maxLat: 31.4 },
    visualCenter: [121.4, 31.1],
    viewport: { width: 1440, height: 900 },
    drawerOpen: true,
  });

  assert.ok(target.zoom > 0);
});
```

- [ ] **Step 2: Run the focused camera test to confirm it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityCamera.test.ts
```

Expected: FAIL because `cityCamera.ts` does not exist.

- [ ] **Step 3: Add the city camera utility**

`packages/renderer/src/features/map/cityCamera.ts`

```ts
import { DRAWER_WIDTH } from "./mapLayout.js";
import type { ProvinceCameraBounds } from "./provinceCamera.ts";

export interface CityCameraInput {
  bounds: ProvinceCameraBounds;
  visualCenter: [number, number];
  viewport: {
    width: number;
    height: number;
  };
  drawerOpen: boolean;
  minZoom?: number;
  maxZoom?: number;
}

export function getCityCameraTarget(input: CityCameraInput) {
  const leftPadding = 80;
  const rightPadding = input.drawerOpen ? DRAWER_WIDTH + 96 : 96;
  const topPadding = 112;
  const bottomPadding = 88;
  const availableWidth = Math.max(
    input.viewport.width - leftPadding - rightPadding,
    320,
  );
  const availableHeight = Math.max(
    input.viewport.height - topPadding - bottomPadding,
    240,
  );
  const lngSpan = Math.max(input.bounds.maxLng - input.bounds.minLng, 0.01);
  const latSpan = Math.max(input.bounds.maxLat - input.bounds.minLat, 0.01);
  const horizontalZoom = Math.log2((360 * availableWidth) / (lngSpan * 256));
  const verticalZoom = Math.log2((180 * availableHeight) / (latSpan * 256));
  const zoom = Math.max(
    input.minZoom ?? 6.4,
    Math.min(Math.min(horizontalZoom, verticalZoom) + 0.18, input.maxZoom ?? 11.2),
  );

  const drawerRatio = input.drawerOpen
    ? DRAWER_WIDTH / Math.max(input.viewport.width, 1)
    : 0;
  const centerLngOffset = lngSpan * (0.18 + drawerRatio * 0.35);

  return {
    center: [Number((input.visualCenter[0] - centerLngOffset).toFixed(6)), input.visualCenter[1]] as [number, number],
    zoom: Number(zoom.toFixed(2)),
  };
}
```

- [ ] **Step 4: Wire `openCityExperience(...)` through the new city camera**

`packages/renderer/src/features/map/geoUtils.ts`

```ts
import { getCityCameraTarget } from "./cityCamera.ts";

export function focusCityOnMap(
  map: any,
  input: {
    geometry?: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
    visualCenter: [number, number];
    drawerOpen: boolean;
  },
) {
  if (input.geometry) {
    const size = map.getSize?.() ?? { width: 1280, height: 720 };
    const bounds = geometryBounds(input.geometry);
    const target = getCityCameraTarget({
      bounds,
      visualCenter: input.visualCenter,
      viewport: {
        width: typeof size.width === "number" ? size.width : 1280,
        height: typeof size.height === "number" ? size.height : 720,
      },
      drawerOpen: input.drawerOpen,
    });

    map.setZoomAndCenter(target.zoom, target.center, false);
    return;
  }

  map.setZoomAndCenter?.(9.2, input.visualCenter, false);
}
```

`packages/renderer/src/features/map/cityExperience.ts`

```ts
import { focusCityOnMap } from "./geoUtils.ts";
import { useMapStore } from "./mapStore.ts";

export function openCityExperience(
  map: any,
  input: {
    provinceId: string;
    provinceName: string;
    cityId: string;
    cityName: string;
    center: [number, number];
    geometry?: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
  },
) {
  useMapStore.getState().openCityExperience({
    provinceId: input.provinceId,
    provinceName: input.provinceName,
    cityId: input.cityId,
    cityName: input.cityName,
  });

  focusCityOnMap(map, {
    geometry: input.geometry,
    visualCenter: input.center,
    drawerOpen: true,
  });
}
```

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityCamera.test.ts test/cityExperience.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/cityCamera.ts packages/renderer/src/features/map/geoUtils.ts packages/renderer/src/features/map/cityExperience.ts packages/renderer/test/cityCamera.test.ts
git commit -m "feat: add drawer-aware city camera"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 5: Final Validation And Handoff

**Files:**
- Modify only if validation reveals issues in the touched files

- [ ] **Step 1: Run the targeted renderer suite**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/citySearchIndex.test.ts test/provinceLayerMode.test.ts test/cityCamera.test.ts test/cityExperience.test.ts test/mapStore.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 2: Verify diagnostics are clean for all touched files**

Inspect IDE diagnostics for:

```text
packages/renderer/src/features/map/citySearchIndex.ts
packages/renderer/src/features/map/CitySearchBox.tsx
packages/renderer/src/features/map/BreadCrumbOverlay.tsx
packages/renderer/src/features/map/provinceLayerMode.ts
packages/renderer/src/features/map/layers/ProvinceLayer.tsx
packages/renderer/src/features/map/MapView.tsx
packages/renderer/src/features/map/cityCamera.ts
packages/renderer/src/features/map/geoUtils.ts
packages/renderer/src/features/map/cityExperience.ts
```

Expected: No new diagnostics remain in the touched files.

- [ ] **Step 3: Run the manual acceptance checklist**

Manual checks:

```text
1. Expand the top search field and confirm the instruction bubble below does not change width.
2. Type 北 and confirm Beijing appears before any contains-only result.
3. Type 海 and confirm Shanghai still appears as a contains match.
4. Enter Hubei, hover Hunan or Henan, and confirm the province follow tag appears and clicking switches province directly.
5. Click a city and confirm the city body sits left of center and no longer hugs the top edge.
6. Search into a city and confirm the camera framing matches the map-click city framing.
```

Expected: All checks pass without regressing province drilldown, drawer visibility, or the new top search entry.

- [ ] **Step 4: Commit any final polish fixes and push**

```bash
git add .
git commit -m "feat: finish overlay switch and city camera polish"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

- [ ] **Step 5: Prepare the handoff summary**

Handoff bullets:

```text
- Top search row and instruction bubble are now fully independent.
- Search results use prefix-first ranking and highlight matched text.
- Province hover-and-click switching remains available in province and city views.
- City jumps use the same drawer-aware camera for map clicks and search entry.
- Tests, typecheck, diagnostics, and manual checks all pass.
```
