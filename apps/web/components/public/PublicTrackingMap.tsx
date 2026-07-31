'use client';

import L, { type LatLngTuple } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';

import { useI18n } from '@/context/I18nContext';
import type { PublicTrackingResponse } from './tracking-contracts';

const depotIcon = L.divIcon({
  className: 'tracking-marker-shell',
  html: '<span class="tracking-marker tracking-marker--depot" aria-hidden="true">🏢</span>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const destinationIcon = L.divIcon({
  className: 'tracking-marker-shell',
  html: '<span class="tracking-marker tracking-marker--destination" aria-hidden="true">📍</span>',
  iconSize: [40, 40],
  iconAnchor: [20, 36],
});

const driverIcon = L.divIcon({
  className: 'tracking-marker-shell',
  html: '<span class="tracking-marker tracking-marker--driver" aria-hidden="true">🚚</span>',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

export function PublicTrackingMap({
  tracking,
}: {
  tracking: PublicTrackingResponse;
}) {
  const { t } = useI18n();
  const [driverProgress, setDriverProgress] = useState(0.3);
  const depotPosition = useMemo<LatLngTuple>(
    () => [tracking.depot.latitude, tracking.depot.longitude],
    [tracking.depot.latitude, tracking.depot.longitude],
  );
  const destinationPosition = useMemo<LatLngTuple>(
    () => [tracking.order.latitude, tracking.order.longitude],
    [tracking.order.latitude, tracking.order.longitude],
  );

  useEffect(() => {
    if (tracking.order.status !== 'DELIVERING') {
      return;
    }
    const updateProgress = () => {
      const cycle = (Date.now() % 120_000) / 120_000;
      setDriverProgress(0.15 + cycle * 0.7);
    };
    updateProgress();
    const timer = window.setInterval(updateProgress, 1_000);
    return () => window.clearInterval(timer);
  }, [tracking.order.status]);

  const driverPosition = useMemo<LatLngTuple>(
    () => [
      depotPosition[0] + (destinationPosition[0] - depotPosition[0]) * driverProgress,
      depotPosition[1] + (destinationPosition[1] - depotPosition[1]) * driverProgress,
    ],
    [depotPosition, destinationPosition, driverProgress],
  );

  return (
    <div className="h-[21rem] w-full overflow-hidden rounded-xl sm:h-[26rem]">
      <MapContainer
        center={depotPosition}
        zoom={12}
        className="route-map-root h-full w-full"
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />
        <FitTrackingBounds depot={depotPosition} destination={destinationPosition} />
        <Polyline
          positions={[depotPosition, destinationPosition]}
          pathOptions={{ color: '#0d9488', weight: 5, opacity: 0.8, dashArray: '10 8' }}
        />
        <Marker position={depotPosition} icon={depotIcon} title={tracking.depot.name}>
          <Popup><strong>{tracking.depot.name}</strong><br />{tracking.depot.address}</Popup>
        </Marker>
        <Marker
          position={destinationPosition}
          icon={destinationIcon}
          title={t('tracking.destination')}
        >
          <Popup><strong>{t('tracking.destination')}</strong><br />{tracking.order.address}</Popup>
        </Marker>
        {tracking.order.status === 'DELIVERING' && tracking.driver && (
          <Marker
            position={driverPosition}
            icon={driverIcon}
            title={t('tracking.driverPosition')}
          >
            <Popup>
              <strong>{tracking.driver.driver_name}</strong><br />
              {tracking.driver.license_plate}<br />
              {t('tracking.simulatedPosition')}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

function FitTrackingBounds({
  depot,
  destination,
}: {
  depot: LatLngTuple;
  destination: LatLngTuple;
}) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(L.latLngBounds([depot, destination]), {
      padding: [36, 36],
      maxZoom: 14,
    });
  }, [
    map,
    depot[0],
    depot[1],
    destination[0],
    destination[1],
  ]);
  return null;
}
