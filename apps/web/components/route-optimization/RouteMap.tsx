'use client';

import { divIcon, latLngBounds, type LatLngTuple } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';

import {
  buildRoutePositions,
  fetchOsrmRouteGeometry,
} from './map-data';
import type { OptimizationResult } from './types';
import type { Order } from '../admin/api-contracts';

const HO_CHI_MINH_CITY: LatLngTuple = [10.7769, 106.7009];
const ROUTE_COLORS = ['#52d6a3', '#f6c85f', '#6aa9ff', '#ef8ca3'];

type RoutingState = 'idle' | 'loading' | 'ready' | 'fallback';

function FitRouteBounds({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) {
      map.setView(HO_CHI_MINH_CITY, 12);
      return;
    }

    if (positions.length > 1) {
      map.fitBounds(latLngBounds(positions), {
        padding: [36, 36],
        maxZoom: 14,
      });
    } else {
      map.setView(positions[0], 14);
    }
  }, [map, positions]);

  return null;
}

function createStopIcon(
  sequence: number,
  color: string,
  status: Order['status'] | undefined,
) {
  const markerClass = status ? ` route-stop-${status.toLowerCase()}` : '';
  const label = status === 'DELIVERED' ? '✓' : status === 'FAILED' ? '!' : sequence;
  return divIcon({
    className: 'route-stop-icon-shell',
    html: `<span class="route-stop-icon${markerClass}" style="--marker-color:${color}">${label}</span>`,
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

export function RouteMap({
  result,
  orders,
}: {
  result: OptimizationResult | null;
  orders: Order[];
}) {
  const [roadPositions, setRoadPositions] = useState<
    Record<string, LatLngTuple[]>
  >({});
  const [routingState, setRoutingState] = useState<RoutingState>('idle');

  useEffect(() => {
    const controller = new AbortController();

    if (!result || result.routes.length === 0) {
      setRoadPositions({});
      setRoutingState('idle');
      return () => controller.abort();
    }

    setRoadPositions({});
    setRoutingState('loading');

    void Promise.all(
      result.routes.map(async (route) => {
        try {
          const positions = await fetchOsrmRouteGeometry(
            result.depot,
            route.stops,
            controller.signal,
          );
          return [route.vehicle_id, positions] as const;
        } catch {
          return [route.vehicle_id, null] as const;
        }
      }),
    ).then((routes) => {
      if (controller.signal.aborted) {
        return;
      }

      const nextRoadPositions: Record<string, LatLngTuple[]> = {};
      let missingRouteCount = 0;

      for (const [vehicleId, positions] of routes) {
        if (positions) {
          nextRoadPositions[vehicleId] = positions;
        } else {
          missingRouteCount += 1;
        }
      }

      setRoadPositions(nextRoadPositions);
      setRoutingState(missingRouteCount > 0 ? 'fallback' : 'ready');
    });

    return () => controller.abort();
  }, [result]);

  const routeLayers = useMemo(
    () =>
      result?.routes.map((route, routeIndex) => ({
        route,
        color: ROUTE_COLORS[routeIndex % ROUTE_COLORS.length],
        positions:
          roadPositions[route.vehicle_id] ??
          buildRoutePositions(result.depot, route.stops),
      })) ?? [],
    [result, roadPositions],
  );
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const visiblePositions = useMemo<LatLngTuple[]>(() => {
    if (!result) {
      return [];
    }

    return [
      [result.depot.latitude, result.depot.longitude],
      ...routeLayers.flatMap((layer) => layer.positions),
    ];
  }, [result, routeLayers]);

  return (
    <section className="route-map" aria-label="Bản đồ tuyến đường tối ưu">
      <div className="route-map-heading">
        <div>
          <span className="eyebrow">Live map</span>
          <h2>Bản đồ điều phối TP.HCM</h2>
        </div>
        <span className="map-provider">OpenStreetMap · Leaflet · OSRM</span>
      </div>
      {routingState === 'loading' && (
        <p className="map-routing-status" role="status">
          <span className="map-routing-spinner" aria-hidden="true" />
          Đang khớp lộ trình với mạng lưới đường giao thông…
        </p>
      )}
      {routingState === 'fallback' && (
        <p className="map-routing-warning" role="status">
          OSRM tạm thời không khả dụng cho một số tuyến. Bản đồ đang dùng đường
          nối dự phòng.
        </p>
      )}

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
          <FitRouteBounds positions={visiblePositions} />

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
              (() => {
                const order = orderById.get(stop.order_id);
                const status = order?.status;
                const markerColor =
                  status === 'DELIVERED'
                    ? '#4b5563'
                    : status === 'FAILED'
                      ? '#ef4444'
                      : color;

                return (
                  <Marker
                    key={`${route.vehicle_id}-${stop.order_id}`}
                    position={[stop.latitude, stop.longitude]}
                    icon={createStopIcon(stop.stop_sequence, markerColor, status)}
                    title={`Điểm ${stop.stop_sequence}: ${stop.address}`}
                  >
                    <Popup>
                      <strong>
                        Điểm {stop.stop_sequence} · {route.license_plate}
                      </strong>
                      <br />
                      {stop.address}
                      {status && (
                        <>
                          <br />
                          Trạng thái: {status}
                        </>
                      )}
                      {order?.failure_reason && (
                        <>
                          <br />
                          Lý do: {order.failure_reason}
                        </>
                      )}
                    </Popup>
                  </Marker>
                );
              })()
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
