export interface ProvinceCameraBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface ProvinceCameraInput {
  bounds: ProvinceCameraBounds;
  visualCenter: [number, number];
  viewport: {
    width: number;
    height: number;
  };
  edgePadding?: number;
  minZoom?: number;
  maxZoom?: number;
}

export function getProvinceCameraTarget(input: ProvinceCameraInput) {
  const edgePadding = input.edgePadding ?? 24;
  const minZoom = input.minZoom ?? 4.5;
  const maxZoom = input.maxZoom ?? 8.8;
  const availableWidth = Math.max(input.viewport.width - edgePadding * 2, 320);
  const availableHeight = Math.max(input.viewport.height - edgePadding * 2, 240);
  const lngSpan = Math.max(input.bounds.maxLng - input.bounds.minLng, 0.01);
  const latSpan = Math.max(input.bounds.maxLat - input.bounds.minLat, 0.01);
  const horizontalZoom = Math.log2((360 * availableWidth) / (lngSpan * 256));
  const verticalZoom = Math.log2((180 * availableHeight) / (latSpan * 256));
  const zoom = Math.max(
    minZoom,
    Math.min(Math.min(horizontalZoom, verticalZoom), maxZoom),
  );

  return {
    center: input.visualCenter,
    zoom: Number(zoom.toFixed(2)),
  };
}
