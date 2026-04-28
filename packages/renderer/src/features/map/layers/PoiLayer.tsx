import { useEffect, useRef } from "react";
import { db } from "../../../services/db";
import { useMapStore } from "../mapStore";
import { gcj02ToWgs84 } from "../../../utils/coord";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function PoiLayer({ map, cityId }: { map: any; cityId: string | null }) {
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const selectedTripId = useMapStore(s => s.selectedTripId);
  const addingPoi = useMapStore(s => s.addingPoi);
  const openPoiDraft = useMapStore(s => s.openPoiDraft);

  useEffect(() => {
    if (!map || !cityId) return;

    let cancelled = false;

    const loadPois = async () => {
      try {
        const pois = await db.getPois(cityId);
        const tripPois = selectedTripId ? await db.getPoisForTrip(selectedTripId) : [];
        if (cancelled) return;

      const AMap = window.AMap;

      const markers = pois.map((poi: any) => {
        const isRestaurant = poi.category?.includes("餐饮") || poi.category?.includes("美食");
        const isHotel = poi.category?.includes("住宿") || poi.category?.includes("酒店");
        const isAttraction = poi.category?.includes("景点") || poi.category?.includes("风景");

        let emoji = "📍";
        let bg = "#3b82f6";
        if (isRestaurant) {
          emoji = "🍽️";
          bg = "#f97316";
        } else if (isHotel) {
          emoji = "🏨";
          bg = "#a855f7";
        } else if (isAttraction) {
          emoji = "📸";
          bg = "#10b981";
        }

        const tripIndex = tripPois.findIndex((tp: any) => tp.poi_id === poi.poi_id);
        const inTrip = tripIndex !== -1;
        const safeName = escapeHtml(poi.name);
        const badge = inTrip
          ? `<div style="position:absolute;top:-6px;right:-6px;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:9999px;background:var(--color-accent);color:#fff;font-size:10px;font-weight:700;border:1px solid rgba(255,255,255,0.9);box-shadow:0 1px 4px rgba(0,0,0,0.35);">${tripIndex + 1}</div>`
          : "";
        const content = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:${inTrip ? "scale(1.1)" : "scale(1)"};opacity:${inTrip ? "1" : "0.85"};transition:transform 200ms ease, opacity 200ms ease;">
            ${badge}
            <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:${bg};border:2px solid rgba(255,255,255,0.9);box-shadow:0 3px 10px rgba(0,0,0,0.35);">
              <span style="font-size:14px;line-height:1;">${emoji}</span>
            </div>
            <div style="margin-top:4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(23,23,23,0.85);color:#fff;font-size:10px;padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(6px);">
              ${safeName}
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
        
        if (selectedTripId) {
          map.setFitView([polylineRef.current], false, [60, 60, 60, 360]);
        }
      } else if (tripPois.length === 1 && selectedTripId) {
        const p = tripPois[0];
        map.panTo([p.gcj02_lng || p.lng, p.gcj02_lat || p.lat]);
      } else if (pois.length > 0 && !selectedTripId) {
        map.setFitView(markers, false, [60, 60, 60, 360]);
      }
      } catch (err) {
        console.error("Failed to load POIs:", err);
      }
    };

    loadPois();

    const onPoiUpdate = () => loadPois();
    window.addEventListener('poi-added', onPoiUpdate);

    const handleClick = (e: any) => {
      if (!useMapStore.getState().addingPoi) return;
      const lnglat = e?.lnglat;
      if (!lnglat) return;
      const gcjLng = lnglat.getLng();
      const gcjLat = lnglat.getLat();
      const wgs = gcj02ToWgs84(gcjLng, gcjLat);
      openPoiDraft({ lng: wgs.lng, lat: wgs.lat, gcj02_lng: gcjLng, gcj02_lat: gcjLat });
    };

    map.on('click', handleClick);

    return () => {
      cancelled = true;
      window.removeEventListener('poi-added', onPoiUpdate);
      map.off('click', handleClick);
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
  }, [map, cityId, selectedTripId, addingPoi, openPoiDraft]);

  return null;
}
