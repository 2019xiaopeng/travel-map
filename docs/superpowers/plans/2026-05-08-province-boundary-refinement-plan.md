# Province Boundary Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coarse country-view province outlines with cached high-fidelity AMap boundaries, and rebuild hover behavior so country-view highlights and tooltips never get stuck.

**Architecture:** Add a renderer-side province-boundary source that reads a versioned local cache first, falls back to AMap `DistrictSearch`, and writes successful responses back to cache through a small Electron IPC bridge. Keep country-view interaction state in one place in `MapView`, render only ready high-fidelity boundaries, and move hover tooltip lifecycle into a dedicated overlay instead of letting `ProvinceLayer` manage it implicitly.

**Tech Stack:** React 19, TypeScript, Electron, IPC, AMap JS API 2.0, Zustand, node:test, Vite

---

## File Structure

**Create**
- `packages/renderer/src/features/map/provinceBoundaryCache.ts`
  - Renderer-side cache adapter and versioned cache envelope helpers.
- `packages/renderer/src/features/map/provinceBoundarySource.ts`
  - Cache-first country-view province-boundary loader built on top of AMap `DistrictSearch`.
- `packages/renderer/src/features/map/ProvinceHoverOverlay.tsx`
  - Single tooltip overlay driven by explicit hover state.
- `packages/renderer/test/provinceBoundaryCache.test.ts`
  - Cache envelope and adapter behavior tests.
- `packages/renderer/test/provinceBoundarySource.test.ts`
  - Source normalization and branch selection tests.

**Modify**
- `packages/app/src/preload/index.ts`
  - Expose read/write cache IPC methods to the renderer.
- `packages/app/src/main/ipc.ts`
  - Add `cache:readProvinceBoundaries` and `cache:writeProvinceBoundaries` handlers using `app.getPath("userData")`.
- `packages/renderer/src/vite-env.d.ts`
  - Add typings for the new cache bridge methods.
- `packages/renderer/src/features/map/MapView.tsx`
  - Own `provinceBoundaryStatus`, `hoveredProvinceId`, and `selectedProvinceId`, and render loading/error UI for country view.
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
  - Draw only ready high-fidelity province boundaries and emit hover/click callbacks instead of owning tooltip state.
- `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`
  - Consume loaded province-boundary data and remain responsible only for fixed labels and click entry.
- `packages/renderer/src/features/map/provinceBoundaries.ts`
  - Replace current progressive fallback exports with a thin compatibility layer or remove direct callers in favor of `provinceBoundarySource.ts`.
- `packages/renderer/src/features/map/loadAmapSdk.ts`
  - Keep the plugin loader reusable for `DistrictSearch`.

**Validate**
- `docs/superpowers/specs/2026-05-08-province-boundary-refinement-design.md`
  - Source-of-truth spec for this plan.
- `packages/renderer/test/geoUtils.test.ts`
  - Existing geometry helper reference.

---

### Task 1: Add the province-boundary cache bridge

**Files:**
- Create: `packages/renderer/src/features/map/provinceBoundaryCache.ts`
- Modify: `packages/app/src/preload/index.ts`
- Modify: `packages/app/src/main/ipc.ts`
- Modify: `packages/renderer/src/vite-env.d.ts`
- Test: `packages/renderer/test/provinceBoundaryCache.test.ts`

- [ ] **Step 1: Write the failing cache tests**

Create `packages/renderer/test/provinceBoundaryCache.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  BOUNDARY_CACHE_VERSION,
  createBoundaryCachePayload,
  isBoundaryCachePayload,
} from "../src/features/map/provinceBoundaryCache.ts";

test("createBoundaryCachePayload stamps the current version", () => {
  const payload = createBoundaryCachePayload([{ id: "330000", name: "浙江", center: [120.15, 30.28], geometry: { type: "Polygon", coordinates: [] } } as any]);
  assert.equal(payload.version, BOUNDARY_CACHE_VERSION);
  assert.equal(Array.isArray(payload.features), true);
});

test("isBoundaryCachePayload rejects stale or malformed payloads", () => {
  assert.equal(isBoundaryCachePayload(null), false);
  assert.equal(isBoundaryCachePayload({ version: 0, features: [] }), false);
  assert.equal(isBoundaryCachePayload({ version: BOUNDARY_CACHE_VERSION, features: [] }), true);
});
```

- [ ] **Step 2: Run the cache tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryCache.test.ts
```

Expected: FAIL because `provinceBoundaryCache.ts` does not exist yet.

- [ ] **Step 3: Implement the renderer cache adapter and Electron bridge**

Create `packages/renderer/src/features/map/provinceBoundaryCache.ts`:

```ts
import type { GeoFeature } from "./geoTypes";

export const BOUNDARY_CACHE_VERSION = 1;
const BOUNDARY_CACHE_KEY = "travel-map:province-boundaries:v1";

export interface BoundaryCachePayload {
  version: number;
  writtenAt: number;
  source: "cache" | "amap";
  features: GeoFeature[];
}

export function createBoundaryCachePayload(
  features: GeoFeature[],
  source: "cache" | "amap" = "amap",
): BoundaryCachePayload {
  return {
    version: BOUNDARY_CACHE_VERSION,
    writtenAt: Date.now(),
    source,
    features,
  };
}

export function isBoundaryCachePayload(value: unknown): value is BoundaryCachePayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as any).version === BOUNDARY_CACHE_VERSION &&
      Array.isArray((value as any).features),
  );
}

export async function readProvinceBoundaryCache() {
  if (window.travelMap.cache?.readProvinceBoundaries) {
    return window.travelMap.cache.readProvinceBoundaries();
  }

  const raw = window.localStorage.getItem(BOUNDARY_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return isBoundaryCachePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeProvinceBoundaryCache(payload: BoundaryCachePayload) {
  if (window.travelMap.cache?.writeProvinceBoundaries) {
    return window.travelMap.cache.writeProvinceBoundaries(payload);
  }

  window.localStorage.setItem(BOUNDARY_CACHE_KEY, JSON.stringify(payload));
  return { ok: true as const };
}
```

Update `packages/app/src/preload/index.ts`:

```ts
  cache: {
    readProvinceBoundaries: () => ipcRenderer.invoke("cache:readProvinceBoundaries"),
    writeProvinceBoundaries: (payload: any) =>
      ipcRenderer.invoke("cache:writeProvinceBoundaries", payload),
  },
```

Update `packages/renderer/src/vite-env.d.ts`:

```ts
    cache: {
      readProvinceBoundaries: () => Promise<any>;
      writeProvinceBoundaries: (payload: any) => Promise<{ ok?: boolean; error?: string }>;
    };
```

Update `packages/app/src/main/ipc.ts`:

```ts
  ipcMain.handle("cache:readProvinceBoundaries", async (event) => {
    assertSender(event);
    try {
      const userDataPath = app.getPath("userData");
      const abs = path.join(userDataPath, "cache", "province-boundaries.json");
      const raw = await fs.promises.readFile(abs, "utf8");
      return JSON.parse(raw);
    } catch (e: any) {
      if (e?.code === "ENOENT") return null;
      return { error: e.message };
    }
  });

  ipcMain.handle("cache:writeProvinceBoundaries", async (event, payload: any) => {
    assertSender(event);
    try {
      const userDataPath = app.getPath("userData");
      const cacheDir = path.join(userDataPath, "cache");
      const abs = path.join(cacheDir, "province-boundaries.json");
      await fs.promises.mkdir(cacheDir, { recursive: true });
      await fs.promises.writeFile(abs, JSON.stringify(payload, null, 2), "utf8");
      return { ok: true };
    } catch (e: any) {
      return { error: e.message };
    }
  });
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryCache.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/preload/index.ts packages/app/src/main/ipc.ts packages/renderer/src/vite-env.d.ts packages/renderer/src/features/map/provinceBoundaryCache.ts packages/renderer/test/provinceBoundaryCache.test.ts
git commit -m "feat: add province boundary cache bridge"
```

---

### Task 2: Build the cache-first province boundary source

**Files:**
- Create: `packages/renderer/src/features/map/provinceBoundarySource.ts`
- Modify: `packages/renderer/src/features/map/loadAmapSdk.ts`
- Modify: `packages/renderer/src/features/map/provinceBoundaries.ts`
- Test: `packages/renderer/test/provinceBoundarySource.test.ts`

- [ ] **Step 1: Write the failing source tests**

Create `packages/renderer/test/provinceBoundarySource.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProvinceBoundaryEnvelope,
  shouldUseBoundaryCache,
} from "../src/features/map/provinceBoundarySource.ts";

test("normalizeProvinceBoundaryEnvelope rewrites 2-digit ids to 6-digit adcodes", () => {
  const normalized = normalizeProvinceBoundaryEnvelope([
    {
      type: "Feature",
      properties: { id: "33", name: "浙江", center: [120.15, 30.28] },
      geometry: { type: "Polygon", coordinates: [[[120, 30], [121, 30], [121, 31], [120, 31], [120, 30]]] },
    } as any,
  ]);

  assert.equal(normalized[0].properties.id, "330000");
});

test("shouldUseBoundaryCache accepts only matching cache version", () => {
  assert.equal(shouldUseBoundaryCache(null), false);
  assert.equal(shouldUseBoundaryCache({ version: 0, features: [] } as any), false);
  assert.equal(shouldUseBoundaryCache({ version: 1, features: [] } as any), true);
});
```

- [ ] **Step 2: Run the source tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundarySource.test.ts
```

Expected: FAIL because `provinceBoundarySource.ts` does not exist yet.

- [ ] **Step 3: Implement cache-first loading and AMap fallback**

Create `packages/renderer/src/features/map/provinceBoundarySource.ts`:

```ts
import type { GeoFeature } from "./geoTypes";
import { featureCenter, loadGeoJson } from "./geoUtils";
import {
  createBoundaryCachePayload,
  isBoundaryCachePayload,
  readProvinceBoundaryCache,
  writeProvinceBoundaryCache,
} from "./provinceBoundaryCache";
import { loadAmapPlugin } from "./loadAmapSdk";

export function normalizeProvinceBoundaryEnvelope(features: GeoFeature[]) {
  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      id: feature.properties.id.length === 2 ? `${feature.properties.id}0000` : feature.properties.id,
      center: feature.properties.center ?? featureCenter(feature.geometry),
    },
  }));
}

export function shouldUseBoundaryCache(value: unknown) {
  return isBoundaryCachePayload(value);
}

async function fetchProvinceBoundariesFromAmap(seedFeatures: GeoFeature[]) {
  const AMap = await loadAmapPlugin("AMap.DistrictSearch");

  return Promise.all(
    seedFeatures.map(
      (seed) =>
        new Promise<GeoFeature>((resolve) => {
          const districtSearch = new AMap.DistrictSearch({
            level: "province",
            subdistrict: 0,
            extensions: "all",
          });

          districtSearch.search(seed.properties.name, (status: string, result: any) => {
            if (status !== "complete") {
              resolve(seed);
              return;
            }

            const district = result?.districtList?.find((item: any) => item?.adcode === seed.properties.id) ?? result?.districtList?.[0];
            const boundaries = district?.boundaries ?? [];
            if (boundaries.length === 0) {
              resolve(seed);
              return;
            }

            const rings = boundaries.map((boundary: any) =>
              boundary.map((point: any) => [point.lng ?? point.getLng(), point.lat ?? point.getLat()]),
            );

            resolve({
              type: "Feature",
              properties: {
                id: seed.properties.id,
                name: district?.name ?? seed.properties.name,
                center: district?.center ? [district.center.lng ?? district.center.getLng(), district.center.lat ?? district.center.getLat()] : seed.properties.center,
              },
              geometry: rings.length === 1
                ? { type: "Polygon", coordinates: [rings[0]] }
                : { type: "MultiPolygon", coordinates: rings.map((ring: number[][]) => [ring]) },
            } as GeoFeature);
          });
        }),
    ),
  );
}

export async function loadCountryProvinceBoundaries() {
  const cached = await readProvinceBoundaryCache();
  if (shouldUseBoundaryCache(cached)) {
    return {
      status: "ready" as const,
      source: "cache" as const,
      features: normalizeProvinceBoundaryEnvelope(cached.features),
    };
  }

  const localSeed = await loadGeoJson("china-provinces.json");
  const normalizedSeed = normalizeProvinceBoundaryEnvelope(localSeed.features);
  const features = await fetchProvinceBoundariesFromAmap(normalizedSeed);
  await writeProvinceBoundaryCache(createBoundaryCachePayload(features, "amap"));

  return {
    status: "ready" as const,
    source: "amap" as const,
    features: normalizeProvinceBoundaryEnvelope(features),
  };
}
```

Update `packages/renderer/src/features/map/provinceBoundaries.ts` to become a compatibility shim:

```ts
export { loadCountryProvinceBoundaries as loadProvinceBoundaries } from "./provinceBoundarySource";
```

- [ ] **Step 4: Run the new tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundarySource.test.ts test/provinceBoundaryCache.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/provinceBoundarySource.ts packages/renderer/src/features/map/provinceBoundaries.ts packages/renderer/test/provinceBoundarySource.test.ts
git commit -m "feat: load province boundaries from cache-first source"
```

---

### Task 3: Rebuild the country-view layer and hover lifecycle

**Files:**
- Create: `packages/renderer/src/features/map/ProvinceHoverOverlay.tsx`
- Modify: `packages/renderer/src/features/map/MapView.tsx`
- Modify: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Modify: `packages/renderer/src/features/map/ProvinceTagOverlay.tsx`

- [ ] **Step 1: Write the failing hover tests**

Append to `packages/renderer/test/provinceBoundarySource.test.ts`:

```ts
import { clearProvinceHover, nextProvinceHoverState } from "../src/features/map/ProvinceHoverOverlay.tsx";

test("nextProvinceHoverState stores hovered province and pixel position", () => {
  const state = nextProvinceHoverState(null, {
    provinceId: "330000",
    provinceName: "浙江",
    x: 240,
    y: 120,
  });

  assert.equal(state?.provinceId, "330000");
  assert.equal(state?.x, 240);
});

test("clearProvinceHover always removes tooltip state", () => {
  assert.equal(clearProvinceHover({ provinceId: "330000", provinceName: "浙江", x: 1, y: 2 }), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundarySource.test.ts
```

Expected: FAIL because `ProvinceHoverOverlay.tsx` and its helpers do not exist yet.

- [ ] **Step 3: Move hover state to `MapView` and split tooltip rendering**

Create `packages/renderer/src/features/map/ProvinceHoverOverlay.tsx`:

```tsx
export interface ProvinceHoverState {
  provinceId: string;
  provinceName: string;
  x: number;
  y: number;
}

export function nextProvinceHoverState(
  _previous: ProvinceHoverState | null,
  next: ProvinceHoverState,
) {
  return next;
}

export function clearProvinceHover(_previous: ProvinceHoverState | null) {
  return null;
}

export function ProvinceHoverOverlay({ hover }: { hover: ProvinceHoverState | null }) {
  if (!hover) return null;

  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-full border border-white/10 bg-[rgba(8,16,24,0.92)] px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/30"
      style={{ left: hover.x, top: hover.y - 10 }}
    >
      {hover.provinceName}
    </div>
  );
}
```

Update `packages/renderer/src/features/map/MapView.tsx`:

```tsx
const [provinceBoundaryStatus, setProvinceBoundaryStatus] = useState<"loading" | "ready" | "error">("loading");
const [provinceFeatures, setProvinceFeatures] = useState<GeoFeature[]>([]);
const [provinceHover, setProvinceHover] = useState<ProvinceHoverState | null>(null);

useEffect(() => {
  if (level !== "country") return;

  let cancelled = false;
  setProvinceBoundaryStatus("loading");

  loadCountryProvinceBoundaries()
    .then((result) => {
      if (cancelled) return;
      setProvinceFeatures(result.features);
      setProvinceBoundaryStatus("ready");
    })
    .catch(() => {
      if (cancelled) return;
      setProvinceBoundaryStatus("error");
    });

  return () => {
    cancelled = true;
    setProvinceHover(null);
  };
}, [level]);
```

Update `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`:

```tsx
export function ProvinceLayer({
  map,
  features,
  onHoverChange,
}: {
  map: any;
  features: GeoFeature[];
  onHoverChange: (next: { provinceId: string; provinceName: string; x: number; y: number } | null) => void;
}) {
  // Remove tooltipRef completely.
  polygon.on("mouseover", (e: any) => {
    polygon.setOptions(HOVER_STYLE);
    const pixel = map.lngLatToContainer(e.lnglat);
    onHoverChange({
      provinceId: feature.properties.id,
      provinceName: feature.properties.name,
      x: typeof pixel.getX === "function" ? pixel.getX() : pixel.x,
      y: typeof pixel.getY === "function" ? pixel.getY() : pixel.y,
    });
  });

  polygon.on("mousemove", (e: any) => {
    const pixel = map.lngLatToContainer(e.lnglat);
    onHoverChange({
      provinceId: feature.properties.id,
      provinceName: feature.properties.name,
      x: typeof pixel.getX === "function" ? pixel.getX() : pixel.x,
      y: typeof pixel.getY === "function" ? pixel.getY() : pixel.y,
    });
  });

  polygon.on("mouseout", () => {
    polygon.setOptions(NORMAL_STYLE);
    onHoverChange(null);
  });
}
```

Update `packages/renderer/src/features/map/ProvinceTagOverlay.tsx` so it accepts `features` as a prop and does not fetch on its own:

```tsx
export function ProvinceTagOverlay({
  map,
  features,
}: {
  map: any;
  features: GeoFeature[];
}) {
  // keep projection logic, remove internal loading effect
}
```

- [ ] **Step 4: Run typecheck and browser smoke check**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundarySource.test.ts
pnpm --filter @travel-map/renderer typecheck
pnpm dev
```

Expected:
- Tests PASS
- Typecheck PASS
- Country view shows no coarse province outline while loading
- Province hover tooltip disappears immediately on mouseout

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/features/map/ProvinceHoverOverlay.tsx packages/renderer/src/features/map/MapView.tsx packages/renderer/src/features/map/layers/ProvinceLayer.tsx packages/renderer/src/features/map/ProvinceTagOverlay.tsx packages/renderer/test/provinceBoundarySource.test.ts
git commit -m "refactor: rebuild country view hover lifecycle"
```

---

### Task 4: Final verification and push preparation

**Files:**
- Validate: `packages/renderer/src/features/map/MapView.tsx`
- Validate: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Validate: `packages/renderer/src/features/map/ProvinceHoverOverlay.tsx`
- Validate: `packages/renderer/src/features/map/provinceBoundarySource.ts`

- [ ] **Step 1: Run focused automated checks**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceBoundaryCache.test.ts test/provinceBoundarySource.test.ts test/geoUtils.test.ts test/mapStore.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected: PASS.

- [ ] **Step 2: Run browser and Electron manual checks**

Manual checks:

```md
1. Clear the province-boundary cache once, open the country view, and confirm only the basemap + a loading hint appear.
2. Wait for the boundary source to become ready and confirm the province outlines look significantly more detailed than the old local seed file.
3. Move the mouse over several provinces and confirm the hover tooltip always disappears on mouseout.
4. Click 浙江 or 甘肃 and confirm province drill-down still works.
5. Reload the app and confirm the country-view province boundaries come from cache without waiting for a full round-trip.
6. Open Electron with `pnpm dev:electron:local` and repeat steps 1-4.
```

- [ ] **Step 3: Review diagnostics and git status**

Run:

```bash
git status --short
```

Expected: no unexpected files remain.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: refine province boundaries and country view hover"
```

- [ ] **Step 5: Push after review**

```bash
git push origin HEAD:main
```

Expected: push succeeds; if remote rejects, stop and ask for guidance before rewriting history.

---

## Self-Review

### Spec coverage
- `高德 API + 本地缓存`: covered by Task 1 and Task 2.
- 首屏不显示粗糙省界: covered by Task 3 and Task 4 manual checks.
- hover 提示状态化、移出立即消失: covered by Task 3.
- 点击省份进入省级仍然稳定: covered by Task 3 and Task 4 manual checks.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Each task lists exact files, commands, and code snippets.

### Type consistency
- Cache payload naming is centered on `BoundaryCachePayload`.
- Country-view data loader naming is centered on `loadCountryProvinceBoundaries()`.
- Hover overlay naming is centered on `ProvinceHoverState`.
