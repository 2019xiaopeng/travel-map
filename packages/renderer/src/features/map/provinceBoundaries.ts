import { loadGeoJson } from "./geoUtils";
import {
  loadCountryProvinceBoundaries,
  normalizeProvinceBoundaryEnvelope,
} from "./provinceBoundarySource";

export async function loadLocalProvinceBoundaries() {
  const geo = await loadGeoJson("china-provinces.json");
  return normalizeProvinceBoundaryEnvelope(geo.features);
}

export async function loadProvinceBoundaries() {
  const result = await loadCountryProvinceBoundaries();
  return result.features;
}

export { loadCountryProvinceBoundaries } from "./provinceBoundarySource";
