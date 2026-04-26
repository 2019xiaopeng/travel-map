import { useEffect, useState } from "react";
import { db } from "../../services/db";

interface TripListProps {
  cityId: string;
  onSelectTrip: (tripId: string) => void;
}

export function TripList({ cityId, onSelectTrip }: TripListProps) {
  const [trips, setTrips] = useState<any[]>([]);

  const loadTrips = async () => {
    const res = await db.getTrips(cityId);
    setTrips(res);
  };

  useEffect(() => {
    loadTrips();
  }, [cityId]);

  const handleCreate = async () => {
    const newTripId = await db.createTrip({ city_id: cityId });
    onSelectTrip(newTripId);
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-400">旅行记录</h3>
        <button
          onClick={handleCreate}
          className="text-xs text-[var(--color-accent)] hover:text-white"
        >
          + 新建
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="text-sm text-neutral-500 py-10 text-center">
          暂无旅行记录
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => (
            <button
              key={trip.trip_id}
              onClick={() => onSelectTrip(trip.trip_id)}
              className="
                w-full rounded-lg border border-[var(--color-border)]
                bg-[var(--color-surface-elevated)]/40 p-4 text-left
                transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-elevated)]
              "
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{trip.title}</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                  {trip.date_end ? "已完成" : "计划中"}
                </span>
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {trip.date_start} {trip.date_end && `~ ${trip.date_end}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
