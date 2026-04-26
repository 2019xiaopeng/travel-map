import { useEffect, useRef } from "react";
import { db } from "../../../services/db";

export function PoiLayer({ map, cityId }: { map: any; cityId: string | null }) {
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || !cityId) return;

    let cancelled = false;

    const loadPois = async () => {
      const pois = await db.getPois(cityId);
      if (cancelled) return;

      const AMap = window.AMap;
      
      const markers = pois.map((poi: any) => {
        const marker = new AMap.Marker({
          position: [poi.gcj02_lng || poi.lng, poi.gcj02_lat || poi.lat],
          title: poi.name,
          extData: poi
        });

        marker.on('click', () => {
          alert(`POI: ${poi.name}\n${poi.summary || ''}`);
        });

        return marker;
      });

      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = markers;
      map.add(markers);
    };

    loadPois();

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
        loadPois(); // reload
      }
    };

    map.on('rightclick', handleRightClick);

    return () => {
      cancelled = true;
      map.off('rightclick', handleRightClick);
      markersRef.current.forEach((m) => {
        m.off('click');
        m.setMap(null);
      });
      markersRef.current = [];
    };
  }, [map, cityId]);

  return null;
}
