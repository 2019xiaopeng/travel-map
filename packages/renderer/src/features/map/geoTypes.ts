export interface GeoFeatureProperties {
  id: string;
  name: string;
  center: [number, number];
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
