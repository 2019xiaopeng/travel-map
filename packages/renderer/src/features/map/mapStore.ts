import { create } from "zustand";

export type MapLevel = "country" | "province" | "city";

interface MapState {
  level: MapLevel;
  provinceId: string | null;
  provinceName: string | null;
  cityId: string | null;
  cityName: string | null;
  drawerOpen: boolean;
  selectedPoiId: string | null;
  selectedTripId: string | null;

  enterProvince: (id: string, name: string) => void;
  enterCity: (id: string, name: string) => void;
  backToCountry: () => void;
  backToProvince: () => void;
  setDrawerOpen: (open: boolean) => void;
  selectPoi: (poiId: string | null) => void;
  selectTrip: (tripId: string | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  level: "country",
  provinceId: null,
  provinceName: null,
  cityId: null,
  cityName: null,
  drawerOpen: false,
  selectedPoiId: null,
  selectedTripId: null,

  enterProvince: (id, name) =>
    set({
      level: "province",
      provinceId: id,
      provinceName: name,
      cityId: null,
      cityName: null,
      drawerOpen: false,
      selectedPoiId: null,
      selectedTripId: null,
    }),

  enterCity: (id, name) =>
    set({
      level: "city",
      cityId: id,
      cityName: name,
      drawerOpen: true,
      selectedPoiId: null,
      selectedTripId: null,
    }),

  backToCountry: () =>
    set({
      level: "country",
      provinceId: null,
      provinceName: null,
      cityId: null,
      cityName: null,
      drawerOpen: false,
      selectedPoiId: null,
      selectedTripId: null,
    }),

  backToProvince: () =>
    set({
      level: "province",
      cityId: null,
      cityName: null,
      drawerOpen: false,
      selectedPoiId: null,
      selectedTripId: null,
    }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  selectPoi: (poiId) => set({ selectedPoiId: poiId, drawerOpen: true }),
  selectTrip: (tripId) => set({ selectedTripId: tripId }),
}));
