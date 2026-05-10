export interface Province {
  province_id: string;
  name: string;
}

export interface City {
  city_id: string;
  province_id: string;
  name: string;
  visit_state?: "unrecorded" | "wishlist" | "visited";
  summary?: string;
  cover_asset_id?: string;
  cover_path?: string;
  cover_remote?: string;
  tripCount?: number;
  poiCount?: number;
  totalCost?: number;
}

export interface Trip {
  trip_id: string;
  city_id: string;
  title: string;
  date_start?: string;
  date_end?: string;
  companions?: string;
  route?: string;
  cost_total?: number;
  cover_asset_id?: string | null;
  cover_path?: string;
  cover_remote?: string;
  content?: string;
  created_at: number;
  updated_at: number;
}

export interface POI {
  poi_id: string;
  city_id: string;
  name: string;
  lng: number;
  lat: number;
  gcj02_lng: number;
  gcj02_lat: number;
  category?: string;
  summary?: string;
  created_at: number;
  updated_at: number;
}

export interface Asset {
  asset_id: string;
  type: string;
  original_filename: string;
  mime: string;
  size: number;
  sha256: string;
  local_path: string;
  remote_url?: string;
  created_at: number;
}

export interface CityAsset extends Asset {
  trip_id: string | null;
  trip_title: string | null;
  source_kind: "city_inbox" | "attachment" | "inline";
}

export interface TripCost {
  trip_id: string;
  category: string;
  amount: number;
}

export interface Tag {
  entity_type: string;
  entity_id: string;
  name: string;
}
