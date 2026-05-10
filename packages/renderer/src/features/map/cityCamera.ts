import { DRAWER_WIDTH } from "./mapLayout.js";
import type { ProvinceCameraBounds } from "./provinceCamera.ts";

export interface CityCameraInput {
  bounds: ProvinceCameraBounds;
  visualCenter: [number, number];
  viewport: {
    width: number;
    height: number;
  };
  drawerOpen: boolean;
  minZoom?: number;
  maxZoom?: number;
}

export function getCityCameraTarget(input: CityCameraInput) {
  const leftPadding = 80;
  const rightPadding = input.drawerOpen ? DRAWER_WIDTH + 96 : 96;
  const topPadding = 112;
  const bottomPadding = 88;
  const availableWidth = Math.max(
    input.viewport.width - leftPadding - rightPadding,
    320,
  );
  const availableHeight = Math.max(
    input.viewport.height - topPadding - bottomPadding,
    240,
  );
  const lngSpan = Math.max(input.bounds.maxLng - input.bounds.minLng, 0.01);
  const latSpan = Math.max(input.bounds.maxLat - input.bounds.minLat, 0.01);
  const horizontalZoom = Math.log2((360 * availableWidth) / (lngSpan * 256));
  const verticalZoom = Math.log2((180 * availableHeight) / (latSpan * 256));
  const zoom = Math.max(
    input.minZoom ?? 6.4,
    Math.min(Math.min(horizontalZoom, verticalZoom) + 0.18, input.maxZoom ?? 11.2),
  );
  const drawerRatio = input.drawerOpen
    ? DRAWER_WIDTH / Math.max(input.viewport.width, 1)
    : 0;
  const centerLngOffset = lngSpan * (0.18 + drawerRatio * 0.35);

  return {
    center: [
      Number((input.visualCenter[0] - centerLngOffset).toFixed(6)),
      input.visualCenter[1],
    ] as [number, number],
    zoom: Number(zoom.toFixed(2)),
  };
}
