export const db = {
  async getCity(cityId: string, provinceId: string, cityName: string, provinceName: string) {
    return await window.travelMap.db.getCity({ cityId, provinceId, cityName, provinceName });
  },

  async getTrips(cityId: string) {
    return await window.travelMap.db.getTrips({ cityId });
  },

  async getPois(cityId: string) {
    return await window.travelMap.db.getPois({ cityId });
  },

  async createPoi(poi: any) {
    return await window.travelMap.db.createPoi(poi);
  },

  async updatePoi(poi: any) {
    await window.travelMap.db.updatePoi(poi);
  },

  async deletePoi(poiId: string) {
    await window.travelMap.db.deletePoi({ poiId });
  },

  async createTrip(trip: any) {
    return await window.travelMap.db.createTrip(trip);
  },

  async updateTrip(trip: any) {
    await window.travelMap.db.updateTrip(trip);
  },

  async deleteTrip(tripId: string) {
    await window.travelMap.db.deleteTrip({ tripId });
  },

  async getTripCosts(tripId: string) {
    return await window.travelMap.db.getTripCosts({ tripId });
  },

  async updateTripCost(tripId: string, category: string, amount: number) {
    return await window.travelMap.db.updateTripCost({ tripId, category, amount });
  },

  async deleteTripCost(tripId: string, category: string) {
    return await window.travelMap.db.deleteTripCost({ tripId, category });
  },

  async getTripAttachments(tripId: string) {
    return await window.travelMap.db.getTripAttachments({ tripId });
  },
  
  async getTrip(tripId: string) {
    return await window.travelMap.db.getTrip({ tripId });
  },

  async addTag(entityType: string, entityId: string, name: string) {
    await window.travelMap.db.addTag({ entityType, entityId, name });
  },

  async getPoisForTrip(tripId: string) {
    return await window.travelMap.db.getPoisForTrip({ tripId });
  },

  async getTags(entityType: string, entityId: string) {
    const res = await window.travelMap.db.getTags({ entityType, entityId });
    return (res ?? []).map((r: any) => r.name);
  },

  async removeTag(entityType: string, entityId: string, name: string) {
    await window.travelMap.db.removeTag({ entityType, entityId, name });
  },

  async getPoi(poiId: string) {
    return await window.travelMap.db.getPoi({ poiId });
  },

  async getTripsForPoi(poiId: string) {
    return await window.travelMap.db.getTripsForPoi({ poiId });
  }
};
