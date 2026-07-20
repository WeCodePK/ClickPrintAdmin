"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

// Islamabad — a sane starting view before the admin picks anything.
const DEFAULT_CENTER: [number, number] = [33.6844, 73.0479];
const DEFAULT_ZOOM = 12;
const PICKED_ZOOM = 16;

export type LatLng = { lat: number; lng: number };

const round = (n: number) => Number(n.toFixed(5));

export function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (next: LatLng) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  // Moves/creates the marker; assigned once the map has loaded.
  const placeRef = useRef<((lat: number, lng: number) => void) | null>(null);
  // Kept in a ref so the map is only ever created once.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start = value;
      const map = L.map(containerRef.current, {
        center: start ? [start.lat, start.lng] : DEFAULT_CENTER,
        zoom: start ? PICKED_ZOOM : DEFAULT_ZOOM,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // Bundlers break Leaflet's default icon URLs, so draw the pin ourselves.
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      placeRef.current = (lat, lng) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          return;
        }
        markerRef.current = L.marker([lat, lng], { icon, draggable: true })
          .addTo(map)
          .on("dragend", (event) => {
            const { lat: dLat, lng: dLng } = (event.target as Marker).getLatLng();
            onChangeRef.current({ lat: round(dLat), lng: round(dLng) });
          });
      };

      if (start) placeRef.current(start.lat, start.lng);

      map.on("click", (event) => {
        const { lat, lng } = event.latlng;
        placeRef.current?.(lat, lng);
        onChangeRef.current({ lat: round(lat), lng: round(lng) });
      });

      // The container is often still sizing when the map initialises.
      setTimeout(() => map.invalidateSize(), 0);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      placeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect coordinates typed into the inputs back onto the map.
  useEffect(() => {
    if (!value || !placeRef.current) return;
    const current = markerRef.current?.getLatLng();
    if (current && round(current.lat) === value.lat && round(current.lng) === value.lng) {
      return;
    }
    placeRef.current(value.lat, value.lng);
    mapRef.current?.panTo([value.lat, value.lng]);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-lg border border-border"
      style={{ zIndex: 0 }}
    />
  );
}

export default LocationPicker;
