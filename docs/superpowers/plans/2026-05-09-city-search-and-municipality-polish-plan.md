# City Search And Municipality Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix municipality subdivision rendering, move city labels onto stable in-region anchors, deepen province and city highlight colors, and add a top search affordance that opens a horizontal nationwide city search and jumps directly into city detail.

**Architecture:** Keep the existing national province boundary pipeline and province drilldown flow intact, but pull the new behavior into small focused modules. Municipality fallback becomes a pure subdivision-selection rule used by `CityLayer`, label anchors move into a normalization utility consumed by render code, and nationwide search gets its own lazy local index plus a single `openCityExperience(...)` entry so search and future jump actions share one state-and-camera path.

**Tech Stack:** React 19, TypeScript, Zustand, AMap JS API 2.0, Vite, Node `node:test`

---

## File Structure

**Create**
- `packages/renderer/src/features/map/cityBoundaryScope.ts`
- `packages/renderer/src/features/map/cityLabelAnchor.ts`
- `packages/renderer/src/features/map/citySearchIndex.ts`
- `packages/renderer/src/features/map/cityExperience.ts`
- `packages/renderer/src/features/map/CitySearchBox.tsx`
- `packages/renderer/test/cityBoundaryScope.test.ts`
- `packages/renderer/test/cityLabelAnchor.test.ts`
- `packages/renderer/test/citySearchIndex.test.ts`
- `packages/renderer/test/cityExperience.test.ts`

**Modify**
- `packages/renderer/src/features/map/geoTypes.ts`
- `packages/renderer/src/features/map/geoUtils.ts`
- `packages/renderer/src/features/map/mapLayout.js`
- `packages/renderer/src/features/map/mapStore.ts`
- `packages/renderer/src/features/map/layers/CityLayer.tsx`
- `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- `packages/renderer/src/features/map/MapView.tsx`

---

### Task 1: Municipality Boundary Scope And Highlight Tokens

**Files:**
- Create: `packages/renderer/src/features/map/cityBoundaryScope.ts`
- Modify: `packages/renderer/src/features/map/geoTypes.ts`
- Modify: `packages/renderer/src/features/map/layers/CityLayer.tsx`
- Modify: `packages/renderer/src/features/map/mapLayout.js`
- Test: `packages/renderer/test/cityBoundaryScope.test.ts`

- [ ] **Step 1: Write the failing subdivision-scope tests**

`packages/renderer/test/cityBoundaryScope.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  isMunicipalityProvince,
  pickProvinceSubdivisionFeatures,
} from "../src/features/map/cityBoundaryScope.ts";
import type { GeoFeature } from "../src/features/map/geoTypes.ts";

function makeFeature(
  id: string,
  name: string,
  level: string,
  parentAdcode: string,
): GeoFeature {
  return {
    type: "Feature",
    properties: {
      id,
      name,
      center: [120, 30],
      level,
      parentAdcode,
    },
    geometry: {
      type: "Polygon",
      coordinates: [],
    },
  };
}

test("isMunicipalityProvince recognizes the four municipalities", () => {
  assert.equal(isMunicipalityProvince("110000"), true);
  assert.equal(isMunicipalityProvince("120000"), true);
  assert.equal(isMunicipalityProvince("310000"), true);
  assert.equal(isMunicipalityProvince("500000"), true);
  assert.equal(isMunicipalityProvince("330000"), false);
});

test("pickProvinceSubdivisionFeatures keeps city level for normal provinces", () => {
  const result = pickProvinceSubdivisionFeatures({
    provinceAdcode: "330000",
    features: [
      makeFeature("330100", "杭州", "city", "330000"),
      makeFeature("330106", "西湖区", "district", "330000"),
    ],
  });

  assert.deepEqual(result.map((item) => item.properties.id), ["330100"]);
});

test("pickProvinceSubdivisionFeatures falls back to district for municipalities", () => {
  const result = pickProvinceSubdivisionFeatures({
    provinceAdcode: "110000",
    features: [
      makeFeature("110101", "东城区", "district", "110000"),
      makeFeature("110102", "西城区", "district", "110000"),
    ],
  });

  assert.deepEqual(result.map((item) => item.properties.id), ["110101", "110102"]);
});
```

- [ ] **Step 2: Run the focused scope test to confirm it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityBoundaryScope.test.ts
```

Expected: FAIL because `cityBoundaryScope.ts` does not exist and `GeoFeatureProperties` does not yet carry `level` / `parentAdcode`.

- [ ] **Step 3: Add the pure subdivision selector and preserve source levels**

`packages/renderer/src/features/map/cityBoundaryScope.ts`

```ts
import type { GeoFeature } from "./geoTypes.ts";

const MUNICIPALITY_ADCODES = new Set(["110000", "120000", "310000", "500000"]);

export function isMunicipalityProvince(provinceAdcode: string) {
  return MUNICIPALITY_ADCODES.has(provinceAdcode);
}

export function pickProvinceSubdivisionFeatures(input: {
  provinceAdcode: string;
  features: GeoFeature[];
}) {
  const scoped = input.features.filter(
    (item) => item.properties.parentAdcode === input.provinceAdcode,
  );

  const cityMatches = scoped.filter((item) => item.properties.level === "city");
  if (cityMatches.length > 0) return cityMatches;

  if (isMunicipalityProvince(input.provinceAdcode)) {
    return scoped.filter((item) => item.properties.level === "district");
  }

  return [];
}
```

`packages/renderer/src/features/map/geoTypes.ts`

```ts
export interface GeoFeatureProperties {
  id: string;
  name: string;
  center: [number, number];
  fullname?: string;
  level?: string;
  parentAdcode?: string;
  labelAnchor?: [number, number];
  visualCenter?: [number, number];
  bounds?: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
  sourceVersion?: string;
}
```

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
import { pickProvinceSubdivisionFeatures } from "../cityBoundaryScope.ts";

function toGeoFeature(feature: RawMasterFeature): GeoFeature | null {
  const geometry = feature.geometry;
  if (!geometry) return null;

  const id = toAdcode(feature.properties?.id ?? feature.properties?.adcode);
  if (!id) return null;

  const name = (feature.properties?.name ?? id).toString();
  const center = toCenter(feature.properties?.center);
  const parentAdcode = toAdcode(feature.properties?.parent?.adcode);

  return {
    type: "Feature",
    properties: {
      id,
      name,
      center: center ?? featureCenter(geometry),
      level: feature.properties?.level,
      parentAdcode: parentAdcode ?? undefined,
    },
    geometry,
  };
}

async function loadLocalCities(provinceId: string): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const response = await fetch("/geo/china-provinces-cities.geojson");
    if (response.ok) {
      const raw = (await response.json()) as { features?: RawMasterFeature[] };
      const allFeatures = (raw.features ?? [])
        .map(toGeoFeature)
        .filter((item): item is GeoFeature => item !== null);

      const picked = pickProvinceSubdivisionFeatures({
        provinceAdcode,
        features: allFeatures,
      });

      if (hasRealCityBoundaryData(picked)) return picked;
    }
  } catch {
    // Fall through to no-boundary mode.
  }

  return [];
}
```

`packages/renderer/src/features/map/mapLayout.js`

```js
export const CITY_LAYER_TOKENS = {
  stroke: "#4f7ca6",
  hoverStroke: "#8ec0f0",
  selectedStroke: "#d6ebff",
  fill: "#173047",
  hoverFill: "#27557d",
  selectedFill: "#326b99",
  labelBorder: "rgba(142, 192, 240, 0.26)",
  labelBg: "rgba(9, 18, 28, 0.8)",
  labelText: "#d8ebfb",
};
```

- [ ] **Step 4: Apply the same municipality selector to remote drilldown and run validation**

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
async function loadProvinceCities(provinceId: string): Promise<GeoFeature[]> {
  const provinceAdcode = normalizeProvinceAdcode(provinceId);

  try {
    const response = await fetch(buildProvinceBoundaryUrl(provinceAdcode));
    if (response.ok) {
      const raw = (await response.json()) as
        | { features?: RawMasterFeature[] }
        | RawTopology;
      const allFeatures =
        raw && (raw as RawTopology).type === "Topology"
          ? topologyToGeoFeatures(raw as RawTopology)
          : (((raw as { features?: RawMasterFeature[] }).features ?? [])
              .map(toGeoFeature)
              .filter((item): item is GeoFeature => item !== null));

      const picked = pickProvinceSubdivisionFeatures({
        provinceAdcode,
        features: allFeatures,
      });

      if (hasRealCityBoundaryData(picked)) {
        return picked;
      }
    }
  } catch (error) {
    console.warn("Province city boundary remote load failed:", error);
  }

  return loadLocalCities(provinceId);
}
```

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityBoundaryScope.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/cityBoundaryScope.ts packages/renderer/src/features/map/geoTypes.ts packages/renderer/src/features/map/layers/CityLayer.tsx packages/renderer/src/features/map/mapLayout.js packages/renderer/test/cityBoundaryScope.test.ts
git commit -m "fix: support municipality subdivision boundaries"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 2: Normalize Stable City Label Anchors

**Files:**
- Create: `packages/renderer/src/features/map/cityLabelAnchor.ts`
- Modify: `packages/renderer/src/features/map/layers/CityLayer.tsx`
- Test: `packages/renderer/test/cityLabelAnchor.test.ts`

- [ ] **Step 1: Write the failing label-anchor tests**

`packages/renderer/test/cityLabelAnchor.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  pickLabelAnchor,
  normalizeFeatureLabelProps,
} from "../src/features/map/cityLabelAnchor.ts";
import type { GeoFeature } from "../src/features/map/geoTypes.ts";

const polygonFeature: GeoFeature = {
  type: "Feature",
  properties: {
    id: "330100",
    name: "杭州",
    center: [120.15, 30.28],
  },
  geometry: {
    type: "Polygon",
    coordinates: [[[120, 30], [121, 30], [121, 31], [120, 31], [120, 30]]],
  },
};

test("pickLabelAnchor respects labelAnchor over other candidates", () => {
  const anchor = pickLabelAnchor({
    labelAnchor: [120.3, 30.4],
    visualCenter: [120.2, 30.3],
    centroid: [120.1, 30.2],
    center: [120.0, 30.1],
    geometry: polygonFeature.geometry,
  });

  assert.deepEqual(anchor, [120.3, 30.4]);
});

test("normalizeFeatureLabelProps fills visualCenter and labelAnchor", () => {
  const normalized = normalizeFeatureLabelProps(polygonFeature, {
    centroid: [120.4, 30.5],
  });

  assert.deepEqual(normalized.properties.visualCenter, [120.4, 30.5]);
  assert.deepEqual(normalized.properties.labelAnchor, [120.4, 30.5]);
});
```

- [ ] **Step 2: Run the focused anchor test to confirm it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityLabelAnchor.test.ts
```

Expected: FAIL because `cityLabelAnchor.ts` does not exist and `CityLayer` still renders labels from `center`.

- [ ] **Step 3: Add the anchor-normalization utility**

`packages/renderer/src/features/map/cityLabelAnchor.ts`

```ts
import type { GeoFeature } from "./geoTypes.ts";
import { featureCenter } from "./geoUtils.ts";

type Point = [number, number];

function isPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

export function pickLabelAnchor(input: {
  labelAnchor?: Point;
  visualCenter?: Point;
  centroid?: Point;
  center?: Point;
  geometry: GeoFeature["geometry"];
}) {
  return (
    input.labelAnchor ??
    input.visualCenter ??
    input.centroid ??
    input.center ??
    featureCenter(input.geometry)
  );
}

export function normalizeFeatureLabelProps(
  feature: GeoFeature,
  extra?: {
    centroid?: Point;
    visualCenter?: Point;
    labelAnchor?: Point;
  },
): GeoFeature {
  const visualCenter =
    (isPoint(extra?.visualCenter) ? extra?.visualCenter : undefined) ??
    (isPoint(extra?.centroid) ? extra?.centroid : undefined) ??
    feature.properties.visualCenter ??
    feature.properties.center;

  const labelAnchor = pickLabelAnchor({
    labelAnchor: isPoint(extra?.labelAnchor) ? extra?.labelAnchor : feature.properties.labelAnchor,
    visualCenter,
    center: feature.properties.center,
    geometry: feature.geometry,
  });

  return {
    ...feature,
    properties: {
      ...feature.properties,
      visualCenter,
      labelAnchor,
    },
  };
}
```

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
import { normalizeFeatureLabelProps, pickLabelAnchor } from "../cityLabelAnchor.ts";

function toGeoFeature(feature: RawMasterFeature): GeoFeature | null {
  const geometry = feature.geometry;
  if (!geometry) return null;

  const id = toAdcode(feature.properties?.id ?? feature.properties?.adcode);
  if (!id) return null;

  const name = (feature.properties?.name ?? id).toString();
  const center = toCenter(feature.properties?.center);
  const centroid = toCenter((feature.properties as any)?.centroid);

  return normalizeFeatureLabelProps({
    type: "Feature",
    properties: {
      id,
      name,
      center: center ?? featureCenter(geometry),
      level: feature.properties?.level,
      parentAdcode: toAdcode(feature.properties?.parent?.adcode) ?? undefined,
    },
    geometry,
  }, {
    centroid: centroid ?? undefined,
  });
}
```

- [ ] **Step 4: Switch label rendering to the normalized anchor and run validation**

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
const anchor =
  feature.properties.labelAnchor ??
  feature.properties.visualCenter ??
  pickLabelAnchor({
    center: feature.properties.center,
    geometry: feature.geometry,
  });

const label = new AMap.Text({
  text: feature.properties.name,
  anchor: "center",
  position: anchor,
  offset: new AMap.Pixel(0, 0),
  style: {
    padding: "4px 10px",
    borderRadius: "999px",
    border: `1px solid ${CITY_LAYER_TOKENS.labelBorder}`,
    background: CITY_LAYER_TOKENS.labelBg,
    color: CITY_LAYER_TOKENS.labelText,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
});
```

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityLabelAnchor.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/cityLabelAnchor.ts packages/renderer/src/features/map/layers/CityLayer.tsx packages/renderer/test/cityLabelAnchor.test.ts
git commit -m "fix: stabilize city label anchors"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 3: Build The Nationwide City Search Index And Unified City Experience Entry

**Files:**
- Create: `packages/renderer/src/features/map/citySearchIndex.ts`
- Create: `packages/renderer/src/features/map/cityExperience.ts`
- Modify: `packages/renderer/src/features/map/mapStore.ts`
- Test: `packages/renderer/test/citySearchIndex.test.ts`
- Test: `packages/renderer/test/cityExperience.test.ts`

- [ ] **Step 1: Write the failing search-index and city-experience tests**

`packages/renderer/test/citySearchIndex.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCitySearchIndex,
  searchCityIndex,
} from "../src/features/map/citySearchIndex.ts";

test("searchCityIndex matches city and province names", () => {
  const index = buildCitySearchIndex([
    {
      cityId: "330100",
      cityName: "杭州",
      provinceId: "330000",
      provinceName: "浙江",
      center: [120.15, 30.28],
    },
    {
      cityId: "310100",
      cityName: "上海城区",
      provinceId: "310000",
      provinceName: "上海",
      center: [121.47, 31.23],
    },
  ]);

  assert.deepEqual(searchCityIndex(index, "杭").map((item) => item.cityId), ["330100"]);
  assert.deepEqual(searchCityIndex(index, "上海").map((item) => item.cityId), ["310100"]);
});
```

`packages/renderer/test/cityExperience.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { useMapStore } from "../src/features/map/mapStore.ts";
import { openCityExperience } from "../src/features/map/cityExperience.ts";

function resetStore() {
  useMapStore.setState({
    level: "country",
    provinceId: null,
    provinceName: null,
    cityId: null,
    cityName: null,
    provinceCityFeatures: [],
    drawerOpen: false,
    selectedPoiId: null,
    selectedTripId: null,
    addingPoi: false,
    poiDraft: null,
  });
}

test("openCityExperience opens province and city detail in one flow", () => {
  resetStore();

  const map = {
    setFitViewCalled: false,
    setFitView() {
      this.setFitViewCalled = true;
    },
  } as any;

  openCityExperience(map, {
    provinceId: "330000",
    provinceName: "浙江",
    cityId: "330100",
    cityName: "杭州",
    center: [120.15, 30.28],
  });

  const state = useMapStore.getState();
  assert.equal(state.level, "city");
  assert.equal(state.provinceId, "330000");
  assert.equal(state.cityId, "330100");
  assert.equal(state.drawerOpen, true);
});
```

- [ ] **Step 2: Run the focused tests to confirm they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/citySearchIndex.test.ts test/cityExperience.test.ts
```

Expected: FAIL because the search index and the unified city experience entry do not exist yet.

- [ ] **Step 3: Implement the lazy local search index**

`packages/renderer/src/features/map/citySearchIndex.ts`

```ts
import type { GeoFeature } from "./geoTypes.ts";
import { loadGeoJson } from "./geoUtils.ts";

export interface CitySearchEntry {
  cityId: string;
  cityName: string;
  provinceId: string;
  provinceName: string;
  center: [number, number];
  geometry?: GeoFeature["geometry"];
}

export function buildCitySearchIndex(entries: CitySearchEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    searchableText: `${entry.cityName} ${entry.provinceName}`.toLowerCase(),
  }));
}

export function searchCityIndex(
  index: ReturnType<typeof buildCitySearchIndex>,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return index
    .filter((entry) => entry.searchableText.includes(normalized))
    .slice(0, 8);
}

let cityIndexPromise: Promise<ReturnType<typeof buildCitySearchIndex>> | null = null;

export async function loadCitySearchIndex() {
  if (cityIndexPromise) return cityIndexPromise;

  cityIndexPromise = loadGeoJson("china-provinces-cities.geojson").then((geo) =>
    buildCitySearchIndex(
      geo.features
        .filter((feature) => feature.properties.id.length >= 6)
        .map((feature) => ({
          cityId: feature.properties.id,
          cityName: feature.properties.name,
          provinceId: feature.properties.parentAdcode ?? `${feature.properties.id.slice(0, 2)}0000`,
          provinceName: feature.properties.fullname?.split("/")[0] ?? feature.properties.name,
          center: feature.properties.labelAnchor ?? feature.properties.center,
          geometry: feature.geometry,
        })),
    ),
  );

  return cityIndexPromise;
}
```

- [ ] **Step 4: Implement the unified city-entry action and store hook**

`packages/renderer/src/features/map/mapStore.ts`

```ts
interface MapState {
  // existing fields...
  openCityExperience: (payload: {
    provinceId: string;
    provinceName: string;
    cityId: string;
    cityName: string;
  }) => void;
}

openCityExperience: ({ provinceId, provinceName, cityId, cityName }) =>
  set({
    level: "city",
    provinceId,
    provinceName,
    cityId,
    cityName,
    drawerOpen: true,
    selectedPoiId: null,
    selectedTripId: null,
    addingPoi: false,
    poiDraft: null,
  }),
```

`packages/renderer/src/features/map/cityExperience.ts`

```ts
import { useMapStore } from "./mapStore.ts";
import { focusFeatureOnMap } from "./geoUtils.ts";

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

  if (input.geometry) {
    focusFeatureOnMap(map, input.geometry);
    return;
  }

  map.setZoomAndCenter?.(9.2, input.center, false);
}
```

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/citySearchIndex.test.ts test/cityExperience.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/citySearchIndex.ts packages/renderer/src/features/map/cityExperience.ts packages/renderer/src/features/map/mapStore.ts packages/renderer/test/citySearchIndex.test.ts packages/renderer/test/cityExperience.test.ts
git commit -m "feat: add nationwide city search data flow"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 4: Attach The Search Icon And Horizontal Search Box To The Top Overlay

**Files:**
- Create: `packages/renderer/src/features/map/CitySearchBox.tsx`
- Modify: `packages/renderer/src/features/map/BreadCrumbOverlay.tsx`
- Modify: `packages/renderer/src/features/map/MapView.tsx`
- Modify: `packages/renderer/src/features/map/layers/CityLayer.tsx`

- [ ] **Step 1: Build the focused search box component**

`packages/renderer/src/features/map/CitySearchBox.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";

import {
  loadCitySearchIndex,
  searchCityIndex,
  type CitySearchEntry,
} from "./citySearchIndex.ts";

export function CitySearchBox({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (entry: CitySearchEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Awaited<ReturnType<typeof loadCitySearchIndex>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;

    loadCitySearchIndex()
      .then((value) => {
        setIndex(value);
        setError(null);
      })
      .catch(() => {
        setError("城市索引加载失败");
      });
  }, [open]);

  const results = useMemo(() => searchCityIndex(index, query), [index, query]);

  if (!open) return null;

  return (
    <div className="flex items-center gap-2">
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && results[activeIndex]) {
            onSelect(results[activeIndex]);
          }
        }}
        placeholder="搜索全国城市"
        className="w-64 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white outline-none transition-[width,opacity] duration-200"
      />

      <div className="absolute top-full left-0 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(8,16,24,0.94)] shadow-2xl">
        {error ? (
          <div className="px-4 py-3 text-sm text-amber-200">{error}</div>
        ) : results.length > 0 ? (
          results.map((item, index) => (
            <button
              key={item.cityId}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(item);
              }}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${
                index === activeIndex ? "bg-white/10 text-white" : "text-neutral-200 hover:bg-white/5"
              }`}
            >
              <span>{item.cityName}</span>
              <span className="text-xs text-neutral-400">{item.provinceName}</span>
            </button>
          ))
        ) : (
          <div className="px-4 py-3 text-sm text-neutral-400">未找到匹配城市</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the search affordance inside the breadcrumb overlay**

`packages/renderer/src/features/map/BreadCrumbOverlay.tsx`

```tsx
import { useState } from "react";

import { CitySearchBox } from "./CitySearchBox";
import { openCityExperience } from "./cityExperience.ts";

export function BreadCrumbOverlay({
  map,
}: {
  map: any | null;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/76 px-3 py-2 backdrop-blur-md">
          {/* existing breadcrumb content */}
        </div>

        <div className="relative">
          <button
            onMouseDown={(event) => {
              event.preventDefault();
              setSearchOpen((current) => !current);
            }}
            className="rounded-full border border-white/10 bg-black/45 p-2 text-neutral-200 transition-colors hover:bg-black/60 hover:text-white"
            aria-label="搜索城市"
          >
            搜
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

      <div className="rounded-lg border border-white/8 bg-black/45 px-3 py-2 text-[11px] text-neutral-200 backdrop-blur-md">
        {instruction}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Pass the map instance down and route city clicks through the same entry**

`packages/renderer/src/features/map/MapView.tsx`

```tsx
<BreadCrumbOverlay map={map} />
```

`packages/renderer/src/features/map/layers/CityLayer.tsx`

```ts
import { openCityExperience } from "../cityExperience.ts";

polygon.on("click", () => {
  openCityExperience(map, {
    provinceId,
    provinceName: useMapStore.getState().provinceName ?? provinceId,
    cityId: feature.properties.id,
    cityName: feature.properties.name,
    center: feature.properties.labelAnchor ?? feature.properties.center,
    geometry: feature.geometry,
  });
});

label.on("click", () => {
  openCityExperience(map, {
    provinceId,
    provinceName: useMapStore.getState().provinceName ?? provinceId,
    cityId: feature.properties.id,
    cityName: feature.properties.name,
    center: feature.properties.labelAnchor ?? feature.properties.center,
    geometry: feature.geometry,
  });
});
```

- [ ] **Step 4: Run tests, typecheck, and inspect diagnostics**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityBoundaryScope.test.ts test/cityLabelAnchor.test.ts test/citySearchIndex.test.ts test/cityExperience.test.ts test/mapStore.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

Then inspect IDE diagnostics for:

```text
packages/renderer/src/features/map/CitySearchBox.tsx
packages/renderer/src/features/map/BreadCrumbOverlay.tsx
packages/renderer/src/features/map/MapView.tsx
packages/renderer/src/features/map/layers/CityLayer.tsx
```

- [ ] **Step 5: Commit and push**

```bash
git add packages/renderer/src/features/map/CitySearchBox.tsx packages/renderer/src/features/map/BreadCrumbOverlay.tsx packages/renderer/src/features/map/MapView.tsx packages/renderer/src/features/map/layers/CityLayer.tsx
git commit -m "feat: add top city search overlay"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 5: End-To-End Validation And Handoff

**Files:**
- Modify only if required by validation fixes from prior tasks

- [ ] **Step 1: Run the full targeted renderer suite**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/cityBoundaryScope.test.ts test/cityLabelAnchor.test.ts test/citySearchIndex.test.ts test/cityExperience.test.ts test/mapStore.test.ts test/provinceDetailData.test.ts test/provinceBoundaryUrl.test.ts test/provinceCamera.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 2: Clear any diagnostics introduced by the edited files**

Inspect IDE diagnostics for:

```text
packages/renderer/src/features/map/cityBoundaryScope.ts
packages/renderer/src/features/map/cityLabelAnchor.ts
packages/renderer/src/features/map/citySearchIndex.ts
packages/renderer/src/features/map/cityExperience.ts
packages/renderer/src/features/map/CitySearchBox.tsx
packages/renderer/src/features/map/BreadCrumbOverlay.tsx
packages/renderer/src/features/map/MapView.tsx
packages/renderer/src/features/map/layers/CityLayer.tsx
packages/renderer/src/features/map/mapStore.ts
packages/renderer/src/features/map/mapLayout.js
```

Expected: No new diagnostics remain in the touched files.

- [ ] **Step 3: Perform the manual acceptance checklist**

Manual checks:

```text
1. Enter Beijing, Tianjin, Shanghai, and Chongqing; each province view shows district boundaries instead of going blank.
2. Hover one province and one city; the blue cover is visibly deeper than before and selected state remains stronger than hover.
3. Enter a province with narrow or coastal cities; most city labels sit inside their region rather than outside.
4. Click the top search icon; the input expands horizontally and the result list appears below it.
5. Search for Hangzhou or Shanghai, choose a result, and confirm the map, level state, and right drawer all move into that city detail flow.
```

Expected: All five checks pass without regressions to province drawer visibility or province drilldown.

- [ ] **Step 4: Commit any final polish fixes and push**

```bash
git add .
git commit -m "feat: finish municipality search and label polish"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

- [ ] **Step 5: Document the delivered behavior in the handoff note**

Handoff bullets:

```text
- Municipality provinces now render district subdivisions in province view.
- City labels use normalized in-region anchors.
- Province and city highlight fills are darker and more legible.
- Top overlay now includes a nationwide city search that jumps straight into city detail.
- Tests, typecheck, diagnostics, and manual checks all pass.
```
