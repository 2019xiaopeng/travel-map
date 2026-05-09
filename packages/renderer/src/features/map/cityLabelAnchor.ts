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
  const centroid = isPoint(extra?.centroid) ? extra.centroid : undefined;
  const visualCenter =
    (isPoint(extra?.visualCenter) ? extra.visualCenter : undefined) ??
    centroid ??
    feature.properties.visualCenter ??
    feature.properties.center;

  const labelAnchor = pickLabelAnchor({
    labelAnchor:
      (isPoint(extra?.labelAnchor) ? extra.labelAnchor : undefined) ??
      feature.properties.labelAnchor,
    visualCenter,
    centroid,
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
