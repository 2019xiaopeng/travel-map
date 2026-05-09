import { create } from "zustand";
import type { GeoFeature } from "./geoTypes";

export type MapLevel = "country" | "province" | "city";

interface MapState {
  level: MapLevel;
  provinceId: string | null;
  provinceName: string | null;
  cityId: string | null;
  cityName: string | null;
  provinceCityFeatures: GeoFeature[];
  drawerOpen: boolean;
  selectedPoiId: string | null;
  selectedTripId: string | null;
  addingPoi: boolean;
  poiDraft: { lng: number; lat: number; gcj02_lng: number; gcj02_lat: number } | null;

  enterProvince: (id: string, name: string) => void;
  openProvinceExperience: (payload: { id: string; name: string }) => void;
  enterCity: (id: string, name: string) => void;
  backToCountry: () => void;
  backToProvince: () => void;
  setDrawerOpen: (open: boolean) => void;
  setProvinceCityFeatures: (features: GeoFeature[]) => void;
  selectPoi: (poiId: string | null) => void;
  selectTrip: (tripId: string | null) => void;
  startAddPoi: () => void;
  cancelAddPoi: () => void;
  openPoiDraft: (draft: { lng: number; lat: number; gcj02_lng: number; gcj02_lat: number }) => void;
  closePoiDraft: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  level: "country",
  provinceId: null,
  provinceName: null,
  cityId: null,
  cityName: null,
  provinceCityFeatures: [],
  drawerOpen: false,
  selectedPoiId: null,
  selectedTripId: null,
  addingPoi: false,
  poiDraft: null,

  openProvinceExperience: ({ id, name }) =>
    set({
      level: "province",
      provinceId: id,
      provinceName: name,
      cityId: null,
      cityName: null,
      provinceCityFeatures: [],
      drawerOpen: true,
      selectedPoiId: null,
      selectedTripId: null,
      addingPoi: false,
      poiDraft: null,
    }),

  enterProvince: (id, name) =>
    set({
      level: "province",
      provinceId: id,
      provinceName: name,
      cityId: null,
      cityName: null,
      provinceCityFeatures: [],
      drawerOpen: true,
      selectedPoiId: null,
      selectedTripId: null,
      addingPoi: false,
      poiDraft: null,
    }),

  enterCity: (id, name) =>
    set({
      level: "city",
      cityId: id,
      cityName: name,
      drawerOpen: true,
      selectedPoiId: null,
      selectedTripId: null,
      addingPoi: false,
      poiDraft: null,
    }),

  backToCountry: () =>
    set({
      level: "country",
      provinceId: null,
      provinceName: null,
      cityId: null,
      cityName: null,
      provinceCityFeatures: [],
      drawerOpen: false,
      selectedPoiId: null,
      selectedTripId: null,
      addingPoi: false,
      poiDraft: null,
    }),

  backToProvince: () =>
    set({
      level: "province",
      cityId: null,
      cityName: null,
      drawerOpen: true,
      selectedPoiId: null,
      selectedTripId: null,
      addingPoi: false,
      poiDraft: null,
    }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setProvinceCityFeatures: (features) => set({ provinceCityFeatures: features }),
  selectPoi: (poiId) => set({ selectedPoiId: poiId, drawerOpen: true }),
  selectTrip: (tripId) => set({ selectedTripId: tripId }),
  startAddPoi: () => set({ addingPoi: true, poiDraft: null }),
  cancelAddPoi: () => set({ addingPoi: false, poiDraft: null }),
  openPoiDraft: (draft) => set({ poiDraft: draft, addingPoi: false }),
  closePoiDraft: () => set({ poiDraft: null }),
}));
