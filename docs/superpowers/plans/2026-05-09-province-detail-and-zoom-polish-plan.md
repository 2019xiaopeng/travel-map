# Province Detail And Zoom Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Taiwan's special province boundary URL, make province entry zoom feel closer, fix the province drawer body visibility, and upgrade the province drawer into a lightweight overview card with city list and a capital photo card.

**Architecture:** Keep the current national province boundary pipeline intact and patch province-level behavior at runtime. Province URLs move behind a small adapter with a Taiwan special case, the camera math gains a configurable bias layer, the drawer gets explicit width/visibility guarantees, and province overview content reads from a lightweight static metadata module plus parsed city boundary data.

**Tech Stack:** React 19, TypeScript, Zustand, AMap JS API 2.0, Vite, Node `node:test`

---

## File Structure

**Create**
- `packages/renderer/src/features/map/provinceDetailData.ts`
- `packages/renderer/src/features/map/provinceCityList.ts`
- `packages/renderer/test/provinceDetailData.test.ts`

**Modify**
- `packages/renderer/src/features/map/provinceBoundaryUrl.ts`
- `packages/renderer/src/features/map/provinceCamera.ts`
- `packages/renderer/src/features/map/geoUtils.ts`
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- `packages/renderer/src/features/map/layers/CityLayer.tsx`
- `packages/renderer/src/components/Drawer.tsx`
- `packages/renderer/src/components/drawer/ProvinceOverview.tsx`
- `packages/renderer/src/features/map/mapStore.ts`
- `packages/renderer/test/provinceBoundaryUrl.test.ts`
- `packages/renderer/test/provinceCamera.test.ts`

---

### Task 1: Taiwan Province URL Adapter

**Files:**
- Modify: `packages/renderer/src/features/map/provinceBoundaryUrl.ts`
- Modify: `packages/renderer/test/provinceBoundaryUrl.test.ts`

- [ ] **Step 1: Write the failing Taiwan URL test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { buildProvinceBoundaryUrl } from "../src/features/map/provinceBoundaryUrl.ts";

test("buildProvinceBoundaryUrl uses the dedicated Taiwan endpoint", () => {
  assert.equal(
    buildProvinceBoundaryUrl("710000"),
    "https://geojson.cn/api/china/1.6.3/710000.topo.json",
  );
});
```

- [ ] **Step 2: Run the focused URL test to confirm it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryUrl.test.ts
```

Expected: FAIL because `710000` still resolves to the generic `tiandi` URL.

- [ ] **Step 3: Implement the Taiwan special case**

`packages/renderer/src/features/map/provinceBoundaryUrl.ts`

```ts
const GEOJSON_CN_VERSION = "1.6.3";

export function buildCountryBoundaryUrl() {
  return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/china.topo.json`;
}

export function buildProvinceBoundaryUrl(provinceAdcode: string) {
  if (provinceAdcode === "710000") {
    return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/710000.topo.json`;
  }

  return `https://geojson.cn/api/tiandi/100000/${provinceAdcode}.json`;
}
```

- [ ] **Step 4: Run the URL test again**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryUrl.test.ts
```

Expected:

```text
# pass
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/provinceBoundaryUrl.ts packages/renderer/test/provinceBoundaryUrl.test.ts
git commit -m "fix: add dedicated Taiwan province boundary url"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 2: Province Camera Bias And Protection

**Files:**
- Modify: `packages/renderer/src/features/map/provinceCamera.ts`
- Modify: `packages/renderer/src/features/map/geoUtils.ts`
- Modify: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Modify: `packages/renderer/test/provinceCamera.test.ts`

- [ ] **Step 1: Add the failing zoom bias tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceCameraTarget } from "../src/features/map/provinceCamera.ts";

test("getProvinceCameraTarget applies a positive zoom bias for normal provinces", () => {
  const base = getProvinceCameraTarget({
    provinceId: "330000",
    bounds: { minLng: 118, maxLng: 123, minLat: 27, maxLat: 31 },
    visualCenter: [120.15, 29.2],
    viewport: { width: 1200, height: 900 },
  });

  assert.ok(base.zoom > 6);
});

test("getProvinceCameraTarget keeps Taiwan under a tighter max zoom", () => {
  const target = getProvinceCameraTarget({
    provinceId: "710000",
    bounds: { minLng: 120.0, maxLng: 122.1, minLat: 21.8, maxLat: 25.4 },
    visualCenter: [121, 23.7],
    viewport: { width: 1200, height: 900 },
  });

  assert.ok(target.zoom <= 9.2);
});
```

- [ ] **Step 2: Run the camera tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceCamera.test.ts
```

Expected: FAIL because the current camera input has no `provinceId` support and no bias logic.

- [ ] **Step 3: Implement zoom bias and special-province protection**

`packages/renderer/src/features/map/provinceCamera.ts`

```ts
const CAMERA_PROFILE_BY_PROVINCE: Record<string, { zoomBias: number; maxZoom?: number }> = {
  "230000": { zoomBias: 0.22, maxZoom: 8.9 },
  "150000": { zoomBias: 0.18, maxZoom: 8.8 },
  "650000": { zoomBias: 0.18, maxZoom: 8.8 },
  "540000": { zoomBias: 0.16, maxZoom: 8.7 },
  "460000": { zoomBias: 0.2, maxZoom: 9.1 },
  "710000": { zoomBias: 0.14, maxZoom: 9.2 },
};

export interface ProvinceCameraInput {
  provinceId: string;
  bounds: ProvinceCameraBounds;
  visualCenter: [number, number];
  viewport: {
    width: number;
    height: number;
  };
  edgePadding?: number;
  minZoom?: number;
  maxZoom?: number;
}

export function getProvinceCameraTarget(input: ProvinceCameraInput) {
  const profile = CAMERA_PROFILE_BY_PROVINCE[input.provinceId] ?? {
    zoomBias: 0.28,
    maxZoom: input.maxZoom ?? 9.3,
  };
  const edgePadding = input.edgePadding ?? 20;
  const minZoom = input.minZoom ?? 4.5;
  const maxZoom = profile.maxZoom ?? input.maxZoom ?? 9.3;
  const availableWidth = Math.max(input.viewport.width - edgePadding * 2, 320);
  const availableHeight = Math.max(input.viewport.height - edgePadding * 2, 240);
  const lngSpan = Math.max(input.bounds.maxLng - input.bounds.minLng, 0.01);
  const latSpan = Math.max(input.bounds.maxLat - input.bounds.minLat, 0.01);
  const horizontalZoom = Math.log2((360 * availableWidth) / (lngSpan * 256));
  const verticalZoom = Math.log2((180 * availableHeight) / (latSpan * 256));
  const safeZoom = Math.min(horizontalZoom, verticalZoom) + profile.zoomBias;
  const zoom = Math.max(minZoom, Math.min(safeZoom, maxZoom));

  return {
    center: input.visualCenter,
    zoom: Number(zoom.toFixed(2)),
  };
}
```

`packages/renderer/src/features/map/geoUtils.ts`

```ts
export interface FocusProvinceInput {
  provinceId: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  visualCenter: [number, number];
  bounds: ProvinceCameraBounds;
}

export function focusProvinceOnMap(map: any, input: FocusProvinceInput) {
  const size = map.getSize?.() ?? { width: 1280, height: 720 };
  const target = getProvinceCameraTarget({
    provinceId: input.provinceId,
    bounds: input.bounds,
    visualCenter: input.visualCenter,
    viewport: {
      width: typeof size.width === "number" ? size.width : 1280,
      height: typeof size.height === "number" ? size.height : 720,
    },
  });

  map.setZoomAndCenter(target.zoom, target.center, false);
}
```

`packages/renderer/src/features/map/layers/ProvinceLayer.tsx`

```tsx
focusProvinceOnMap(map, {
  provinceId: feature.properties.id,
  geometry: feature.geometry,
  visualCenter: feature.properties.visualCenter ?? feature.properties.center,
  bounds: feature.properties.bounds ?? {
    minLng: feature.properties.center[0] - 1,
    maxLng: feature.properties.center[0] + 1,
    minLat: feature.properties.center[1] - 1,
    maxLat: feature.properties.center[1] + 1,
  },
});
```

- [ ] **Step 4: Run camera tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceCamera.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/provinceCamera.ts packages/renderer/src/features/map/geoUtils.ts packages/renderer/src/features/map/layers/ProvinceLayer.tsx packages/renderer/test/provinceCamera.test.ts
git commit -m "feat: increase province zoom polish"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 3: Drawer Visibility Guarantee

**Files:**
- Modify: `packages/renderer/src/components/Drawer.tsx`
- Modify: `packages/renderer/src/App.tsx`
- Modify: `packages/renderer/src/features/map/mapStore.ts`

- [ ] **Step 1: Add a failing visibility regression test as a pure state check**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { useMapStore } from "../src/features/map/mapStore.ts";

test("openProvinceExperience sets the drawer open for province entry", () => {
  useMapStore.getState().backToCountry();
  useMapStore.getState().openProvinceExperience({ id: "330000", name: "浙江" });

  const state = useMapStore.getState();
  assert.equal(state.level, "province");
  assert.equal(state.drawerOpen, true);
});
```

- [ ] **Step 2: Run the existing store-related tests or typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS, confirming the issue is runtime/UI visibility rather than store shape.

- [ ] **Step 3: Make drawer width and visibility explicit**

`packages/renderer/src/components/Drawer.tsx`

```tsx
const drawerWidthStyle = { width: `${DRAWER_WIDTH}px`, maxWidth: "100vw" };

<aside
  data-drawer-panel="true"
  className={`
    absolute top-0 right-0 bottom-0 flex flex-col
    border-l border-white/10
    bg-[var(--color-surface)] shadow-2xl backdrop-blur-xl
    transition-transform duration-300 ease-out
    ${visible ? "translate-x-0" : "translate-x-full"}
  `}
  style={drawerWidthStyle}
>
```

`packages/renderer/src/App.tsx`

```tsx
useEffect(() => {
  if (level !== "province" || !drawerOpen) return;

  const frameId = window.requestAnimationFrame(() => {
    const panel = document.querySelector("[data-drawer-panel='true']") as HTMLElement | null;
    if (!panel || panel.getBoundingClientRect().width < 280) {
      console.warn("Drawer panel missing after province entry; forcing open state");
      setDrawerOpen(true);
    }
  });

  return () => window.cancelAnimationFrame(frameId);
}, [drawerOpen, level, setDrawerOpen]);
```

- [ ] **Step 4: Run typecheck and diagnostics**

Run:

```bash
pnpm --filter @travel-map/renderer typecheck
```

Then inspect diagnostics for:

```text
packages/renderer/src/components/Drawer.tsx
packages/renderer/src/App.tsx
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/components/Drawer.tsx packages/renderer/src/App.tsx packages/renderer/src/features/map/mapStore.ts
git commit -m "fix: stabilize province drawer visibility"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 4: Province Overview Data, City List, And Capital Photo Card

**Files:**
- Create: `packages/renderer/src/features/map/provinceDetailData.ts`
- Create: `packages/renderer/src/features/map/provinceCityList.ts`
- Modify: `packages/renderer/src/features/map/layers/CityLayer.tsx`
- Modify: `packages/renderer/src/components/drawer/ProvinceOverview.tsx`
- Create: `packages/renderer/test/provinceDetailData.test.ts`

- [ ] **Step 1: Write failing data tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  getProvinceDetailCard,
  getProvinceCapitalPlaceholder,
} from "../src/features/map/provinceDetailData.ts";

test("getProvinceDetailCard returns Zhejiang capital metadata", () => {
  const detail = getProvinceDetailCard("330000");
  assert.equal(detail.capitalName, "杭州");
  assert.equal(typeof detail.imageSrc, "string");
});

test("getProvinceCapitalPlaceholder falls back for unknown province", () => {
  const fallback = getProvinceCapitalPlaceholder("990000");
  assert.equal(fallback.capitalName, "暂无省会图片");
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceDetailData.test.ts
```

Expected: FAIL because `provinceDetailData.ts` does not exist yet.

- [ ] **Step 3: Add province detail metadata and city list helpers**

`packages/renderer/src/features/map/provinceDetailData.ts`

```ts
export interface ProvinceDetailCard {
  provinceId: string;
  capitalName: string;
  imageSrc: string | null;
  imageAlt: string;
}

const PROVINCE_DETAIL_DATA: Record<string, ProvinceDetailCard> = {
  "330000": {
    provinceId: "330000",
    capitalName: "杭州",
    imageSrc: "/images/capitals/hangzhou.jpg",
    imageAlt: "杭州城市风景",
  },
  "710000": {
    provinceId: "710000",
    capitalName: "台北",
    imageSrc: "/images/capitals/taipei.jpg",
    imageAlt: "台北城市风景",
  },
};

export function getProvinceCapitalPlaceholder(provinceId: string): ProvinceDetailCard {
  return {
    provinceId,
    capitalName: "暂无省会图片",
    imageSrc: null,
    imageAlt: "暂无省会图片",
  };
}

export function getProvinceDetailCard(provinceId: string) {
  return PROVINCE_DETAIL_DATA[provinceId] ?? getProvinceCapitalPlaceholder(provinceId);
}
```

`packages/renderer/src/features/map/provinceCityList.ts`

```ts
import type { GeoFeature } from "./geoTypes.ts";

export function getProvinceCityNames(features: GeoFeature[]) {
  return Array.from(
    new Set(
      features
        .map((feature) => feature.properties.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((left, right) => left.localeCompare(right, "zh-CN"));
}
```

`packages/renderer/src/components/drawer/ProvinceOverview.tsx`

```tsx
import { getProvinceDetailCard } from "../../features/map/provinceDetailData.ts";

interface ProvinceOverviewProps {
  provinceId: string;
  provinceName: string;
  cityNames: string[];
}

export function ProvinceOverview({
  provinceId,
  provinceName,
  cityNames,
}: ProvinceOverviewProps) {
  const detail = getProvinceDetailCard(provinceId);

  return (
    <section className="flex h-full flex-col gap-4 p-5">
      <div className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Province</div>
        <div className="mt-3 text-2xl font-semibold text-white">{provinceName}</div>
        <div className="mt-3 text-sm leading-6 text-neutral-300">
          当前处于省级视图。单击地图中的城市边界或城市标签，右侧会切换到该城市的详细信息与旅行内容。
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Cities</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {cityNames.length > 0 ? (
            cityNames.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-200"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-sm text-neutral-400">当前暂无城市列表数据</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/20">
        {detail.imageSrc ? (
          <img
            src={detail.imageSrc}
            alt={detail.imageAlt}
            className="h-44 w-full object-cover"
          />
        ) : (
          <div className="flex h-44 items-center justify-center bg-white/5 text-sm text-neutral-400">
            暂无省会图片
          </div>
        )}
        <div className="p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Capital</div>
          <div className="mt-2 text-lg font-semibold text-white">{detail.capitalName}</div>
        </div>
      </div>
    </section>
  );
}
```

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
export interface ProvinceCityLoadResult {
  features: GeoFeature[];
  source: "remote" | "local" | "empty";
}

async function loadProvinceCities(provinceId: string): Promise<ProvinceCityLoadResult> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const response = await fetch(buildProvinceBoundaryUrl(provinceAdcode));
    if (response.ok) {
      const raw = (await response.json()) as { features?: RawMasterFeature[] };
      const features = (raw.features ?? [])
        .map(toGeoFeature)
        .filter((item): item is GeoFeature => item !== null);

      if (hasRealCityBoundaryData(features)) {
        return { features, source: "remote" };
      }
    }
  } catch (error) {
    console.warn("Province city boundary remote load failed:", error);
  }

  const localFeatures = await loadLocalCities(provinceId);
  if (hasRealCityBoundaryData(localFeatures)) {
    return { features: localFeatures, source: "local" };
  }

  return { features: [], source: "empty" };
}
```

- [ ] **Step 4: Wire province overview props through the drawer**

`packages/renderer/src/components/Drawer.tsx`

```tsx
import { getProvinceCityNames } from "../features/map/provinceCityList.ts";

const provinceCityFeatures = useMapStore((s) => s.provinceCityFeatures);
const provinceCityNames = getProvinceCityNames(provinceCityFeatures);

{isProvinceOverview && provinceName && provinceId && (
  <ProvinceOverview
    provinceId={provinceId}
    provinceName={provinceName}
    cityNames={provinceCityNames}
  />
)}
```

`packages/renderer/src/features/map/mapStore.ts`

```ts
provinceCityFeatures: GeoFeature[];
setProvinceCityFeatures: (features: GeoFeature[]) => void;

provinceCityFeatures: [],

setProvinceCityFeatures: (features) => set({ provinceCityFeatures: features }),

openProvinceExperience: ({ id, name }) =>
  set({
    level: "province",
    provinceId: id,
    provinceName: name,
    cityId: null,
    cityName: null,
    drawerOpen: true,
    provinceCityFeatures: [],
    selectedPoiId: null,
    selectedTripId: null,
    addingPoi: false,
    poiDraft: null,
  }),
```

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
const setProvinceCityFeatures = useMapStore((s) => s.setProvinceCityFeatures);

loadProvinceCities(provinceId).then((result) => {
  if (cancelled) return;

  setProvinceCityFeatures(result.features);

  if (!hasRealCityBoundaryData(result.features)) {
    onBoundaryWarning?.("当前省份暂无城市边界数据，仍可查看省级信息。");
    polygonsRef.current = [];
    labelsRef.current = [];
    outlinesRef.current = [];
    return;
  }

  const features = result.features;
  onBoundaryWarning?.(null);
  // continue render
});
```

- [ ] **Step 5: Run tests, typecheck, commit, and push**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceDetailData.test.ts test/provinceBoundaryUrl.test.ts test/provinceCamera.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

Then:

```bash
git add packages/renderer/src/features/map/provinceDetailData.ts packages/renderer/src/features/map/provinceCityList.ts packages/renderer/src/features/map/layers/CityLayer.tsx packages/renderer/src/components/Drawer.tsx packages/renderer/src/components/drawer/ProvinceOverview.tsx packages/renderer/src/features/map/mapStore.ts packages/renderer/test/provinceDetailData.test.ts
git commit -m "feat: add province overview card content"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.
