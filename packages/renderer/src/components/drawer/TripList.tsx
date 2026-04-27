import { useEffect, useState } from "react";
import { db } from "../../services/db";
import { Trip } from "../../types";

interface TripListProps {
  cityId: string;
  onSelectTrip: (tripId: string) => void;
}

export function TripList({ cityId, onSelectTrip }: TripListProps) {
  const [trips, setTrips] = useState<Trip[]>([]);

  const loadTrips = async () => {
    try {
      const res = await db.getTrips(cityId);
      setTrips(res);
    } catch (err) {
      console.error("Failed to load trips:", err);
    }
  };

  useEffect(() => {
    loadTrips();
  }, [cityId]);

  const handleCreate = async () => {
    try {
      const newTripId = await db.createTrip({ city_id: cityId });
      onSelectTrip(newTripId);
    } catch (err) {
      console.error("Failed to create trip:", err);
    }
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
        <div className="text-sm text-neutral-500 flex flex-col items-center justify-center h-32 border border-dashed border-[var(--color-border)] rounded-lg">
          <span className="mb-2 text-2xl">🌍</span>
          <span>暂无旅行记录，点击右上角新建</span>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li
              key={trip.trip_id}
              onClick={() => onSelectTrip(trip.trip_id)}
              className="group cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 transition-colors hover:border-[var(--color-accent)]"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-white group-hover:text-[var(--color-accent)] transition-colors">{trip.title}</h4>
                <span className="text-[10px] text-neutral-500 bg-[var(--color-surface)] px-1.5 py-0.5 rounded">
                  {trip.date_start}
                </span>
              </div>
              <div className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                {trip.content?.replace(/<[^>]*>?/gm, '') || "暂无正文..."}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
