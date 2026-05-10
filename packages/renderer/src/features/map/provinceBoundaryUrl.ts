const GEOJSON_CN_VERSION = "1.6.3";
const GEOJSON_CN_TOPO_PROVINCES = new Set(["710000", "810000", "820000"]);

export function buildCountryBoundaryUrl() {
  return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/china.topo.json`;
}

export function buildProvinceBoundaryUrl(provinceAdcode: string) {
  if (GEOJSON_CN_TOPO_PROVINCES.has(provinceAdcode)) {
    return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/${provinceAdcode}.topo.json`;
  }

  return `https://geojson.cn/api/tiandi/100000/${provinceAdcode}.json`;
}
