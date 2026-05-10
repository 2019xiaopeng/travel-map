export type ProvinceLayerMode = "country" | "overlay";

export function getProvinceLayerModeConfig(mode: ProvinceLayerMode) {
  if (mode === "overlay") {
    return {
      fitView: false,
      zIndex: 45,
      outlineZIndex: 58,
      fillOpacity: 0.012,
      activeFillOpacity: 0.045,
      strokeWeight: 1.3,
      activeStrokeWeight: 2.1,
      outlineStrokeWeight: 1.15,
    };
  }

  return {
    fitView: true,
    zIndex: 60,
    outlineZIndex: 95,
    fillOpacity: 0.035,
    activeFillOpacity: 0.08,
    strokeWeight: 2.2,
    activeStrokeWeight: 3.2,
    outlineStrokeWeight: 1.8,
  };
}
