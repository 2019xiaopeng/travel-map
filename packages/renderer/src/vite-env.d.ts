/// <reference types="vite/client" />

interface Window {
  travelMap: {
    isDev: boolean;
    app: {
      relaunch: () => Promise<{ ok?: boolean; error?: string }>;
    };
    db: {
      getCity: (payload: { cityId: string; provinceId: string; cityName: string; provinceName: string }) => Promise<any>;
      getCityAssets: (payload: { cityId: string }) => Promise<any>;
      getTrips: (payload: { cityId: string }) => Promise<any>;
      getTrip: (payload: { tripId: string }) => Promise<any>;
      createTrip: (payload: any) => Promise<string>;
      updateTrip: (payload: any) => Promise<any>;
      deleteTrip: (payload: { tripId: string }) => Promise<any>;

      getPois: (payload: { cityId: string }) => Promise<any>;
      getPoi: (payload: { poiId: string }) => Promise<any>;
      createPoi: (payload: any) => Promise<string>;
      updatePoi: (payload: any) => Promise<any>;
      deletePoi: (payload: { poiId: string }) => Promise<any>;

      getPoisForTrip: (payload: { tripId: string }) => Promise<any>;
      addPoiToTrip: (payload: { tripId: string; poiId: string }) => Promise<any>;
      removePoiFromTrip: (payload: { tripId: string; poiId: string }) => Promise<any>;
      getTripsForPoi: (payload: { poiId: string }) => Promise<any>;

      getTripCosts: (payload: { tripId: string }) => Promise<any>;
      updateTripCost: (payload: { tripId: string; category: string; amount: number }) => Promise<number>;
      deleteTripCost: (payload: { tripId: string; category: string }) => Promise<number>;
      getTripAttachments: (payload: { tripId: string }) => Promise<any>;
      removeTripAttachment: (payload: { tripId: string; assetId: string }) => Promise<any>;
      setTripInlineAssets: (payload: { tripId: string; assetIds: string[] }) => Promise<any>;
      updateCitySummary: (payload: { cityId: string; summary: string }) => Promise<void>;
      updateCityCover: (payload: { cityId: string; assetId: string }) => Promise<void>;
      updateCityVisitState: (payload: { cityId: string; visitState: "unrecorded" | "wishlist" | "visited" }) => Promise<{ ok: true }>;
      assignCityAssetToTrip: (payload: { cityId: string; assetId: string; tripId: string }) => Promise<{ ok: true }>;
      getTags: (payload: { entityType: string; entityId: string }) => Promise<Array<{ name: string }>>;
      addTag: (payload: { entityType: string; entityId: string; name: string }) => Promise<any>;
      removeTag: (payload: { entityType: string; entityId: string; name: string }) => Promise<any>;
    };
    file: {
      select: () => Promise<string | null>;
      saveAsset: (sourcePath: string, destRelativeDir: string) => Promise<{ assetId?: string; localUrl?: string; error?: string }>;
      saveCityAsset: (payload: { cityId: string; cityName: string; sourcePath: string }) => Promise<{ assetId?: string; localUrl?: string; error?: string }>;
      saveAssetBytes: (bytes: ArrayBuffer, originalFilename: string, mime: string, destRelativeDir: string) => Promise<{ assetId?: string; localUrl?: string; error?: string }>;
      exportBackupZip: () => Promise<{ ok?: boolean; path?: string; canceled?: boolean; error?: string; warnings?: Array<{ type: string; asset_id?: string; message: string }> }>;
      importBackupZip: () => Promise<{ ok?: boolean; stagingPath?: string; needsRestart?: boolean; canceled?: boolean; error?: string; warnings?: Array<{ type: string; asset_id?: string; message: string }> }>;
      openLocal: (localPath: string) => Promise<{ ok?: boolean; error?: string }>;
      readLocalText: (localPath: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
    };
    cache: {
      readProvinceBoundaries: () => Promise<any>;
      writeProvinceBoundaries: (payload: any) => Promise<{ ok?: boolean; error?: string }>;
    };
    diagnostics: {
      exportRestoreDiagnostic: (payload?: { reason?: string }) => Promise<{ ok?: boolean; relativePath?: string; error?: string }>;
      reveal: (relativePath: string) => Promise<{ ok?: boolean; error?: string }>;
    };
  };
}
