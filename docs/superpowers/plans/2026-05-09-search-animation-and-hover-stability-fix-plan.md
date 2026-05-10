# Search Animation And Hover Stability Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the search box close animation so it shrinks from right to left, and make province hover/highlight stable in both country and drilldown views without tag flicker.

**Architecture:** Keep the existing `CitySearchBox`, `ProvinceLayer`, and `ProvinceHoverOverlay` structure, but move the new behavior into small pure helpers that can be tested directly. Search animation becomes a class-state helper consumed by `CitySearchBox`, and hover stability is centralized in `provinceLayerMode.ts` plus delayed-clear logic inside `ProvinceLayer` so country and overlay modes share the same rules.

**Tech Stack:** React 19, TypeScript, Zustand, AMap JS API 2.0, Vite, Node `node:test`

---

## File Structure

**Create**
- `packages/renderer/src/features/map/searchBoxMotion.ts`
- `packages/renderer/test/searchBoxMotion.test.ts`

**Modify**
- `packages/renderer/src/features/map/CitySearchBox.tsx`
- `packages/renderer/src/features/map/provinceLayerMode.ts`
- `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- `packages/renderer/test/provinceLayerMode.test.ts`

---

### Task 1: Restore Search Box Close Animation

**Files:**
- Create: `packages/renderer/src/features/map/searchBoxMotion.ts`
- Modify: `packages/renderer/src/features/map/CitySearchBox.tsx`
- Test: `packages/renderer/test/searchBoxMotion.test.ts`

- [ ] **Step 1: Write the failing search motion tests**

`packages/renderer/test/searchBoxMotion.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getSearchBoxMotionState } from "../src/features/map/searchBoxMotion.ts";

test("getSearchBoxMotionState keeps the search shell mounted while closing", () => {
  const state = getSearchBoxMotionState(false);

  assert.equal(state.containerClass.includes("w-0"), true);
  assert.equal(state.innerClass.includes("pointer-events-none"), true);
  assert.equal(state.innerClass.includes("translate-x-2"), true);
});

test("getSearchBoxMotionState exposes interactive open-state classes", () => {
  const state = getSearchBoxMotionState(true);

  assert.equal(state.containerClass.includes("w-72"), true);
  assert.equal(state.innerClass.includes("pointer-events-auto"), true);
  assert.equal(state.panelClass.includes("opacity-100"), true);
});
```

- [ ] **Step 2: Run the focused motion test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/searchBoxMotion.test.ts
```

Expected: FAIL because `searchBoxMotion.ts` does not exist.

- [ ] **Step 3: Add the search motion helper**

`packages/renderer/src/features/map/searchBoxMotion.ts`

```ts
export function getSearchBoxMotionState(open: boolean) {
  return {
    containerClass: open
      ? "w-72 opacity-100"
      : "w-0 opacity-100",
    innerClass: open
      ? "pointer-events-auto translate-x-0 opacity-100"
      : "pointer-events-none translate-x-2 opacity-0",
    panelClass: open
      ? "pointer-events-auto opacity-100 translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1",
  };
}
```

- [ ] **Step 4: Update `CitySearchBox` to keep the DOM mounted and use motion classes**

`packages/renderer/src/features/map/CitySearchBox.tsx`

```tsx
import { getSearchBoxMotionState } from "./searchBoxMotion.ts";

export function CitySearchBox({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (entry: CitySearchEntry) => void;
}) {
  const motion = getSearchBoxMotionState(open);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    inputRef.current?.focus();

    loadCitySearchIndex()
      .then((value) => {
        setIndex(value);
        setError(null);
      })
      .catch((err) => {
        console.error("City search index load failed:", err);
        setError("城市索引加载失败");
      });
  }, [open]);

  return (
    <div
      className={`overflow-hidden transition-[width,opacity] duration-200 ease-out ${motion.containerClass}`}
      aria-hidden={!open}
    >
      <div className={`relative transition-all duration-200 ease-out ${motion.innerClass}`}>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) =>
                Math.min(current + 1, Math.max(results.length - 1, 0)),
              );
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              onSelect(results[activeIndex]);
            }
          }}
          placeholder="搜索全国城市"
          className="w-full rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white outline-none backdrop-blur-md placeholder:text-neutral-500"
        />

        <div
          className={`absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[rgba(8,16,24,0.94)] shadow-2xl transition-all duration-200 ease-out ${motion.panelClass}`}
        >
          {error ? (
            <div className="px-4 py-3 text-sm text-amber-200">{error}</div>
          ) : query.trim().length === 0 ? (
            <div className="px-4 py-3 text-sm text-neutral-400">输入城市名开始搜索</div>
          ) : results.length > 0 ? (
            results.map((item, index) => (
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
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-neutral-400">未找到匹配城市</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/searchBoxMotion.test.ts test/citySearchIndex.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 6: Commit and push**

```bash
git add packages/renderer/src/features/map/searchBoxMotion.ts packages/renderer/src/features/map/CitySearchBox.tsx packages/renderer/test/searchBoxMotion.test.ts
git commit -m "fix: restore city search close animation"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 2: Stabilize Province Hover Across Country And Overlay Modes

**Files:**
- Modify: `packages/renderer/src/features/map/provinceLayerMode.ts`
- Modify: `packages/renderer/src/features/map/layers/ProvinceLayer.tsx`
- Test: `packages/renderer/test/provinceLayerMode.test.ts`

- [ ] **Step 1: Extend the failing hover stability tests**

`packages/renderer/test/provinceLayerMode.test.ts`

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceLayerModeConfig } from "../src/features/map/provinceLayerMode.ts";

test("getProvinceLayerModeConfig keeps a shared delayed clear for country mode", () => {
  const config = getProvinceLayerModeConfig("country");

  assert.equal(config.fitView, true);
  assert.equal(config.hoverClearDelayMs, 90);
  assert.ok(config.outlineZIndex < config.zIndex);
});

test("getProvinceLayerModeConfig keeps the same hover stability rules in overlay mode", () => {
  const config = getProvinceLayerModeConfig("overlay");

  assert.equal(config.fitView, false);
  assert.equal(config.hoverClearDelayMs, 90);
  assert.ok(config.outlineZIndex < config.zIndex);
});
```

- [ ] **Step 2: Run the focused hover-mode test to verify it fails**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceLayerMode.test.ts
```

Expected: FAIL because `hoverClearDelayMs` and the new outline z-index expectations are not implemented yet.

- [ ] **Step 3: Add shared hover stability config**

`packages/renderer/src/features/map/provinceLayerMode.ts`

```ts
export type ProvinceLayerMode = "country" | "overlay";

const HOVER_CLEAR_DELAY_MS = 90;

export function getProvinceLayerModeConfig(mode: ProvinceLayerMode) {
  if (mode === "overlay") {
    return {
      fitView: false,
      zIndex: 45,
      outlineZIndex: 36,
      fillOpacity: 0.012,
      activeFillOpacity: 0.045,
      strokeWeight: 1.3,
      activeStrokeWeight: 2.1,
      outlineStrokeWeight: 1.15,
      hoverClearDelayMs: HOVER_CLEAR_DELAY_MS,
    };
  }

  return {
    fitView: true,
    zIndex: 60,
    outlineZIndex: 52,
    fillOpacity: 0.035,
    activeFillOpacity: 0.08,
    strokeWeight: 2.2,
    activeStrokeWeight: 3.2,
    outlineStrokeWeight: 1.8,
    hoverClearDelayMs: HOVER_CLEAR_DELAY_MS,
  };
}
```

- [ ] **Step 4: Update `ProvinceLayer` to delay hover clear and keep outlines from stealing hover**

`packages/renderer/src/features/map/layers/ProvinceLayer.tsx`

```tsx
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
  const hoverClearTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hoveredProvinceIdRef = useRef<string | null>(null);

  const cancelPendingHoverClear = useCallback(() => {
    if (hoverClearTimerRef.current !== null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  }, []);

  const applyHover = useCallback(
    (feature: GeoFeature, event: any) => {
      cancelPendingHoverClear();
      hoveredProvinceIdRef.current = feature.properties.id;
      const pixel = map.lngLatToContainer(event.lnglat);
      onProvinceHoverChange({
        provinceId: feature.properties.id,
        provinceName: feature.properties.name,
        x: typeof pixel?.getX === "function" ? pixel.getX() : pixel?.x,
        y: typeof pixel?.getY === "function" ? pixel.getY() : pixel?.y,
      });
    },
    [cancelPendingHoverClear, map, onProvinceHoverChange],
  );

  const scheduleHoverClear = useCallback(
    (provinceId: string) => {
      cancelPendingHoverClear();
      hoverClearTimerRef.current = window.setTimeout(() => {
        if (hoveredProvinceIdRef.current === provinceId) {
          hoveredProvinceIdRef.current = null;
          onProvinceHoverChange(null);
        }
        hoverClearTimerRef.current = null;
      }, modeConfig.hoverClearDelayMs);
    },
    [cancelPendingHoverClear, modeConfig.hoverClearDelayMs, onProvinceHoverChange],
  );

  useEffect(() => {
    hoveredProvinceIdRef.current = hoveredProvinceId;
  }, [hoveredProvinceId]);

  const renderFeatures = useCallback(
    (
      features: GeoFeature[],
      options: {
        fitView: boolean;
      },
    ) => {
      const AMap = window.AMap;
      clearLayers();

      const polygons: any[] = [];
      const outlines: any[] = [];

      features.forEach((feature) => {
        const paths =
          feature.geometry.type === "Polygon"
            ? polygonCoordsToPaths(feature.geometry.coordinates as number[][][])
            : multiPolygonCoordsToPaths(feature.geometry.coordinates as number[][][][]);

        const polygon = new AMap.Polygon({
          ...normalStyle,
          path: paths,
          extData: feature.properties,
        });

        polygon.on("click", () => handleClick(feature));
        polygon.on("mouseover", (event: any) => applyHover(feature, event));
        polygon.on("mousemove", (event: any) => applyHover(feature, event));
        polygon.on("mouseout", () => scheduleHoverClear(feature.properties.id));

        polygons.push(polygon);
        polygonMapRef.current.set(feature.properties.id, polygon);

        const outlineSets = Array.isArray(paths[0][0][0])
          ? (paths as [number, number][][][])
          : [paths as [number, number][][]];

        outlineSets.forEach((polygonRings) => {
          polygonRings.forEach((ring) => {
            const outline = new AMap.Polyline({
              path: ring,
              strokeColor: PROVINCE_LAYER_TOKENS.stroke,
              strokeOpacity: 0.86,
              strokeWeight: modeConfig.outlineStrokeWeight,
              strokeStyle: "solid",
              lineJoin: "round",
              lineCap: "round",
              zIndex: modeConfig.outlineZIndex,
              bubble: false,
            });
            outlines.push(outline);
          });
        });
      });

      polygonsRef.current = polygons;
      outlinesRef.current = outlines;
      map.add(outlines);
      map.add(polygons);
      if (options.fitView) {
        map.setFitView(polygons, false, MAP_FIT_PADDING_CLOSED);
      }
    },
    [
      applyHover,
      clearLayers,
      handleClick,
      map,
      modeConfig,
      normalStyle,
      scheduleHoverClear,
    ],
  );

  useEffect(() => {
    if (!map) return;

    renderFeatures(features, { fitView: modeConfig.fitView });

    return () => {
      cancelPendingHoverClear();
      hoveredProvinceIdRef.current = null;
      clearLayers();
      onProvinceHoverChange(null);
    };
  }, [
    map,
    cancelPendingHoverClear,
    clearLayers,
    features,
    modeConfig.fitView,
    onProvinceHoverChange,
    renderFeatures,
  ]);
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/provinceLayerMode.test.ts test/cityCamera.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 6: Commit and push**

```bash
git add packages/renderer/src/features/map/provinceLayerMode.ts packages/renderer/src/features/map/layers/ProvinceLayer.tsx packages/renderer/test/provinceLayerMode.test.ts
git commit -m "fix: stabilize province hover interactions"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

---

### Task 3: Final Validation And Handoff

**Files:**
- Modify only if validation reveals issues in the touched files

- [ ] **Step 1: Run the targeted renderer suite**

Run:

```bash
pnpm --filter @travel-map/renderer test -- test/searchBoxMotion.test.ts test/citySearchIndex.test.ts test/provinceLayerMode.test.ts test/cityCamera.test.ts test/cityExperience.test.ts
pnpm --filter @travel-map/renderer typecheck
```

Expected:

```text
# pass
tsc --noEmit
```

- [ ] **Step 2: Verify diagnostics are clean for touched files**

Inspect IDE diagnostics for:

```text
packages/renderer/src/features/map/searchBoxMotion.ts
packages/renderer/src/features/map/CitySearchBox.tsx
packages/renderer/src/features/map/provinceLayerMode.ts
packages/renderer/src/features/map/layers/ProvinceLayer.tsx
```

Expected: No new diagnostics remain in the touched files.

- [ ] **Step 3: Run the manual acceptance checklist**

Manual checks:

```text
1. Open and close the top search box and confirm it shrinks from right to left instead of disappearing instantly.
2. Hover a province on the country map and confirm highlight and follow-tag remain stable while the cursor stays inside the province.
3. Stop moving the mouse inside one province and confirm the tag stays visible.
4. Enter a province, hover a neighboring province, and confirm highlight and follow-tag remain stable there as well.
5. Leave the province area completely and confirm the tag disappears only after the cursor is actually out.
```

Expected: All checks pass without regressing province click-through, neighbor switching, or search result interaction.

- [ ] **Step 4: Commit any final polish fixes and push**

```bash
git add .
git commit -m "fix: finish search animation and hover stability polish"
git push origin HEAD:main
```

Expected: Push succeeds. If push fails, retry with the user's approved `7890` port workflow.

- [ ] **Step 5: Prepare the handoff summary**

Handoff bullets:

```text
- Search close animation now shrinks from right to left instead of disappearing.
- Search content stays mounted during close but is non-interactive while hidden.
- Province hover uses delayed clear logic, so highlight and follow-tag remain stable inside the province.
- Outline rendering no longer steals hover focus from the province fill.
- Tests, typecheck, diagnostics, and manual checks all pass.
```
