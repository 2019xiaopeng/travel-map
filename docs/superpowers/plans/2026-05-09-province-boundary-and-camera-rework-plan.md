# Province Boundary And Camera Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the national province boundary source with a preprocessed `geojson.cn` dataset, stabilize province labels, move province entry camera behavior to a centered bounds-driven flow, and make province entry always open the right drawer state.

**Architecture:** Add a small build-time data pipeline that converts `china.topo.json` into a renderer-ready province boundary artifact with `bounds`, `visualCenter`, and `labelAnchor`. At runtime, the map reads only that artifact for the country layer, uses a unified province entry action for camera + drawer state, and loads province city boundaries by replacing `china` in the `geojson.cn` URL with the 6-digit province adcode.

**Tech Stack:** React 19, TypeScript, Zustand, AMap JS API 2.0, Vite, Node 22 scripts, `node:test`

---

## File Structure

**Create**
- `scripts/generate-province-boundaries.mjs`
- `packages/renderer/src/features/map/provinceBoundaryDataset.ts`
- `packages/renderer/src/features/map/provinceBoundaryUrl.ts`
- `packages/renderer/src/features/map/provinceCamera.ts`
- `packages/renderer/test/provinceBoundaryDataset.test.ts`
- `packages/renderer/test/provinceBoundaryUrl.test.ts`
- `packages/renderer/test/provinceCamera.test.ts`

**Modify**
- `package.json`
- `packages/renderer/src/features/map/provinceBoundarySource.ts`
- `packages/renderer/src/features/map/geoTypes.ts`
- `packages/renderer/src/features/map/geoUtils.ts`
- `packages/renderer/src/features/map/mapStore.ts`
- `packages/renderer/src/features/map/MapView.tsx`
- `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- `packages/renderer/src/features/map/layers/CityLayer.tsx`
- `packages/renderer/test/provinceBoundarySource.test.ts`

**Generated / Updated Runtime Data**
- `packages/renderer/public/geo/province-boundaries.generated.json`

---

### Task 1: Build The Province Boundary Dataset Pipeline

**Files:**
- Create: `scripts/generate-province-boundaries.mjs`
- Create: `packages/renderer/src/features/map/provinceBoundaryDataset.ts`
- Create: `packages/renderer/test/provinceBoundaryDataset.test.ts`
- Modify: `package.json`
- Generate: `packages/renderer/public/geo/province-boundaries.generated.json`

- [ ] **Step 1: Write the failing dataset tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProvinceBoundaryRecord,
  shouldAlwaysShowProvinceLabel,
} from "../src/features/map/provinceBoundaryDataset.ts";

test("normalizeProvinceBoundaryRecord preserves 6-digit id and label anchor", () => {
  const record = normalizeProvinceBoundaryRecord({
    id: "230000",
    name: "黑龙江",
    fullname: "黑龙江省",
    center: [126.661998, 45.742253],
    geometry: {
      type: "Polygon",
      coordinates: [[[126, 45], [127, 45], [127, 46], [126, 46], [126, 45]]],
    },
  });

  assert.equal(record.id, "230000");
  assert.deepEqual(record.labelAnchor, [126.661998, 45.742253]);
  assert.ok(record.bounds.maxLng > record.bounds.minLng);
});

test("shouldAlwaysShowProvinceLabel keeps special provinces visible", () => {
  assert.equal(shouldAlwaysShowProvinceLabel("230000"), true);
  assert.equal(shouldAlwaysShowProvinceLabel("150000"), true);
  assert.equal(shouldAlwaysShowProvinceLabel("330000"), false);
});
```

- [ ] **Step 2: Run the dataset tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryDataset.test.ts
```

Expected: FAIL with module not found for `provinceBoundaryDataset.ts`

- [ ] **Step 3: Add the dataset helpers and generator script**

`packages/renderer/src/features/map/provinceBoundaryDataset.ts`

```ts
import { geometryBounds } from "./geoUtils.ts";

const ALWAYS_VISIBLE_LABEL_IDS = new Set([
  "230000",
  "150000",
  "650000",
  "540000",
  "460000",
  "710000",
]);

export interface ProvinceBoundaryRecordInput {
  id: string;
  name: string;
  fullname: string;
  center: [number, number];
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface ProvinceBoundaryRecord extends ProvinceBoundaryRecordInput {
  bounds: ReturnType<typeof geometryBounds>;
  visualCenter: [number, number];
  labelAnchor: [number, number];
}

export function shouldAlwaysShowProvinceLabel(id: string) {
  return ALWAYS_VISIBLE_LABEL_IDS.has(id);
}

export function normalizeProvinceBoundaryRecord(
  input: ProvinceBoundaryRecordInput,
): ProvinceBoundaryRecord {
  const bounds = geometryBounds(input.geometry);

  return {
    ...input,
    bounds,
    visualCenter: input.center,
    labelAnchor: input.center,
  };
}
```

`scripts/generate-province-boundaries.mjs`

```js
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://geojson.cn/api/china/1.6.3/china.topo.json";
const OUTPUT_PATH = path.resolve(
  "packages/renderer/public/geo/province-boundaries.generated.json",
);

function decodeArc(topology, arc) {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    const [sx, sy] = topology.transform.scale;
    const [tx, ty] = topology.transform.translate;
    return [x * sx + tx, y * sy + ty];
  });
}

function arcByIndex(topology, index) {
  const arc = topology.arcs[index >= 0 ? index : ~index];
  const decoded = decodeArc(topology, arc);
  return index >= 0 ? decoded : decoded.slice().reverse();
}

function ringFromArcRefs(topology, refs) {
  const joined = refs.flatMap((ref, idx) => {
    const points = arcByIndex(topology, ref);
    return idx === 0 ? points : points.slice(1);
  });
  return joined;
}

function geometryToCoordinates(topology, geometry) {
  if (geometry.type === "Polygon") {
    return geometry.arcs.map((ring) => ringFromArcRefs(topology, ring));
  }
  return geometry.arcs.map((polygon) =>
    polygon.map((ring) => ringFromArcRefs(topology, ring)),
  );
}

function boundsFromGeometry(geometry) {
  const polygons =
    geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  const points = polygons.flat();
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

const response = await fetch(SOURCE_URL);
const topology = await response.json();
const geometries = topology.objects.default.geometries.filter(
  (item) => item.properties?.level === 1,
);

const records = geometries.map((item) => {
  const geometry = {
    type: item.type,
    coordinates: geometryToCoordinates(topology, item),
  };
  return {
    id: item.properties.code,
    name: item.properties.name,
    fullname: item.properties.fullname,
    center: item.properties.center,
    geometry,
    bounds: boundsFromGeometry(geometry),
    visualCenter: item.properties.center,
    labelAnchor: item.properties.center,
  };
});

await fs.writeFile(OUTPUT_PATH, JSON.stringify(records, null, 2), "utf8");
console.log(`generated ${records.length} provinces`);
```

`package.json`

```json
{
  "scripts": {
    "generate:province-boundaries": "node scripts/generate-province-boundaries.mjs"
  }
}
```

- [ ] **Step 4: Run generation and tests**

Run:

```bash
pnpm generate:province-boundaries
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryDataset.test.ts
```

Expected:

```text
generated 34 provinces
# pass 2
```

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/generate-province-boundaries.mjs packages/renderer/src/features/map/provinceBoundaryDataset.ts packages/renderer/test/provinceBoundaryDataset.test.ts packages/renderer/public/geo/province-boundaries.generated.json
git commit -m "feat: add generated province boundary dataset"
```

---

### Task 2: Replace The Country Boundary Source And Province URL Builder

**Files:**
- Create: `packages/renderer/src/features/map/provinceBoundaryUrl.ts`
- Modify: `packages/renderer/src/features/map/provinceBoundarySource.ts`
- Modify: `packages/renderer/src/features/map/geoTypes.ts`
- Create: `packages/renderer/test/provinceBoundaryUrl.test.ts`
- Modify: `packages/renderer/test/provinceBoundarySource.test.ts`

- [ ] **Step 1: Write the failing source and URL tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProvinceBoundaryUrl,
  buildCountryBoundaryUrl,
} from "../src/features/map/provinceBoundaryUrl.ts";
import {
  normalizeProvinceBoundaryEnvelope,
} from "../src/features/map/provinceBoundarySource.ts";

test("buildCountryBoundaryUrl uses geojson.cn china topo endpoint", () => {
  assert.equal(
    buildCountryBoundaryUrl(),
    "https://geojson.cn/api/china/1.6.3/china.topo.json",
  );
});

test("buildProvinceBoundaryUrl swaps china with a 6-digit adcode", () => {
  assert.equal(
    buildProvinceBoundaryUrl("330000"),
    "https://geojson.cn/api/330000/1.6.3/330000.json",
  );
});

test("normalizeProvinceBoundaryEnvelope keeps generated label anchor metadata", () => {
  const [feature] = normalizeProvinceBoundaryEnvelope([
    {
      type: "Feature",
      properties: {
        id: "230000",
        name: "黑龙江",
        center: [126.6, 45.7],
        labelAnchor: [126.6, 45.7],
        visualCenter: [126.6, 45.7],
        bounds: { minLng: 121, maxLng: 135, minLat: 43, maxLat: 53 },
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[126, 45], [127, 45], [127, 46], [126, 46], [126, 45]]],
      },
    } as any,
  ]);

  assert.deepEqual(feature.properties.labelAnchor, [126.6, 45.7]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundarySource.test.ts test/provinceBoundaryUrl.test.ts
```

Expected: FAIL with module not found for `provinceBoundaryUrl.ts` and missing metadata support

- [ ] **Step 3: Implement the URL builder and generated-source loader**

`packages/renderer/src/features/map/provinceBoundaryUrl.ts`

```ts
const GEOJSON_CN_VERSION = "1.6.3";

export function buildCountryBoundaryUrl() {
  return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/china.topo.json`;
}

export function buildProvinceBoundaryUrl(provinceAdcode: string) {
  return `https://geojson.cn/api/${provinceAdcode}/${GEOJSON_CN_VERSION}/${provinceAdcode}.json`;
}
```

`packages/renderer/src/features/map/provinceBoundarySource.ts`

```ts
import generatedProvinceBoundaries from "../../../public/geo/province-boundaries.generated.json";

export function normalizeProvinceBoundaryEnvelope(features: GeoFeature[]) {
  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      id: normalizeProvinceAdcode(feature.properties.id),
      center: feature.properties.center ?? featureCenter(feature.geometry),
      labelAnchor: feature.properties.labelAnchor ?? feature.properties.center,
      visualCenter: feature.properties.visualCenter ?? feature.properties.center,
      bounds: feature.properties.bounds ?? geometryBounds(feature.geometry),
    },
  }));
}

export async function loadCountryProvinceBoundaries() {
  return {
    status: "ready" as const,
    source: "generated" as const,
    features: normalizeProvinceBoundaryEnvelope(generatedProvinceBoundaries as GeoFeature[]),
  };
}
```

`packages/renderer/src/features/map/geoTypes.ts`

```ts
export interface GeoFeatureProperties {
  id: string;
  name: string;
  center: [number, number];
  fullname?: string;
  labelAnchor?: [number, number];
  visualCenter?: [number, number];
  bounds?: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundarySource.test.ts test/provinceBoundaryUrl.test.ts
```

Expected:

```text
# pass
```

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/provinceBoundaryUrl.ts packages/renderer/src/features/map/provinceBoundarySource.ts packages/renderer/src/features/map/geoTypes.ts packages/renderer/test/provinceBoundarySource.test.ts packages/renderer/test/provinceBoundaryUrl.test.ts
git commit -m "feat: load country boundaries from generated dataset"
```

---

### Task 3: Add Province Camera Math And Unified Province Entry Action

**Files:**
- Create: `packages/renderer/src/features/map/provinceCamera.ts`
- Modify: `packages/renderer/src/features/map/geoUtils.ts`
- Modify: `packages/renderer/src/features/map/mapStore.ts`
- Create: `packages/renderer/test/provinceCamera.test.ts`

- [ ] **Step 1: Write the failing camera and store tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceCameraTarget } from "../src/features/map/provinceCamera.ts";

test("getProvinceCameraTarget centers a province using window bounds", () => {
  const target = getProvinceCameraTarget({
    bounds: { minLng: 120, maxLng: 130, minLat: 30, maxLat: 40 },
    visualCenter: [125, 35],
    viewport: { width: 1000, height: 800 },
  });

  assert.deepEqual(target.center, [125, 35]);
  assert.ok(target.zoom > 4);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceCamera.test.ts
```

Expected: FAIL with module not found for `provinceCamera.ts`

- [ ] **Step 3: Add camera math and province entry state**

`packages/renderer/src/features/map/provinceCamera.ts`

```ts
export interface ProvinceCameraInput {
  bounds: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
  visualCenter: [number, number];
  viewport: {
    width: number;
    height: number;
  };
}

export function getProvinceCameraTarget(input: ProvinceCameraInput) {
  const lngSpan = Math.max(input.bounds.maxLng - input.bounds.minLng, 0.01);
  const latSpan = Math.max(input.bounds.maxLat - input.bounds.minLat, 0.01);
  const horizontalZoom = Math.log2((360 * input.viewport.width) / (lngSpan * 256));
  const verticalZoom = Math.log2((180 * input.viewport.height) / (latSpan * 256));
  const zoom = Math.max(4.5, Math.min(horizontalZoom, verticalZoom));

  return {
    center: input.visualCenter,
    zoom,
  };
}
```

`packages/renderer/src/features/map/mapStore.ts`

```ts
interface ProvinceEntryPayload {
  id: string;
  name: string;
}

openProvinceExperience: (payload: ProvinceEntryPayload) => void;

openProvinceExperience: ({ id, name }) =>
  set({
    level: "province",
    provinceId: id,
    provinceName: name,
    cityId: null,
    cityName: null,
    drawerOpen: true,
    selectedPoiId: null,
    selectedTripId: null,
    addingPoi: false,
    poiDraft: null,
  }),
```

`packages/renderer/src/features/map/geoUtils.ts`

```ts
export interface FocusProvinceInput {
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  visualCenter: [number, number];
  bounds: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceCamera.test.ts
```

Expected:

```text
# pass 1
```

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/provinceCamera.ts packages/renderer/src/features/map/geoUtils.ts packages/renderer/src/features/map/mapStore.ts packages/renderer/test/provinceCamera.test.ts
git commit -m "feat: add province camera model and entry action"
```

---

### Task 4: Rewire Country Layer Click, Labels, Camera, And Drawer Open

**Files:**
- Modify: `packages/renderer/src/features/map/MapView.tsx`
- Modify: `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`
- Modify: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Modify: `packages/renderer/src/App.tsx`

- [ ] **Step 1: Write the failing interaction test as pure helper coverage**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { shouldAlwaysShowProvinceLabel } from "../src/features/map/provinceBoundaryDataset.ts";

test("black龙江 stays in the always-visible label set", () => {
  assert.equal(shouldAlwaysShowProvinceLabel("230000"), true);
});
```

- [ ] **Step 2: Run the focused tests to verify current gaps**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryDataset.test.ts test/provinceCamera.test.ts
```

Expected: PASS on helpers, while UI still has not been rewired yet

- [ ] **Step 3: Rewire runtime usage to the new dataset metadata**

`packages/renderer/src/features/map/ProvinceTagOverlay.tsx`

```tsx
const tags = useMemo(() => {
  const zoom = map?.getZoom?.() ?? 4.5;
  const visibleFeatures = features.filter((feature) => {
    if (shouldAlwaysShowProvinceLabel(feature.properties.id)) return true;
    return zoom >= 4.8 || feature.properties.name.length <= 2;
  });
  return projectProvinceTags(map, visibleFeatures, "labelAnchor");
}, [map, features, version]);
```

`packages/renderer/src/features/map/layers/ProvinceLayer.tsx`

```tsx
const openProvinceExperience = useMapStore((s) => s.openProvinceExperience);

const handleClick = useCallback((feature: GeoFeature) => {
  onProvinceHoverChange(null);
  openProvinceExperience({
    id: feature.properties.id,
    name: feature.properties.name,
  });
  focusProvinceOnMap(map, {
    geometry: feature.geometry,
    visualCenter: feature.properties.visualCenter!,
    bounds: feature.properties.bounds!,
  });
}, [map, openProvinceExperience, onProvinceHoverChange]);
```

`packages/renderer/src/features/map/MapView.tsx`

```tsx
{level === "country" && map && provinceBoundaryStatus === "ready" && (
  <ProvinceTagOverlay
    map={map}
    features={provinceFeatures}
    hoveredProvinceId={provinceHover?.provinceId ?? null}
  />
)}
```

`packages/renderer/src/App.tsx`

```tsx
useEffect(() => {
  if (!drawerOpen) return;
  requestAnimationFrame(() => {
    const shell = document.querySelector("[data-drawer-shell='true']");
    if (!shell) {
      console.warn("Drawer shell missing after province entry; forcing open state");
      setDrawerOpen(true);
    }
  });
}, [drawerOpen, setDrawerOpen]);
```

- [ ] **Step 4: Run typecheck and renderer tests**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryDataset.test.ts test/provinceCamera.test.ts test/provinceBoundarySource.test.ts test/provinceBoundaryUrl.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# all tests pass
tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/App.tsx packages/renderer/src/features/map/MapView.tsx packages/renderer/src/features/map/ProvinceTagOverlay.tsx packages/renderer/src/features/map/layers/ProvinceLayer.tsx
git commit -m "feat: rewire province entry camera and labels"
```

---

### Task 5: Switch Province City Boundaries To The Confirmed URL Rule

**Files:**
- Modify: `packages/renderer/src/features/map/layers/CityLayer.tsx`
- Modify: `packages/renderer/src/features/map/provinceBoundaryUrl.ts`
- Modify: `packages/renderer/test/provinceBoundaryUrl.test.ts`

- [ ] **Step 1: Add the failing province-city URL test**

```ts
test("buildProvinceBoundaryUrl returns the province city boundary endpoint", () => {
  assert.equal(
    buildProvinceBoundaryUrl("110000"),
    "https://geojson.cn/api/110000/1.6.3/110000.json",
  );
});
```

- [ ] **Step 2: Run the URL test to verify it fails if not yet wired in CityLayer**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryUrl.test.ts
```

Expected: PASS on helper once implemented, while `CityLayer` still uses old local fallback code

- [ ] **Step 3: Replace the province city fetcher in `CityLayer.tsx`**

```ts
async function loadProvinceCities(provinceId: string): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);
  const response = await fetch(buildProvinceBoundaryUrl(provinceAdcode));
  if (!response.ok) {
    throw new Error(`Failed to load province boundary ${provinceAdcode}: ${response.status}`);
  }

  const raw = await response.json();
  return normalizeProvinceCityFeatures(raw.features ?? []);
}
```

```ts
loadProvinceCities(provinceId)
  .then((features) => {
    if (!hasRealCityBoundaryData(features)) {
      onBoundaryWarning?.("当前省份暂无城市边界数据，仍可查看省级信息。");
      return;
    }
    onBoundaryWarning?.(null);
    // render polygons, outlines, labels
  })
  .catch((error) => {
    console.warn("Province city boundary load failed:", error);
    onBoundaryWarning?.("当前省份边界加载失败，仍可查看省级信息。");
  });
```

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryDataset.test.ts test/provinceBoundaryUrl.test.ts test/provinceBoundarySource.test.ts test/provinceCamera.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# tests 8
# pass 8
tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/layers/CityLayer.tsx packages/renderer/src/features/map/provinceBoundaryUrl.ts packages/renderer/test/provinceBoundaryUrl.test.ts
git commit -m "feat: load province city boundaries from geojson cn"
```

---

### Task 6: Final Manual Verification And Push Prep

**Files:**
- Modify if needed after verification: `packages/renderer/src/features/map/MapView.tsx`
- Modify if needed after verification: `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`
- Modify if needed after verification: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`

- [ ] **Step 1: Start the renderer and verify the country layer**

Run:

```bash
pnpm --filter @travel-map/renderer dev -- --host 127.0.0.1 --port 4173
```

Expected:

```text
Local: http://127.0.0.1:4173/
```

- [ ] **Step 2: Manually verify the country layer**

Checklist:

```text
1. 全国层省界与真实轮廓基本贴合
2. 黑龙江标签默认可见
3. hover 提示出现和消失稳定
4. 点击省份后镜头先聚焦到窗口中心再放大
5. 进入省份后右侧栏稳定显示
```

- [ ] **Step 3: Re-run diagnostics on edited files**

Run:

```bash
pnpm --filter @travel-map/renderer typecheck
```

Then inspect diagnostics for:

```text
packages/renderer/src/features/map/MapView.tsx
packages/renderer/src/features/map/ProvinceTagOverlay.tsx
packages/renderer/src/features/map/layers/ProvinceLayer.tsx
packages/renderer/src/features/map/layers/CityLayer.tsx
packages/renderer/src/features/map/provinceBoundarySource.ts
```

- [ ] **Step 4: Create the final integration commit**

```bash
git add .
git commit -m "feat: rework province boundaries camera and province entry"
```

- [ ] **Step 5: Push only after review**

```bash
git push origin HEAD:main
```

Expected:

```text
To <remote>
   <old>..<new>  HEAD -> main
```
