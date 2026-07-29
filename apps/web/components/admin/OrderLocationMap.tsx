'use client';

import { divIcon, type LeafletMouseEvent, type Marker as LeafletMarker } from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { shouldRecenterMap } from './map-position';

type Coordinates = {
  latitude: number;
  longitude: number;
};

const pinIcon = divIcon({
  className: '',
  html: '<span class="block size-7 rounded-full border-4 border-white bg-teal-600 shadow-lg"></span>',
  iconAnchor: [14, 14],
  iconSize: [28, 28],
});

function MapController({
  position,
  onChange,
}: {
  position: Coordinates;
  onChange: (coordinates: Coordinates) => void;
}) {
  const map = useMap();
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    if (!shouldRecenterMap(
      { latitude: center.lat, longitude: center.lng },
      position,
    )) {
      return;
    }

    // Leaflet's animated flyTo emits a burst of map updates. In React 19 that
    // can feed back into this effect and hit the maximum update depth. A
    // guarded, non-animated setView performs the same coordinate sync once.
    map.stop();
    map.setView(
      [position.latitude, position.longitude],
      Math.max(map.getZoom(), 15),
      { animate: false },
    );
  }, [map, position.latitude, position.longitude]);
  return null;
}

export function OrderLocationMap({
  position,
  onChange,
}: {
  position: Coordinates;
  onChange: (coordinates: Coordinates) => void;
}) {
  const markerRef = useRef<LeafletMarker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const location = marker.getLatLng();
          onChange({
            latitude: location.lat,
            longitude: location.lng,
          });
        }
      },
    }),
    [onChange],
  );

  return (
    <MapContainer
      className="h-64 w-full"
      center={[position.latitude, position.longitude]}
      zoom={13}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController position={position} onChange={onChange} />
      <Marker
        draggable
        eventHandlers={eventHandlers}
        icon={pinIcon}
        position={[position.latitude, position.longitude]}
        ref={markerRef}
      />
    </MapContainer>
  );
}
