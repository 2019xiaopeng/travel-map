import { focusCityOnMap } from "./geoUtils.ts";
import { useMapStore } from "./mapStore.ts";

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

  focusCityOnMap(map, {
    geometry: input.geometry,
    visualCenter: input.center,
    drawerOpen: true,
  });
}
