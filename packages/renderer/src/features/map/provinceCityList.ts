import type { GeoFeature } from "./geoTypes";

export function getProvinceCityNames(features: GeoFeature[]) {
  return Array.from(
    new Set(
      features
        .map((feature) => feature.properties.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((left, right) => left.localeCompare(right, "zh-CN"));
}
