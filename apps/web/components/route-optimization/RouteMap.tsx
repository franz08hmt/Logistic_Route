'use client';

import type { LatLngTuple } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
} from 'react-leaflet';

import type { Order } from '../admin/api-contracts';
import { useI18n } from '@/context/I18nContext';
import { buildRoutePositions, fetchOsrmRouteGeometry } from './map-data';
import {
  createStopIcon,
  depotIcon,
  FitRouteBounds,
  HO_CHI_MINH_CITY,
  MapStatusOverlays,
  ROUTE_COLORS,
  RouteLegend,
} from './RouteMapUi';
import type { OptimizationResult } from './types';

type RoutingState = 'idle' | 'loading' | 'ready' | 'fallback';

export function RouteMap({
  result,
  orders,
}: {
  result: OptimizationResult | null;
  orders: Order[];
}) {
  const { t } = useI18n();
  const [roadPositions, setRoadPositions] = useState<Record<string, LatLngTuple[]>>({});
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
  const visiblePositions = useMemo<LatLngTuple[]>(
    () =>
      result
        ? [
            [result.depot.latitude, result.depot.longitude],
            ...routeLayers.flatMap((layer) => layer.positions),
          ]
        : [],
    [result, routeLayers],
  );

  return (
    <section className="absolute inset-0" aria-label={t('map.mapLabel')}>
      <MapContainer
        center={HO_CHI_MINH_CITY}
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
        <FitRouteBounds positions={visiblePositions} />

        {result && (
          <Marker
            position={[result.depot.latitude, result.depot.longitude]}
            icon={depotIcon}
            title={`${t('map.depot')}: ${result.depot.name}`}
          >
            <Popup><strong>{result.depot.name}</strong><br />{result.depot.address}</Popup>
          </Marker>
        )}

        {routeLayers.map(({ route, color, positions }) => (
          <Polyline
            key={route.vehicle_id}
            positions={positions}
            pathOptions={{ color, weight: 5, opacity: 0.9 }}
          >
            <Popup><strong>{route.license_plate}</strong><br />{t('map.routePopup', { count: route.stops.length, distance: route.distance_km })}</Popup>
          </Polyline>
        ))}

        {routeLayers.flatMap(({ route, color }) =>
          route.stops.map((stop) => {
            const order = orderById.get(stop.order_id);
            const status = order?.status;
            const markerColor =
              status === 'DELIVERED' ? '#475569' : status === 'FAILED' ? '#dc2626' : color;

            return (
              <Marker
                key={`${route.vehicle_id}-${stop.order_id}`}
                position={[stop.latitude, stop.longitude]}
                icon={createStopIcon(stop.stop_sequence, markerColor, status)}
                title={t('map.stopTitle', { sequence: stop.stop_sequence, address: stop.address })}
              >
                <Popup>
                  <strong>{t('map.stopPopup', { sequence: stop.stop_sequence, vehicle: route.license_plate })}</strong><br />
                  {stop.address}
                  {status && <><br />{t('map.statusLabel')} {t(`status.${status}`)}</>}
                  {order?.failure_reason && <><br />{t('map.reasonLabel')} {order.failure_reason}</>}
                </Popup>
              </Marker>
            );
          }),
        )}
      </MapContainer>

      <MapStatusOverlays routingState={routingState} hasResult={result !== null} />
      <RouteLegend
        routes={routeLayers.map(({ route, color }) => ({
          vehicleId: route.vehicle_id,
          licensePlate: route.license_plate,
          color,
        }))}
      />
    </section>
  );
}
