export const db = {
  async getCity(cityId: string, provinceId: string, cityName: string, provinceName: string) {
    // Ensure province exists
    await window.travelMap.db.run(
      `INSERT INTO Province (province_id, name) VALUES (?, ?) ON CONFLICT(province_id) DO UPDATE SET name=excluded.name`,
      [provinceId, provinceName]
    );

    // Ensure city exists
    await window.travelMap.db.run(
      `INSERT INTO City (city_id, province_id, name) VALUES (?, ?, ?) ON CONFLICT(city_id) DO UPDATE SET name=excluded.name`,
      [cityId, provinceId, cityName]
    );

    // Query city stats
    const city = await window.travelMap.db.get(`SELECT * FROM City WHERE city_id = ?`, [cityId]);
    const trips = await window.travelMap.db.get(`SELECT COUNT(*) as count, SUM(cost_total) as totalCost FROM Trip WHERE city_id = ?`, [cityId]);
    const pois = await window.travelMap.db.get(`SELECT COUNT(*) as count FROM POI WHERE city_id = ?`, [cityId]);

    return {
      ...city,
      tripCount: trips?.count || 0,
      totalCost: trips?.totalCost || 0,
      poiCount: pois?.count || 0,
    };
  },

  async getTrips(cityId: string) {
    return await window.travelMap.db.query(`SELECT * FROM Trip WHERE city_id = ? ORDER BY date_start DESC`, [cityId]);
  },

  async getPois(cityId: string) {
    return await window.travelMap.db.query(`SELECT * FROM POI WHERE city_id = ?`, [cityId]);
  },

  async createPoi(poi: any) {
    const poiId = crypto.randomUUID();
    const now = Date.now();
    await window.travelMap.db.run(
      `INSERT INTO POI (poi_id, city_id, name, lng, lat, gcj02_lng, gcj02_lat, category, summary, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [poiId, poi.city_id, poi.name, poi.lng, poi.lat, poi.gcj02_lng, poi.gcj02_lat, poi.category || 'other', poi.summary || '', now, now]
    );
    return poiId;
  },

  async updatePoi(poi: any) {
    const now = Date.now();
    await window.travelMap.db.run(
      `UPDATE POI SET name=?, lng=?, lat=?, gcj02_lng=?, gcj02_lat=?, category=?, summary=?, updated_at=? WHERE poi_id=?`,
      [poi.name, poi.lng, poi.lat, poi.gcj02_lng, poi.gcj02_lat, poi.category, poi.summary, now, poi.poi_id]
    );
  },

  async deletePoi(poiId: string) {
    await window.travelMap.db.run(`DELETE FROM POI WHERE poi_id = ?`, [poiId]);
  },

  async createTrip(trip: any) {
    const tripId = crypto.randomUUID();
    const now = Date.now();
    await window.travelMap.db.run(
      `INSERT INTO Trip (trip_id, city_id, title, date_start, date_end, companions, route, cost_total, cover_asset_id, content, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tripId, trip.city_id, trip.title || '新旅行', trip.date_start || '', trip.date_end || '', trip.companions || '[]', trip.route || '', trip.cost_total || 0, trip.cover_asset_id || null, trip.content || '', now, now]
    );
    return tripId;
  },

  async updateTrip(trip: any) {
    const now = Date.now();
    await window.travelMap.db.run(
      `UPDATE Trip SET title=?, date_start=?, date_end=?, companions=?, route=?, cost_total=?, cover_asset_id=?, content=?, updated_at=? WHERE trip_id=?`,
      [trip.title, trip.date_start, trip.date_end, trip.companions, trip.route, trip.cost_total, trip.cover_asset_id, trip.content, now, trip.trip_id]
    );
  },

  async deleteTrip(tripId: string) {
    await window.travelMap.db.run(`DELETE FROM Trip WHERE trip_id = ?`, [tripId]);
  },
  
  async getTrip(tripId: string) {
    return await window.travelMap.db.get(`SELECT * FROM Trip WHERE trip_id = ?`, [tripId]);
  }
};
