import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://geojson.cn/api/china/1.6.3/china.topo.json";
const OUTPUT_PATH = path.resolve(
  "packages/renderer/public/geo/province-boundaries.generated.json",
);

const SPECIAL_LABEL_ANCHORS = new Map([
  ["230000", [127.8, 47.2]],
  ["150000", [111.8, 43.5]],
  ["650000", [85.5, 41.8]],
  ["540000", [88.8, 31.2]],
  ["460000", [109.8, 19.2]],
  ["710000", [121.0, 23.7]],
]);

function decodeArc(topology, arc) {
  let x = 0;
  let y = 0;

  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    const [scaleX, scaleY] = topology.transform.scale;
    const [translateX, translateY] = topology.transform.translate;
    return [x * scaleX + translateX, y * scaleY + translateY];
  });
}

function resolveArc(topology, arcIndex) {
  const sourceArc = topology.arcs[arcIndex >= 0 ? arcIndex : ~arcIndex];
  const decoded = decodeArc(topology, sourceArc);
  return arcIndex >= 0 ? decoded : decoded.slice().reverse();
}

function joinArcRefs(topology, refs) {
  return refs.flatMap((arcRef, index) => {
    const points = resolveArc(topology, arcRef);
    return index === 0 ? points : points.slice(1);
  });
}

function topologyGeometryToGeoJson(topology, geometry) {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.arcs.map((ringRefs) => joinArcRefs(topology, ringRefs)),
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: geometry.arcs.map((polygonRefs) =>
      polygonRefs.map((ringRefs) => joinArcRefs(topology, ringRefs)),
    ),
  };
}

function geometryPoints(geometry) {
  return (geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat()
  ).flat();
}

function geometryBounds(geometry) {
  const points = geometryPoints(geometry);
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);

  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

function resolveGeometryCollection(topology) {
  const objectKey = Object.keys(topology.objects).find((key) => {
    const value = topology.objects[key];
    return value?.type === "GeometryCollection";
  });

  if (!objectKey) {
    throw new Error("No GeometryCollection found in topology.objects");
  }

  return topology.objects[objectKey];
}

function normalizeProvinceRecord(rawRecord) {
  const labelAnchor =
    SPECIAL_LABEL_ANCHORS.get(rawRecord.id) ?? rawRecord.center;

  return {
    ...rawRecord,
    bounds: geometryBounds(rawRecord.geometry),
    visualCenter: rawRecord.center,
    labelAnchor,
    sourceVersion: "geojson.cn@1.6.3",
  };
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`);
  }

  const topology = await response.json();
  const collection = resolveGeometryCollection(topology);

  const provinces = collection.geometries
    .filter((geometry) => geometry?.properties?.level === 1)
    .filter((geometry) => geometry?.properties?.code)
    .map((geometry) =>
      normalizeProvinceRecord({
        id: String(geometry.properties.code),
        name: String(geometry.properties.name),
        fullname: String(geometry.properties.fullname ?? geometry.properties.name),
        center: geometry.properties.center,
        geometry: topologyGeometryToGeoJson(topology, geometry),
      }),
    );

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(provinces, null, 2), "utf8");
  console.log(`generated ${provinces.length} provinces`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
