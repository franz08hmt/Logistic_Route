'use client';

import { divIcon, latLngBounds, type LatLngTuple } from 'leaflet';
import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';

import { buildAllMapPositions, buildRoutePositions } from './map-data';
import type { OptimizationResult } from './types';

const HO_CHI_MINH_CITY: LatLngTuple = [10.7769, 106.7009];
const ROUTE_COLORS = ['#52d6a3', '#f6c85f', '#6aa9ff', '#ef8ca3'];

function FitRouteBounds({ result }: { result: OptimizationResult | null }) {
  const map = useMap();

  useEffect(() => {
    if (!result) {
      map.setView(HO_CHI_MINH_CITY, 12);
      return;
    }

    const positions = buildAllMapPositions(result);
    if (positions.length > 1) {
      map.fitBounds(latLngBounds(positions), {
        padding: [36, 36],
        maxZoom: 14,
      });
    } else {
      map.setView(positions[0], 14);
    }
  }, [map, result]);

  return null;
}

function createStopIcon(sequence: number, color: string) {
  return divIcon({
    className: 'route-stop-icon-shell',
    html: `<span class="route-stop-icon" style="--marker-color:${color}">${sequence}</span>`,
    iconAnchor: [16, 16],
    iconSize: [32, 32],
    popupAnchor: [0, -18],
  });
}

const depotIcon = divIcon({
  className: 'depot-icon-shell',
  html: '<span class="depot-map-icon" aria-hidden="true">⌂</span>',
  iconAnchor: [18, 18],
  iconSize: [36, 36],
  popupAnchor: [0, -20],
});

export function RouteMap({ result }: { result: OptimizationResult | null }) {
  const routeLayers = useMemo(
    () =>
      result?.routes.map((route, routeIndex) => ({
        route,
        color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
        positions: buildRoutePositions(result.depot, route.stops),
      })) ?? [],
    [result],
  );

  return (
    <section className="route-map" aria-label="Bản đồ tuyến đường tối ưu">
      <div className="route-map-heading">
        <div>
          <span className="eyebrow">Live map</span>
          <h2>Bản đồ điều phối TP.HCM</h2>
        </div>
        <span className="map-provider">OpenStreetMap · Leaflet</span>
      </div>

      <div className="leaflet-map-frame">
        <MapContainer
          center={HO_CHI_MINH_CITY}
          zoom={12}
          className="leaflet-route-map"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <FitRouteBounds result={result} />

          {result && (
            <Marker
              position={[result.depot.latitude, result.depot.longitude]}
              icon={depotIcon}
              title={`Kho hàng: ${result.depot.name}`}
            >
              <Popup>
                <strong>{result.depot.name}</strong>
                <br />
                {result.depot.address}
              </Popup>
            </Marker>
          )}

          {routeLayers.map(({ route, color, positions }) => (
            <Polyline
              key={route.vehicle_id}
              positions={positions}
              pathOptions={{ color, weight: 5, opacity: 0.88 }}
            >
              <Popup>
                <strong>{route.license_plate}</strong>
                <br />
                {route.stops.length} điểm giao · {route.distance_km} km
              </Popup>
            </Polyline>
          ))}

          {routeLayers.flatMap(({ route, color }) =>
            route.stops.map((stop) => (
              <Marker
                key={`${route.vehicle_id}-${stop.order_id}`}
                position={[stop.latitude, stop.longitude]}
                icon={createStopIcon(stop.stop_sequence, color)}
                title={`Điểm ${stop.stop_sequence}: ${stop.address}`}
              >
                <Popup>
                  <strong>
                    Điểm {stop.stop_sequence} · {route.license_plate}
                  </strong>
                  <br />
                  {stop.address}
                </Popup>
              </Marker>
            )),
          )}
        </MapContainer>

        {!result && (
          <div className="map-empty-overlay" role="status">
            <span aria-hidden="true">⌖</span>
            <strong>Chưa có lộ trình</strong>
            <small>Chạy tối ưu để vẽ kho, điểm giao và tuyến xe.</small>
          </div>
        )}
      </div>

      {!!routeLayers.length && (
        <div className="route-legend" aria-label="Chú giải màu tuyến xe">
          <span>
            <i className="depot-legend-dot" />
            Kho hàng
          </span>
          {routeLayers.map(({ route, color }) => (
            <span key={route.vehicle_id}>
              <i style={{ backgroundColor: color }} />
              {route.license_plate}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
