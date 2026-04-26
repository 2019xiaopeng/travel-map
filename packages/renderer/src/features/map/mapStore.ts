import { create } from "zustand";

export type MapLevel = "country" | "province" | "city";

interface MapState {
  level: MapLevel;
  provinceId: string | null;
  provinceName: string | null;
  cityId: string | null;
  cityName: string | null;
  drawerOpen: boolean;

  enterProvince: (id: string, name: string) => void;
  enterCity: (id: string, name: string) => void;
  backToCountry: () => void;
  backToProvince: () => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  level: "country",
  provinceId: null,
  provinceName: null,
  cityId: null,
  cityName: null,
  drawerOpen: false,

  enterProvince: (id, name) =>
    set({
      level: "province",
      provinceId: id,
      provinceName: name,
      cityId: null,
      cityName: null,
      drawerOpen: false,
    }),

  enterCity: (id, name) =>
    set({
      level: "city",
      cityId: id,
      cityName: name,
      drawerOpen: true,
    }),

  backToCountry: () =>
    set({
      level: "country",
      provinceId: null,
      provinceName: null,
      cityId: null,
      cityName: null,
      drawerOpen: false,
    }),

  backToProvince: () =>
    set({
      level: "province",
      cityId: null,
      cityName: null,
      drawerOpen: false,
    }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
}));
