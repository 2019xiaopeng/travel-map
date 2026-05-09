import type { GeoFeature } from "./geoTypes.ts";

const MUNICIPALITY_ADCODES = new Set(["110000", "120000", "310000", "500000"]);

export function isMunicipalityProvince(provinceAdcode: string) {
  return MUNICIPALITY_ADCODES.has(provinceAdcode);
}

function hasProvincePrefix(id: string, provinceAdcode: string) {
  return id.slice(0, 2) === provinceAdcode.slice(0, 2) && id !== provinceAdcode;
}

export function pickProvinceSubdivisionFeatures(input: {
  provinceAdcode: string;
  features: GeoFeature[];
}) {
  const scoped = input.features.filter((item) => {
    if (item.properties.parentAdcode) {
      return item.properties.parentAdcode === input.provinceAdcode;
    }

    return hasProvincePrefix(item.properties.id, input.provinceAdcode);
  });

  const cityMatches = scoped.filter((item) => item.properties.level === "city");
  if (cityMatches.length > 0) return cityMatches;

  const districtMatches = scoped.filter(
    (item) => item.properties.level === "district",
  );
  if (isMunicipalityProvince(input.provinceAdcode) && districtMatches.length > 0) {
    return districtMatches;
  }

  const levelAware = scoped.filter((item) => Boolean(item.properties.level));
  if (levelAware.length === 0) {
    return scoped;
  }

  return [];
}
