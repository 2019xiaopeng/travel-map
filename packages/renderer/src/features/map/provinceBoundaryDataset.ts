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
  sourceVersion: string;
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
    sourceVersion: "generated@local",
  };
}
