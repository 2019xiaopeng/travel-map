import type { GeoFeature } from "./geoTypes.ts";

export interface CitySearchEntry {
  cityId: string;
  cityName: string;
  provinceId: string;
  provinceName: string;
  center: [number, number];
  geometry?: GeoFeature["geometry"];
}

export interface SearchMatchPart {
  text: string;
  matched: boolean;
}

type SearchableCityEntry = CitySearchEntry & {
  searchableText: string;
  cityNameLower: string;
  provinceNameLower: string;
};

interface RawProvinceBoundaryFeature {
  properties?: {
    id?: string;
    name?: string;
    center?: [number, number];
    labelAnchor?: [number, number];
  };
}

interface RawCityFeature {
  properties?: {
    adcode?: string | number;
    name?: string;
    center?: [number, number];
    centroid?: [number, number];
    level?: string;
    parent?: {
      adcode?: string | number;
    };
  };
  geometry?: GeoFeature["geometry"];
}

const MUNICIPALITY_ADCODES = new Set(["110000", "120000", "310000", "500000"]);

function toAdcode(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString();
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    return match ? match[0] : null;
  }

  return null;
}

function toPoint(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return [lng, lat];
}

function dedupeEntries(entries: CitySearchEntry[]) {
  const seen = new Map<string, CitySearchEntry>();
  entries.forEach((entry) => {
    if (!seen.has(entry.cityId)) {
      seen.set(entry.cityId, entry);
    }
  });
  return Array.from(seen.values());
}

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
  if (entry.searchableText.includes(normalized)) return 4;

  return Number.POSITIVE_INFINITY;
}

export function searchCityIndex(index: SearchableCityEntry[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return index
    .map((entry, originalIndex) => ({
      entry,
      originalIndex,
      rank: getMatchRank(entry, normalized),
    }))
    .filter((item) => Number.isFinite(item.rank))
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.originalIndex - right.originalIndex;
    })
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

let cityIndexPromise: Promise<SearchableCityEntry[]> | null = null;

async function loadProvinceNameMap() {
  const response = await fetch("/geo/province-boundaries.generated.json");
  if (!response.ok) {
    throw new Error("Failed to load province boundary index");
  }

  const raw = (await response.json()) as {
    features?: RawProvinceBoundaryFeature[];
  };

  const nameMap = new Map<string, string>();
  const municipalityEntries: CitySearchEntry[] = [];

  for (const feature of raw.features ?? []) {
    const provinceId = toAdcode(feature.properties?.id);
    const provinceName = feature.properties?.name?.trim();
    const center =
      toPoint(feature.properties?.labelAnchor) ??
      toPoint(feature.properties?.center);

    if (!provinceId || !provinceName) continue;
    nameMap.set(provinceId, provinceName);

    if (MUNICIPALITY_ADCODES.has(provinceId) && center) {
      municipalityEntries.push({
        cityId: provinceId,
        cityName: provinceName,
        provinceId,
        provinceName,
        center,
      });
    }
  }

  return {
    nameMap,
    municipalityEntries,
  };
}

export async function loadCitySearchIndex() {
  if (cityIndexPromise) return cityIndexPromise;

  cityIndexPromise = Promise.all([
    loadProvinceNameMap(),
    fetch("/geo/china-provinces-cities.geojson"),
  ]).then(async ([provinceData, cityResponse]) => {
    if (!cityResponse.ok) {
      throw new Error("Failed to load nationwide city dataset");
    }

    const cityRaw = (await cityResponse.json()) as {
      features?: RawCityFeature[];
    };

    const cityEntries = (cityRaw.features ?? [])
      .filter((feature) => feature.properties?.level === "city")
      .map((feature): CitySearchEntry | null => {
        const cityId = toAdcode(feature.properties?.adcode);
        const provinceId = toAdcode(feature.properties?.parent?.adcode);
        const cityName = feature.properties?.name?.trim();
        const center =
          toPoint(feature.properties?.centroid) ??
          toPoint(feature.properties?.center);

        if (!cityId || !provinceId || !cityName || !center) {
          return null;
        }

        return {
          cityId,
          cityName,
          provinceId,
          provinceName: provinceData.nameMap.get(provinceId) ?? provinceId,
          center,
          geometry: feature.geometry,
        };
      })
      .filter((entry): entry is CitySearchEntry => entry !== null);

    return buildCitySearchIndex([
      ...provinceData.municipalityEntries,
      ...cityEntries,
    ]);
  });

  return cityIndexPromise;
}
