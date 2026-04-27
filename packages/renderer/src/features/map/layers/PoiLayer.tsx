import { useEffect, useRef } from "react";
import { db } from "../../../services/db";
import { useMapStore } from "../mapStore";

export function PoiLayer({ map, cityId }: { map: any; cityId: string | null }) {
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const selectedTripId = useMapStore(s => s.selectedTripId);

  useEffect(() => {
    if (!map || !cityId) return;

    let cancelled = false;

    const loadPois = async () => {
      const pois = await db.getPois(cityId);
      const tripPois = selectedTripId ? await db.getPoisForTrip(selectedTripId) : [];
      if (cancelled) return;

      const AMap = window.AMap;

      const markers = pois.map((poi: any) => {
        // Render custom content based on category
        const isRestaurant = poi.category?.includes('餐饮') || poi.category?.includes('美食');
        const isHotel = poi.category?.includes('住宿') || poi.category?.includes('酒店');
        const isAttraction = poi.category?.includes('景点') || poi.category?.includes('风景');
        
        let emoji = '📍';
        let bgColor = 'bg-blue-500';
        if (isRestaurant) { emoji = '🍽️'; bgColor = 'bg-orange-500'; }
        else if (isHotel) { emoji = '🏨'; bgColor = 'bg-purple-500'; }
        else if (isAttraction) { emoji = '📸'; bgColor = 'bg-emerald-500'; }

        // Check if poi is in trip
        const tripIndex = tripPois.findIndex((tp: any) => tp.poi_id === poi.poi_id);
        const inTrip = tripIndex !== -1;
        const tripBadge = inTrip 
          ? `<div class="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-white shadow-sm border border-white z-10">${tripIndex + 1}</div>` 
          : '';

        const content = `
          <div class="relative flex flex-col items-center group cursor-pointer transition-all duration-300 ${inTrip ? 'scale-110' : 'opacity-80 hover:opacity-100'}">
            ${tripBadge}
            <div class="flex h-8 w-8 items-center justify-center rounded-full ${bgColor} border-2 border-white shadow-md transition-transform group-hover:scale-110">
              <span class="text-sm">${emoji}</span>
            </div>
            <div class="mt-1 hidden whitespace-nowrap rounded bg-[var(--color-surface)]/90 px-2 py-0.5 text-[10px] text-white shadow-lg backdrop-blur-sm group-hover:block z-20 absolute top-8">
              ${poi.name}
            </div>
          </div>
        `;

        const marker = new AMap.Marker({
          position: [poi.gcj02_lng || poi.lng, poi.gcj02_lat || poi.lat],
          title: poi.name,
          content: content,
          offset: new AMap.Pixel(-16, -16),
          extData: poi,
          zIndex: inTrip ? 100 : 50
        });

        marker.on('click', () => {
          useMapStore.getState().selectPoi(poi.poi_id);
          map.panTo([poi.gcj02_lng || poi.lng, poi.gcj02_lat || poi.lat]);
        });

        return marker;
      });

      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = markers;
      map.add(markers);

      // Draw polyline for trip route
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }

      if (tripPois.length > 1) {
        const path = tripPois.map((p: any) => new AMap.LngLat(p.gcj02_lng || p.lng, p.gcj02_lat || p.lat));
        polylineRef.current = new AMap.Polyline({
          path: path,
          isOutline: true,
          outlineColor: '#ffffff',
          borderWeight: 2,
          strokeColor: '#3b82f6', // var(--color-accent) mostly
          strokeOpacity: 0.8,
          strokeWeight: 4,
          strokeStyle: 'dashed',
          strokeDasharray: [10, 5],
          lineJoin: 'round',
          lineCap: 'round',
          zIndex: 40
        });
        map.add(polylineRef.current);
        
        // Smoothly fit view to show the entire trip route
        if (selectedTripId) {
          map.setFitView([polylineRef.current], false, [60, 60, 60, 360]); // Left padding for drawer
        }
      } else if (tripPois.length === 1 && selectedTripId) {
        const p = tripPois[0];
        map.panTo([p.gcj02_lng || p.lng, p.gcj02_lat || p.lat]);
      } else if (pois.length > 0 && !selectedTripId) {
        // If no trip is selected, fit view to all POIs
        map.setFitView(markers, false, [60, 60, 60, 360]);
      }
    };

    loadPois();

    const onPoiUpdate = () => loadPois();
    window.addEventListener('poi-added', onPoiUpdate);

    const handleRightClick = async (e: any) => {
      const name = prompt("输入 POI 名称:");
      if (name) {
        const lnglat = e.lnglat;
        await db.createPoi({
          city_id: cityId,
          name,
          lng: lnglat.getLng(),
          lat: lnglat.getLat(),
          gcj02_lng: lnglat.getLng(),
          gcj02_lat: lnglat.getLat(),
        });
        window.dispatchEvent(new Event('poi-added'));
      }
    };

    map.on('rightclick', handleRightClick);

    return () => {
      cancelled = true;
      window.removeEventListener('poi-added', onPoiUpdate);
      map.off('rightclick', handleRightClick);
      markersRef.current.forEach((m) => {
        m.off('click');
        m.setMap(null);
      });
      markersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, cityId, selectedTripId]);

  return null;
}
