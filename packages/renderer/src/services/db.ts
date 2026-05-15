function requireApi() {
  const api = (typeof window !== "undefined" ? (window as any)?.travelMap : undefined) as
    | { db: Record<string, (...args: any[]) => Promise<any>> }
    | undefined;
  if (!api?.db) {
    throw new Error("Electron IPC 桥未就绪，请使用 `pnpm dev:electron` 或 `pnpm run dev:electron:local` 启动应用");
  }
  return api;
}

export const db = {
  async getCity(cityId: string, provinceId: string, cityName: string, provinceName: string) {
    return await requireApi().db.getCity({ cityId, provinceId, cityName, provinceName });
  },

  async getCityAssets(cityId: string) {
    return await requireApi().db.getCityAssets({ cityId });
  },

  async updateCitySummary(cityId: string, summary: string) {
    return await requireApi().db.updateCitySummary({ cityId, summary });
  },

  async updateCityCover(cityId: string, assetId: string) {
    return await requireApi().db.updateCityCover({ cityId, assetId });
  },

  async updateCityVisitState(
    cityId: string,
    visitState: "unrecorded" | "wishlist" | "visited",
    identity?: {
      provinceId: string;
      provinceName: string;
      cityName: string;
    },
  ) {
    return await requireApi().db.updateCityVisitState({
      cityId,
      visitState,
      provinceId: identity?.provinceId,
      provinceName: identity?.provinceName,
      cityName: identity?.cityName,
    });
  },

  async assignCityAssetToTrip(cityId: string, assetId: string, tripId: string) {
    return await requireApi().db.assignCityAssetToTrip({ cityId, assetId, tripId });
  },

  async getTrips(cityId: string) {
    return await requireApi().db.getTrips({ cityId });
  },

  async getPois(cityId: string) {
    return await requireApi().db.getPois({ cityId });
  },

  async createPoi(poi: any) {
    return await requireApi().db.createPoi(poi);
  },

  async updatePoi(poi: any) {
    await requireApi().db.updatePoi(poi);
  },

  async deletePoi(poiId: string) {
    await requireApi().db.deletePoi({ poiId });
  },

  async createTrip(trip: any) {
    return await requireApi().db.createTrip(trip);
  },

  async updateTrip(trip: any) {
    await requireApi().db.updateTrip(trip);
  },

  async deleteTrip(tripId: string) {
    await requireApi().db.deleteTrip({ tripId });
  },

  async getTripCosts(tripId: string) {
    return await requireApi().db.getTripCosts({ tripId });
  },

  async updateTripCost(tripId: string, category: string, amount: number) {
    return await requireApi().db.updateTripCost({ tripId, category, amount });
  },

  async deleteTripCost(tripId: string, category: string) {
    return await requireApi().db.deleteTripCost({ tripId, category });
  },

  async getTripAttachments(tripId: string) {
    return await requireApi().db.getTripAttachments({ tripId });
  },

  async removeTripAttachment(tripId: string, assetId: string) {
    return await requireApi().db.removeTripAttachment({ tripId, assetId });
  },

  async setTripInlineAssets(tripId: string, assetIds: string[]) {
    return await requireApi().db.setTripInlineAssets({ tripId, assetIds });
  },
  
  async getTrip(tripId: string) {
    return await requireApi().db.getTrip({ tripId });
  },

  async addTag(entityType: string, entityId: string, name: string) {
    await requireApi().db.addTag({ entityType, entityId, name });
  },

  async getPoisForTrip(tripId: string) {
    return await requireApi().db.getPoisForTrip({ tripId });
  },

  async addPoiToTrip(tripId: string, poiId: string) {
    return await requireApi().db.addPoiToTrip({ tripId, poiId });
  },

  async removePoiFromTrip(tripId: string, poiId: string) {
    return await requireApi().db.removePoiFromTrip({ tripId, poiId });
  },

  async getTags(entityType: string, entityId: string) {
    const res = await requireApi().db.getTags({ entityType, entityId });
    return (res ?? []).map((r: any) => r.name);
  },

  async removeTag(entityType: string, entityId: string, name: string) {
    await requireApi().db.removeTag({ entityType, entityId, name });
  },

  async getPoi(poiId: string) {
    return await requireApi().db.getPoi({ poiId });
  },

  async getTripsForPoi(poiId: string) {
    return await requireApi().db.getTripsForPoi({ poiId });
  }
};
