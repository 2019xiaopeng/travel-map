import { contextBridge, ipcRenderer } from "electron";
import { is } from "@electron-toolkit/utils";

const api = {
  isDev: is.dev,
  app: {
    relaunch: () => ipcRenderer.invoke("app:relaunch"),
  },
  db: {
    getCity: (payload: { cityId: string; provinceId: string; cityName: string; provinceName: string }) =>
      ipcRenderer.invoke("db:getCity", payload),
    getCityAssets: (payload: { cityId: string }) => ipcRenderer.invoke("db:getCityAssets", payload),
    getTrips: (payload: { cityId: string }) => ipcRenderer.invoke("db:getTrips", payload),
    getTrip: (payload: { tripId: string }) => ipcRenderer.invoke("db:getTrip", payload),
    createTrip: (payload: { city_id: string; title?: string; date_start?: string; date_end?: string; companions?: string; route?: string; cost_total?: number; cover_asset_id?: string | null; content?: string; provinceId?: string; provinceName?: string; cityName?: string }) =>
      ipcRenderer.invoke("db:createTrip", payload),
    updateTrip: (payload: any) => ipcRenderer.invoke("db:updateTrip", payload),
    deleteTrip: (payload: { tripId: string }) => ipcRenderer.invoke("db:deleteTrip", payload),

    getPois: (payload: { cityId: string }) => ipcRenderer.invoke("db:getPois", payload),
    getPoi: (payload: { poiId: string }) => ipcRenderer.invoke("db:getPoi", payload),
    createPoi: (payload: any) => ipcRenderer.invoke("db:createPoi", payload),
    updatePoi: (payload: any) => ipcRenderer.invoke("db:updatePoi", payload),
    deletePoi: (payload: { poiId: string }) => ipcRenderer.invoke("db:deletePoi", payload),

    getPoisForTrip: (payload: { tripId: string }) => ipcRenderer.invoke("db:getPoisForTrip", payload),
    addPoiToTrip: (payload: { tripId: string; poiId: string }) => ipcRenderer.invoke("db:addPoiToTrip", payload),
    removePoiFromTrip: (payload: { tripId: string; poiId: string }) => ipcRenderer.invoke("db:removePoiFromTrip", payload),
    getTripsForPoi: (payload: { poiId: string }) => ipcRenderer.invoke("db:getTripsForPoi", payload),

    getTripCosts: (payload: { tripId: string }) => ipcRenderer.invoke("db:getTripCosts", payload),
    updateTripCost: (payload: { tripId: string; category: string; amount: number }) =>
      ipcRenderer.invoke("db:updateTripCost", payload),
    deleteTripCost: (payload: { tripId: string; category: string }) =>
      ipcRenderer.invoke("db:deleteTripCost", payload),

    getTripAttachments: (payload: { tripId: string }) => ipcRenderer.invoke("db:getTripAttachments", payload),
    removeTripAttachment: (payload: { tripId: string; assetId: string }) => ipcRenderer.invoke("db:removeTripAttachment", payload),
    setTripInlineAssets: (payload: { tripId: string; assetIds: string[] }) => ipcRenderer.invoke("db:setTripInlineAssets", payload),
    updateCitySummary: (payload: any) => ipcRenderer.invoke("db:updateCitySummary", payload),
    updateCityCover: (payload: any) => ipcRenderer.invoke("db:updateCityCover", payload),
    updateCityVisitState: (payload: {
      cityId: string;
      visitState: "unrecorded" | "wishlist" | "visited";
      provinceId?: string;
      provinceName?: string;
      cityName?: string;
    }) =>
      ipcRenderer.invoke("db:updateCityVisitState", payload),
    assignCityAssetToTrip: (payload: { cityId: string; assetId: string; tripId: string }) =>
      ipcRenderer.invoke("db:assignCityAssetToTrip", payload),

    getTags: (payload: { entityType: string; entityId: string }) => ipcRenderer.invoke("db:getTags", payload),
    addTag: (payload: { entityType: string; entityId: string; name: string }) => ipcRenderer.invoke("db:addTag", payload),
    removeTag: (payload: { entityType: string; entityId: string; name: string }) => ipcRenderer.invoke("db:removeTag", payload),
  },
  file: {
    select: () => ipcRenderer.invoke("file:select"),
    selectMultiple: (payload: { mode: "images" | "documents" | "all" }) => ipcRenderer.invoke("file:selectMultiple", payload),
    saveAsset: (sourcePath: string, destRelativeDir: string) =>
      ipcRenderer.invoke("file:saveAsset", { sourcePath, destRelativeDir }),
    saveCityAsset: (payload: { cityId: string; cityName: string; sourcePath: string }) =>
      ipcRenderer.invoke("file:saveCityAsset", payload),
    saveAssetBytes: (bytes: ArrayBuffer, originalFilename: string, mime: string, destRelativeDir: string) =>
      ipcRenderer.invoke("file:saveAssetBytes", { bytes, originalFilename, mime, destRelativeDir }),
    exportBackupZip: () => ipcRenderer.invoke("file:exportBackupZip"),
    importBackupZip: () => ipcRenderer.invoke("file:importBackupZip"),
    openLocal: (localPath: string) => ipcRenderer.invoke("file:openLocal", { localPath }),
    readLocalText: (localPath: string) => ipcRenderer.invoke("file:readLocalText", { localPath }),
  },
  cache: {
    readProvinceBoundaries: () => ipcRenderer.invoke("cache:readProvinceBoundaries"),
    writeProvinceBoundaries: (payload: any) =>
      ipcRenderer.invoke("cache:writeProvinceBoundaries", payload),
  },
  diagnostics: {
    exportRestoreDiagnostic: (payload?: { reason?: string }) => ipcRenderer.invoke("diagnostics:exportRestoreDiagnostic", payload),
    reveal: (relativePath: string) => ipcRenderer.invoke("diagnostics:reveal", { relativePath }),
  },
};

contextBridge.exposeInMainWorld("travelMap", api);
