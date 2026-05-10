import type { City } from "../../types";

export type CityHomeViewState = "loading" | "error" | "empty" | "ready";

export function deriveCityHomeState(input: {
  loading: boolean;
  error: string | null;
  city: City | null;
}): CityHomeViewState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (!input.city) return "loading";

  const city = input.city;
  const hasContent =
    Boolean(city.summary?.trim()) ||
    Boolean(city.cover_path) ||
    Boolean(city.cover_remote) ||
    Number(city.tripCount ?? 0) > 0 ||
    Number(city.poiCount ?? 0) > 0;

  return hasContent ? "ready" : "empty";
}
