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
    const city = await window.travelMap.db.get(`
      SELECT City.*, Asset.local_path as cover_path, Asset.remote_url as cover_remote 
      FROM City 
      LEFT JOIN Asset ON City.cover_asset_id = Asset.asset_id 
      WHERE City.city_id = ?
    `, [cityId]);
    
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
    return await window.travelMap.db.query(`
      SELECT Trip.*, Asset.local_path as cover_path, Asset.remote_url as cover_remote 
      FROM Trip 
      LEFT JOIN Asset ON Trip.cover_asset_id = Asset.asset_id 
      WHERE Trip.city_id = ? 
      ORDER BY Trip.date_start DESC
    `, [cityId]);
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

  async getTripCosts(tripId: string) {
    return await window.travelMap.db.query(`SELECT * FROM CostBreakdown WHERE trip_id = ?`, [tripId]);
  },

  async updateTripCost(tripId: string, category: string, amount: number) {
    await window.travelMap.db.run(`
      INSERT INTO CostBreakdown (trip_id, category, amount)
      VALUES (?, ?, ?)
      ON CONFLICT(trip_id, category) DO UPDATE SET amount=excluded.amount
    `, [tripId, category, amount]);

    // Recalculate total cost
    const res = await window.travelMap.db.get(`SELECT SUM(amount) as total FROM CostBreakdown WHERE trip_id = ?`, [tripId]);
    const total = res?.total || 0;
    await window.travelMap.db.run(`UPDATE Trip SET cost_total = ? WHERE trip_id = ?`, [total, tripId]);
    return total;
  },

  async deleteTripCost(tripId: string, category: string) {
    await window.travelMap.db.run(`DELETE FROM CostBreakdown WHERE trip_id = ? AND category = ?`, [tripId, category]);
    
    // Recalculate total cost
    const res = await window.travelMap.db.get(`SELECT SUM(amount) as total FROM CostBreakdown WHERE trip_id = ?`, [tripId]);
    const total = res?.total || 0;
    await window.travelMap.db.run(`UPDATE Trip SET cost_total = ? WHERE trip_id = ?`, [total, tripId]);
    return total;
  },

  async getTripAttachments(tripId: string) {
    return await window.travelMap.db.query(`
      SELECT a.* FROM Asset a
      JOIN Tag t ON t.name = a.asset_id
      WHERE t.entity_type = 'trip_attachment' AND t.entity_id = ?
    `, [tripId]);
  },
  
  async getTrip(tripId: string) {
    return await window.travelMap.db.get(`
      SELECT Trip.*, Asset.local_path as cover_path, Asset.remote_url as cover_remote 
      FROM Trip 
      LEFT JOIN Asset ON Trip.cover_asset_id = Asset.asset_id 
      WHERE Trip.trip_id = ?
    `, [tripId]);
  },

  async addTag(entityType: string, entityId: string, name: string) {
    await window.travelMap.db.run(`INSERT OR IGNORE INTO Tag (entity_type, entity_id, name) VALUES (?, ?, ?)`, [entityType, entityId, name]);
  },

  async getPoisForTrip(tripId: string) {
    return await window.travelMap.db.query(`
      SELECT p.*, tp.sort_order
      FROM POI p
      JOIN Trip_POI tp ON p.poi_id = tp.poi_id
      WHERE tp.trip_id = ?
      ORDER BY tp.sort_order ASC
    `, [tripId]);
  },

  async getTags(entityType: string, entityId: string) {
    const res = await window.travelMap.db.query(`SELECT name FROM Tag WHERE entity_type = ? AND entity_id = ?`, [entityType, entityId]);
    return res.map((r: any) => r.name);
  },

  async removeTag(entityType: string, entityId: string, name: string) {
    await window.travelMap.db.run(`DELETE FROM Tag WHERE entity_type = ? AND entity_id = ? AND name = ?`, [entityType, entityId, name]);
  },

  async getPoi(poiId: string) {
    return await window.travelMap.db.get(`SELECT * FROM POI WHERE poi_id = ?`, [poiId]);
  },

  async getTripsForPoi(poiId: string) {
    return await window.travelMap.db.query(`
      SELECT t.* 
      FROM Trip t
      JOIN Trip_POI tp ON t.trip_id = tp.trip_id
      WHERE tp.poi_id = ?
    `, [poiId]);
  }
};
