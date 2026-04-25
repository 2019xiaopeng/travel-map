// --- Province & City ---
export interface Province {
  id: string;
  name: string;
  center: [number, number];
}

export interface City {
  id: string;
  name: string;
  provinceId: string;
  center: [number, number];
  boundaryGeoJson?: string;
  coverAssetId?: string;
  description?: string;
}

// --- Trip ---
export type TripStatus = "planned" | "ongoing" | "completed";

export interface Trip {
  id: string;
  cityId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  summary?: string;
  content?: string;
  totalCost?: number;
  createdAt: string;
  updatedAt: string;
}

// --- POI ---
export type POICategory =
  | "scenic"
  | "food"
  | "hotel"
  | "photo_spot"
  | "transport"
  | "shopping"
  | "other";

export interface POI {
  id: string;
  cityId: string;
  name: string;
  category: POICategory;
  lng: number;
  lat: number;
  address?: string;
  description?: string;
  tripId?: string;
  coverAssetId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Tag ---
export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface Taggable {
  tagId: string;
  targetType: "trip" | "poi" | "city";
  targetId: string;
}

// --- Asset ---
export type AssetType = "image" | "pdf" | "doc" | "md" | "link" | "other";

export interface Asset {
  id: string;
  type: AssetType;
  originalFilename: string;
  mime: string;
  size: number;
  sha256: string;
  localPath: string;
  remoteUrl?: string;
  targetType: "trip" | "poi" | "city";
  targetId: string;
  createdAt: string;
}

// --- Cost ---
export interface CostItem {
  id: string;
  tripId: string;
  category: string;
  amount: number;
  currency: string;
  note?: string;
  date?: string;
}

// --- Map ---
export type MapLevel = "country" | "province" | "city";

export interface MapViewState {
  level: MapLevel;
  provinceId?: string;
  cityId?: string;
  center: [number, number];
  zoom: number;
}
