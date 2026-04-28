import { contextBridge, ipcRenderer } from "electron";
import { is } from "@electron-toolkit/utils";

const api = {
  isDev: is.dev,
  db: {
    getCity: (payload: { cityId: string; provinceId: string; cityName: string; provinceName: string }) =>
      ipcRenderer.invoke("db:getCity", payload),
    getTrips: (payload: { cityId: string }) => ipcRenderer.invoke("db:getTrips", payload),
    getTrip: (payload: { tripId: string }) => ipcRenderer.invoke("db:getTrip", payload),
    createTrip: (payload: { city_id: string; title?: string; date_start?: string; date_end?: string; companions?: string; route?: string; cost_total?: number; cover_asset_id?: string | null; content?: string }) =>
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

    getTags: (payload: { entityType: string; entityId: string }) => ipcRenderer.invoke("db:getTags", payload),
    addTag: (payload: { entityType: string; entityId: string; name: string }) => ipcRenderer.invoke("db:addTag", payload),
    removeTag: (payload: { entityType: string; entityId: string; name: string }) => ipcRenderer.invoke("db:removeTag", payload),
  },
  file: {
    select: () => ipcRenderer.invoke("file:select"),
    saveAsset: (sourcePath: string, destRelativeDir: string) =>
      ipcRenderer.invoke("file:saveAsset", { sourcePath, destRelativeDir }),
    openLocal: (localPath: string) => ipcRenderer.invoke("file:openLocal", { localPath }),
  }
};

contextBridge.exposeInMainWorld("travelMap", api);
