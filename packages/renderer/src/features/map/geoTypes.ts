export interface GeoFeatureProperties {
  id: string;
  name: string;
  center: [number, number];
  fullname?: string;
  labelAnchor?: [number, number];
  visualCenter?: [number, number];
  bounds?: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
  sourceVersion?: string;
}

export interface GeoFeature {
  type: "Feature";
  properties: GeoFeatureProperties;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}
