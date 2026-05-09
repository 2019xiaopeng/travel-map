const GEOJSON_CN_VERSION = "1.6.3";

export function buildCountryBoundaryUrl() {
  return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/china.topo.json`;
}

export function buildProvinceBoundaryUrl(provinceAdcode: string) {
  if (provinceAdcode === "710000") {
    return `https://geojson.cn/api/china/${GEOJSON_CN_VERSION}/710000.topo.json`;
  }

  return `https://geojson.cn/api/tiandi/100000/${provinceAdcode}.json`;
}
