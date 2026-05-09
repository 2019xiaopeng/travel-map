export interface ProvinceCameraBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface ProvinceCameraInput {
  provinceId?: string;
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

const CAMERA_PROFILE_BY_PROVINCE: Record<
  string,
  {
    zoomBias: number;
    maxZoom?: number;
  }
> = {
  "230000": { zoomBias: 0.08, maxZoom: 8.7 },
  "150000": { zoomBias: 0.06, maxZoom: 8.6 },
  "650000": { zoomBias: 0.06, maxZoom: 8.6 },
  "540000": { zoomBias: 0.04, maxZoom: 8.5 },
  "460000": { zoomBias: 0.1, maxZoom: 8.9 },
  "710000": { zoomBias: 0.04, maxZoom: 9.0 },
};

export function getProvinceCameraTarget(input: ProvinceCameraInput) {
  const edgePadding = input.edgePadding ?? 24;
  const minZoom = input.minZoom ?? 4.5;
  const profile = input.provinceId
    ? CAMERA_PROFILE_BY_PROVINCE[input.provinceId] ?? { zoomBias: 0.2 }
    : { zoomBias: 0.2 };
  const maxZoom = profile.maxZoom ?? input.maxZoom ?? 8.8;
  const availableWidth = Math.max(input.viewport.width - edgePadding * 2, 320);
  const availableHeight = Math.max(input.viewport.height - edgePadding * 2, 240);
  const lngSpan = Math.max(input.bounds.maxLng - input.bounds.minLng, 0.01);
  const latSpan = Math.max(input.bounds.maxLat - input.bounds.minLat, 0.01);
  const horizontalZoom = Math.log2((360 * availableWidth) / (lngSpan * 256));
  const verticalZoom = Math.log2((180 * availableHeight) / (latSpan * 256));
  const desiredZoom = Math.min(horizontalZoom, verticalZoom) + profile.zoomBias;
  const zoom = Math.max(
    minZoom,
    Math.min(desiredZoom, maxZoom),
  );

  return {
    center: input.visualCenter,
    zoom: Number(zoom.toFixed(2)),
  };
}
