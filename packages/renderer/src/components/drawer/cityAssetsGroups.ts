import type { CityAsset } from "../../types";

export interface CityAssetTripGroup {
  tripId: string;
  tripTitle: string;
  items: CityAsset[];
}

export function groupCityAssets(items: CityAsset[]) {
  const unclassified: CityAsset[] = [];
  const tripGroups = new Map<string, CityAssetTripGroup>();

  for (const item of items) {
    if (item.source_kind === "city_inbox" || !item.trip_id) {
      unclassified.push(item);
      continue;
    }

    const existing = tripGroups.get(item.trip_id);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    tripGroups.set(item.trip_id, {
      tripId: item.trip_id,
      tripTitle: item.trip_title ?? "未命名旅行",
      items: [item],
    });
  }

  return {
    unclassified,
    tripGroups: Array.from(tripGroups.values()),
  };
}
