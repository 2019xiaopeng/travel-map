export type ProvinceLayerMode = "country" | "overlay";

const HOVER_CLEAR_DELAY_MS = 90;

export function getProvinceLayerModeConfig(mode: ProvinceLayerMode) {
  if (mode === "overlay") {
    return {
      fitView: false,
      zIndex: 45,
      outlineZIndex: 36,
      fillOpacity: 0.012,
      activeFillOpacity: 0.045,
      strokeWeight: 1.3,
      activeStrokeWeight: 2.1,
      outlineStrokeWeight: 1.15,
      hoverClearDelayMs: HOVER_CLEAR_DELAY_MS,
    };
  }

  return {
    fitView: true,
    zIndex: 60,
    outlineZIndex: 52,
    fillOpacity: 0.035,
    activeFillOpacity: 0.08,
    strokeWeight: 2.2,
    activeStrokeWeight: 3.2,
    outlineStrokeWeight: 1.8,
    hoverClearDelayMs: HOVER_CLEAR_DELAY_MS,
  };
}
