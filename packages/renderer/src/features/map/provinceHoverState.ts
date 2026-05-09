export interface ProvinceHoverState {
  provinceId: string;
  provinceName: string;
  x: number;
  y: number;
}

export function nextProvinceHoverState(
  _previous: ProvinceHoverState | null,
  next: ProvinceHoverState,
) {
  return next;
}

export function clearProvinceHover(
  _previous: ProvinceHoverState | null,
) {
  return null;
}
