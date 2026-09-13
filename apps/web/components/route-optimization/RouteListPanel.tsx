'use client';

import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';

import { useI18n } from '@/context/I18nContext';
import type { OptimizationResult } from './types';

type RouteListPanelProps = {
  result: OptimizationResult | null;
  vehicleCapacities?: ReadonlyMap<string, number>;
  onMoveStop?: (
    sourceVehicleId: string,
    sourceIndex: number,
    destinationVehicleId: string,
    destinationIndex: number,
  ) => void;
};

export function RouteListPanel({
  result,
  vehicleCapacities = new Map(),
  onMoveStop,
}: RouteListPanelProps) {
  const { locale, t } = useI18n();
  const numberFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  function handleDragEnd(event: DropResult) {
    if (!event.destination || !onMoveStop) return;
    if (
      event.source.droppableId === event.destination.droppableId
      && event.source.index === event.destination.index
    ) {
      return;
    }
    onMoveStop(
      event.source.droppableId,
      event.source.index,
      event.destination.droppableId,
      event.destination.index,
    );
  }

  return (
    <section
      className="min-h-0 border-t border-slate-200 px-4 py-4 dark:border-slate-800"
      aria-labelledby="route-list-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
            {t('map.routeListEyebrow')}
          </p>
          <h2 id="route-list-title" className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">
            {t('map.routeListTitle')}
          </h2>
        </div>
        {result && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {result.status}
          </span>
        )}
      </div>

      {!result && (
        <div className="mt-4 rounded-sm border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700">
          {t('map.routeListEmpty')}
        </div>
      )}
      {result?.routes.length === 0 && (
        <div className="mt-4 rounded-sm border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700" role="status">
          {t('map.routeListDone')}
        </div>
      )}

      {result && result.routes.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {result.routes.map((route, index) => {
              const capacity = vehicleCapacities.get(route.vehicle_id);
              return (
                <article
                  key={route.vehicle_id}
                  className="overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30"
                >
                  <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-3 dark:border-slate-800">
                    <span>
                      <small className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t('map.vehicleIndex', { index: index + 1 })}
                      </small>
                      <strong className="mt-0.5 block text-sm text-slate-950 dark:text-white">
                        {route.license_plate}
                      </strong>
                    </span>
                    <span className="text-right">
                      <strong className="block text-xs text-slate-700 dark:text-slate-300">
                        {numberFormatter.format(route.distance_km)} km
                      </strong>
                      <small className="text-[10px] text-slate-500 dark:text-slate-400">
                        {capacity === undefined
                          ? t('map.loadWeight', { weight: numberFormatter.format(route.total_weight_kg) })
                          : t('routeEditor.capacity', {
                            weight: numberFormatter.format(route.total_weight_kg),
                            capacity: numberFormatter.format(capacity),
                          })}
                      </small>
                    </span>
                  </header>

                  <Droppable droppableId={route.vehicle_id}>
                    {(provided, snapshot) => (
                      <ol
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-24 space-y-2 p-3 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-amber-50 ring-2 ring-inset ring-dashed ring-amber-500 dark:bg-amber-950/30'
                            : 'bg-slate-50/70 dark:bg-slate-950/40'
                        }`}
                      >
                        {route.stops.length === 0 && !snapshot.isDraggingOver && (
                          <li className="grid min-h-16 place-items-center rounded-sm border border-dashed border-slate-300 px-3 text-center text-xs text-slate-500 dark:text-slate-400 dark:border-slate-700">
                            {t('routeEditor.emptyRoute')}
                          </li>
                        )}
                        {route.stops.map((stop, stopIndex) => (
                          <Draggable
                            key={stop.order_id}
                            draggableId={stop.order_id}
                            index={stopIndex}
                            isDragDisabled={!onMoveStop}
                            // The drag handle is a real button for keyboard and
                            // screen-reader accessibility. By default dnd blocks
                            // pointer starts from interactive elements, so allow
                            // this dedicated handle to start the drag explicitly.
                            disableInteractiveElementBlocking
                          >
                            {(dragProvided, dragSnapshot) => (
                              <li
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                style={dragProvided.draggableProps.style}
                                className={`grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-sm border bg-white p-2.5 transition-[border-color,box-shadow,transform] dark:bg-slate-900 ${
                                  dragSnapshot.isDragging
                                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                                    : 'border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <span className="grid size-6 place-items-center rounded-full bg-amber-700 dark:bg-amber-400 text-[10px] font-bold text-white dark:text-slate-950">
                                  {stopIndex + 1}
                                </span>
                                <p className="min-w-0 text-xs leading-5 text-slate-700 dark:text-slate-300">
                                  {stop.address}
                                </p>
                                {onMoveStop && (
                                  <button
                                    type="button"
                                    {...dragProvided.dragHandleProps}
                                    className="grid size-9 touch-none place-items-center rounded-sm text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:bg-slate-800 dark:hover:text-amber-300"
                                    aria-label={t('routeEditor.dragHandle', { address: stop.address })}
                                    title={t('routeEditor.dragHandle', { address: stop.address })}
                                  >
                                    <span aria-hidden="true">⋮⋮</span>
                                  </button>
                                )}
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ol>
                    )}
                  </Droppable>
                </article>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {!!result?.unassigned_orders.length && (
        <div className="mt-3 rounded-sm border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300" role="status">
          <strong>{t('map.unassigned', { count: result.unassigned_orders.length })}</strong>
          <p className="mt-1">{t('map.unassignedHelp')}</p>
        </div>
      )}
    </section>
  );
}
