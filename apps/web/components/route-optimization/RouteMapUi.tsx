'use client';

import { divIcon, latLngBounds, type LatLngTuple } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useI18n } from '@/context/I18nContext';

import type { Order } from '../admin/api-contracts';

export const HO_CHI_MINH_CITY: LatLngTuple = [10.7769, 106.7009];
/* One hue per vehicle on the map. The brand amber leads; the rest are
   spaced far enough apart in hue to stay separable. */
export const ROUTE_COLORS = ['#e8a838', '#38bdf8', '#a78bfa', '#34d399'];
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
};

function escapeMapLabel(value: string) {
  return value.replace(/[&<>'"]/g, (character) => (
    HTML_ESCAPES[character] ?? character
  ));
}

export function createVehicleIcon(
  licensePlate: string,
  status: 'IDLE' | 'ON_ROUTE',
  isOffRoute: boolean,
) {
  const stateClass = isOffRoute
    ? ' vehicle-map-marker--warning'
    : status === 'IDLE'
      ? ' vehicle-map-marker--idle'
      : ' vehicle-map-marker--active';
  return divIcon({
    className: 'vehicle-marker-shell',
    html: `<span class="vehicle-map-marker${stateClass}"><span class="vehicle-map-marker__truck" aria-hidden="true">🚛</span><span class="vehicle-map-marker__plate">${escapeMapLabel(licensePlate)}</span></span>`,
    iconAnchor: [24, 24],
    iconSize: [48, 48],
    popupAnchor: [0, -28],
  });
}

export function FitRouteBounds({
  positions,
  emptyCenter = HO_CHI_MINH_CITY,
}: {
  positions: LatLngTuple[];
  emptyCenter?: LatLngTuple;
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) {
      map.flyTo(emptyCenter, 12, { duration: 1.5 });
    } else if (positions.length > 1) {
      const isDesktop = map.getSize().x >= 768;
      map.fitBounds(latLngBounds(positions), {
        paddingTopLeft: isDesktop ? [420, 150] : [24, 170],
        paddingBottomRight: isDesktop ? [48, 80] : [24, 220],
        maxZoom: 14,
      });
    } else {
      map.setView(positions[0], 14);
    }
  }, [emptyCenter, map, positions]);

  return null;
}

export function createStopIcon(
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

export const depotIcon = divIcon({
  className: 'depot-icon-shell',
  html: '<span class="depot-map-icon" aria-hidden="true">⌂</span>',
  iconAnchor: [18, 18],
  iconSize: [36, 36],
  popupAnchor: [0, -20],
});

export function MapStatusOverlays({
  routingState,
  hasResult,
}: {
  routingState: 'idle' | 'loading' | 'ready' | 'fallback';
  hasResult: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="pointer-events-none absolute bottom-20 right-3 z-[400] rounded-sm border border-white/60 bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 shadow backdrop-blur dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-300 lg:bottom-3">
        OpenStreetMap · Leaflet · OSRM
      </div>
      {routingState === 'loading' && (
        <p className="absolute right-3 top-40 z-[450] flex items-center gap-2 rounded-sm bg-slate-950/80 px-3 py-2 text-xs font-medium text-white backdrop-blur" role="status">
          <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          {t('map.routing')}
        </p>
      )}
      {routingState === 'fallback' && (
        <p className="absolute right-3 top-40 z-[450] max-w-xs rounded-sm border border-orange-200 bg-white/95 px-3 py-2 text-xs text-orange-800 backdrop-blur dark:border-orange-900 dark:bg-slate-950/95 dark:text-orange-300" role="status">
          {t('map.routingFallback')}
        </p>
      )}
      {!hasResult && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/70 bg-white/90 px-6 py-5 text-center backdrop-blur dark:border-slate-700 dark:bg-slate-950/90" role="status">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-amber-50 text-xl text-amber-700 dark:bg-amber-950 dark:text-amber-300" aria-hidden="true">⌖</span>
          <strong className="mt-3 block text-sm text-slate-950 dark:text-white">{t('map.emptyTitle')}</strong>
          <small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{t('map.emptyDescription')}</small>
        </div>
      )}
    </>
  );
}

export function RouteLegend({
  routes,
}: {
  routes: Array<{ vehicleId: string; licensePlate: string; color: string }>;
}) {
  const { t } = useI18n();

  if (routes.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-3 left-1/2 z-[450] hidden -translate-x-1/2 items-center gap-3 rounded-full border border-white/70 bg-white/90 px-3 py-2 text-[10px] font-medium text-slate-700 backdrop-blur md:flex dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-200" aria-label={t('map.legend')}>
      <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-rose-600" />{t('map.legendDepot')}</span>
      {routes.map((route) => (
        <span className="flex items-center gap-1.5" key={route.vehicleId}>
          <i className="size-2 rounded-full" style={{ backgroundColor: route.color }} />
          {route.licensePlate}
        </span>
      ))}
    </div>
  );
}
