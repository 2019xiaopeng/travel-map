import type { GeoFeature } from "./geoTypes.ts";
import { featureCenter, geometryBounds, loadGeoJson } from "./geoUtils.ts";

let provinceBoundarySourcePromise: Promise<{
  status: "ready";
  source: "generated";
  features: GeoFeature[];
}> | null = null;

export function normalizeProvinceAdcode(id: string) {
  return id.length === 2 ? `${id}0000` : id;
}

export function normalizeProvinceBoundaryEnvelope(features: GeoFeature[]) {
  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      id: normalizeProvinceAdcode(feature.properties.id),
      center: feature.properties.center ?? featureCenter(feature.geometry),
      labelAnchor:
        feature.properties.labelAnchor ??
        feature.properties.center ??
        featureCenter(feature.geometry),
      visualCenter:
        feature.properties.visualCenter ??
        feature.properties.center ??
        featureCenter(feature.geometry),
      bounds: feature.properties.bounds ?? geometryBounds(feature.geometry),
    },
  }));
}

export async function loadCountryProvinceBoundaries() {
  if (provinceBoundarySourcePromise) return provinceBoundarySourcePromise;

  provinceBoundarySourcePromise = (async () => {
    const generated = await loadGeoJson("province-boundaries.generated.json");

    return {
      status: "ready" as const,
      source: "generated" as const,
      features: normalizeProvinceBoundaryEnvelope(generated.features),
    };
  })();

  return provinceBoundarySourcePromise;
}
