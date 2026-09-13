'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import { canAnimateDepotMap, isValidDepotCoordinates } from '@/components/depot-contracts';
import { depotIcon } from '@/components/route-optimization/RouteMapUi';

type Position = { latitude: number; longitude: number };
const FALLBACK_POSITION: Position = { latitude: 10.8671, longitude: 106.6412 };

function MapController({
  active,
  position,
  onChange,
}: {
  active: boolean;
  position: Position;
  onChange: (position: Position) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const container = map.getContainer();
      if (!canAnimateDepotMap(position, active, container.clientWidth, container.clientHeight)) return;

      map.invalidateSize({ animate: false, pan: false });
      map.flyTo([position.latitude, position.longitude], 13, { duration: 0.8 });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [active, map, position.latitude, position.longitude]);

  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

export function DepotLocationMap({
  active,
  position,
  onChange,
}: {
  active: boolean;
  position: Position;
  onChange: (position: Position) => void;
}) {
  // Keep the form usable during an invalid intermediate edit instead of
  // passing NaN to Leaflet and crashing the entire depot management page.
  const mapPosition = isValidDepotCoordinates(position) ? position : FALLBACK_POSITION;

  return (
    <div className="h-64 overflow-hidden rounded-sm border border-slate-200 dark:border-slate-700">
      <MapContainer center={[mapPosition.latitude, mapPosition.longitude]} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController active={active} position={mapPosition} onChange={onChange} />
        <Marker
          position={[mapPosition.latitude, mapPosition.longitude]}
          icon={depotIcon}
          draggable
          eventHandlers={{
            dragend(event) {
              const next = event.target.getLatLng();
              onChange({ latitude: next.lat, longitude: next.lng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
