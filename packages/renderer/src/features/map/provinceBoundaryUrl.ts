const GEOJSON_CN_VERSION = "1.6.3";

export function buildCountryBoundaryUrl() {
  return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/china.topo.json`;
}

export function buildProvinceBoundaryUrl(provinceAdcode: string) {
  return `https://geojson.cn/api/${provinceAdcode}/${GEOJSON_CN_VERSION}/${provinceAdcode}.json`;
}
