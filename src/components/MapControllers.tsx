import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import type { Coordinate } from "../domain";

const toLatLng = (point: Coordinate): [number, number] => [point.lat, point.lng];

export function FitCoordinateBounds({ polygon, padding = 48 }: { polygon: Coordinate[]; padding?: number }) {
  const map = useMap();
  useEffect(() => {
    if (polygon.length < 3) return;
    map.fitBounds(polygon.map(toLatLng), { padding: [padding, padding], animate: false, maxZoom: 16 });
  }, [map, padding, polygon]);
  return null;
}

export function MapClickCapture({ enabled, onPick }: { enabled: boolean; onPick: (coordinate: Coordinate) => void }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}
