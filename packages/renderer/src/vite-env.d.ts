/// <reference types="vite/client" />

interface Window {
  travelMap: {
    isDev: boolean;
    db: {
      getCity: (payload: { cityId: string; provinceId: string; cityName: string; provinceName: string }) => Promise<any>;
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
      getTags: (payload: { entityType: string; entityId: string }) => Promise<Array<{ name: string }>>;
      addTag: (payload: { entityType: string; entityId: string; name: string }) => Promise<any>;
      removeTag: (payload: { entityType: string; entityId: string; name: string }) => Promise<any>;
    };
    file: {
      select: () => Promise<string | null>;
      saveAsset: (sourcePath: string, destRelativeDir: string) => Promise<{ assetId?: string; localUrl?: string; error?: string }>;
      saveAssetBytes: (bytes: ArrayBuffer, originalFilename: string, mime: string, destRelativeDir: string) => Promise<{ assetId?: string; localUrl?: string; error?: string }>;
      openLocal: (localPath: string) => Promise<{ ok?: boolean; error?: string }>;
    };
  };
}
