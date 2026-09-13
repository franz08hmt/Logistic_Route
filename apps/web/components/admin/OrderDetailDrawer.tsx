'use client';

import { LinkIcon, PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useId, useRef, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import {
  isPublicTrackingResponse,
  type PublicTrackingResponse,
} from '@/components/public/tracking-contracts';
import {
  isOrderActivityList,
  type OrderActivity,
} from './activity-contracts';
import { type Order, type Vehicle, requestApi } from './api-contracts';
import { OrderActivityTimeline } from './OrderActivityTimeline';
import { codStatusTone, formatVnd } from '../cod/cod-format';
import { OrderNotificationSection } from './OrderNotificationSection';
import { shouldResetOrderDetailOverlays } from './order-detail-state';
import { PodPreviewModal } from './PodPreviewModal';
import { PrintableDeliveryBillPreview } from './PrintableDeliveryBill';
import { StatusBadge } from './StatusBadge';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function OrderDetailDrawer({
  order,
  vehicle,
  onClose,
}: {
  order: Order | null;
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const [lastOrder, setLastOrder] = useState<Order | null>(order);
  const [lastVehicle, setLastVehicle] = useState<Vehicle | null>(vehicle);
  const [activities, setActivities] = useState<OrderActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [billTracking, setBillTracking] = useState<PublicTrackingResponse | null>(null);
  const [isBillLoading, setIsBillLoading] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousOrderIdRef = useRef<string | null>(order?.id ?? null);
  const titleId = useId();
  const open = order !== null;
  const activeOrder = order ?? lastOrder;
  const activeVehicle = vehicle ?? lastVehicle;

  useEffect(() => {
    const nextOrderId = order?.id ?? null;
    const shouldReset = shouldResetOrderDetailOverlays(
      previousOrderIdRef.current,
      nextOrderId,
    );
    previousOrderIdRef.current = nextOrderId;

    if (!order) {
      return;
    }

    setLastOrder(order);
    setLastVehicle(vehicle);
    if (shouldReset) {
      setIsPodOpen(false);
      setIsBillOpen(false);
      setBillTracking(null);
      setBillError(null);
      setCopyState('idle');
    }
  }, [order, vehicle]);

  useEffect(() => {
    if (!order) {
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setActivities([]);
    void requestApi(`/api/v1/orders/${order.id}/activity`, {
      signal: controller.signal,
    })
      .then((payload) => {
        if (!isOrderActivityList(payload)) {
          throw new Error(t('activity.invalidResponse'));
        }
        setActivities(payload.activities);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : t('activity.loadError'));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [order, t]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (
          panelRef.current?.querySelector('dialog[open]')
          || document.querySelector('.delivery-bill-print-root')
        ) {
          return;
        }
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  const weightFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );

  async function copyTrackingLink() {
    if (!activeOrder) {
      return;
    }
    const trackingLink = `${window.location.origin}/track/${activeOrder.tracking_token}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = trackingLink;
        textArea.setAttribute('readonly', '');
        textArea.className = 'fixed left-[-9999px] top-0';
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand('copy');
        textArea.remove();
        if (!copied) {
          throw new Error('Clipboard API unavailable');
        }
      }
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  async function openBillPreview() {
    if (!activeOrder) {
      return;
    }
    setIsBillOpen(true);
    setIsBillLoading(true);
    setBillError(null);
    try {
      const payload = await requestApi(
        `/api/v1/public/track/${activeOrder.tracking_token}`,
      );
      if (!isPublicTrackingResponse(payload)) {
        throw new Error(t('bill.invalidResponse'));
      }
      setBillTracking(payload);
    } catch (requestError) {
      setBillError(
        requestError instanceof Error ? requestError.message : t('bill.loadError'),
      );
    } finally {
      setIsBillLoading(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        tabIndex={-1}
        disabled={!open}
        aria-label={t('orderDetail.close')}
        className={`absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 sm:w-[28rem] lg:w-[32rem] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {activeOrder && (
          <>
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:px-6">
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">{t('orderDetail.eyebrow')}</span>
                <h2 id={titleId} className="mt-1 truncate text-xl font-semibold text-slate-950 dark:text-white">{activeOrder.order_code}</h2>
                <div className="mt-3"><StatusBadge status={activeOrder.status} /></div>
              </div>
              <button ref={closeRef} type="button" className="grid size-10 shrink-0 place-items-center rounded-sm text-xl text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-amber-600 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={t('orderDetail.close')} onClick={onClose}><XMarkIcon aria-hidden="true" className="size-5" /></button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <section aria-labelledby={`${titleId}-info`}>
                <h3 id={`${titleId}-info`} className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('orderDetail.information')}</h3>
                <dl className="mt-3 grid gap-4 rounded-sm border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/50 sm:grid-cols-2">
                  <Info label={t('orderDetail.customer')} value={activeOrder.customer_name} />
                  <Info label={t('orderDetail.phone')} value={activeOrder.customer_phone ? <a className="font-semibold text-amber-700 hover:underline dark:text-amber-300" href={`tel:${activeOrder.customer_phone}`}>{activeOrder.customer_phone}</a> : t('orderDetail.notAvailable')} />
                  <Info wide label={t('orderDetail.address')} value={activeOrder.address} />
                  <Info label={t('orderDetail.weight')} value={`${weightFormatter.format(activeOrder.weight_kg)} kg`} />
                  <Info label={t('orderDetail.region')} value={activeOrder.delivery_region || t('orderDetail.notAvailable')} />
                  {activeVehicle && <><Info label={t('orderDetail.vehicle')} value={activeVehicle.license_plate} /><Info label={t('orderDetail.driver')} value={activeVehicle.driver_name || t('orderDetail.notAvailable')} /></>}
                </dl>
                <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950" onClick={() => void copyTrackingLink()}>
                  <LinkIcon aria-hidden="true" className="size-4" />
                  {copyState === 'copied' ? t('orderDetail.trackingLinkCopied') : t('orderDetail.copyTrackingLink')}
                </button>
                <p className={`mt-2 text-xs ${copyState === 'error' ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`} aria-live="polite">
                  {copyState === 'error' ? t('orderDetail.trackingLinkCopyError') : copyState === 'copied' ? t('orderDetail.trackingLinkCopiedHint') : ''}
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  onClick={() => void openBillPreview()}
                >
                  <PrinterIcon aria-hidden="true" className="size-4" />
                  {t('bill.printAction')}
                </button>
              </section>

              {activeOrder.cod_amount > 0 && activeOrder.payment_method !== 'PREPAID' && (
                <section className="mt-4" aria-labelledby={`${titleId}-cod`}>
                  <h3 id={`${titleId}-cod`} className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('bill.codTitle')}</h3>
                  <dl className="mt-3 grid gap-4 rounded-sm border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30 sm:grid-cols-2">
                    <Info
                      label={t('cod.ledger.amount')}
                      value={<span className="text-base font-black tabular-nums text-amber-800 dark:text-amber-300">{formatVnd(activeOrder.cod_amount, locale)}</span>}
                    />
                    <Info
                      label={t('cod.ledger.paymentMethod')}
                      value={t(`cod.paymentMethod.${activeOrder.payment_method}`)}
                    />
                    <Info
                      label={t('cod.ledger.codStatus')}
                      value={(
                        <span className={`inline-block rounded-sm px-2.5 py-1 text-xs font-bold ${codStatusTone(activeOrder.cod_status)}`}>
                          {t(`cod.codStatus.${activeOrder.cod_status}`)}
                        </span>
                      )}
                    />
                    <Info
                      label={t('cod.ledger.collectedAt')}
                      value={activeOrder.cod_collected_at ? new Date(activeOrder.cod_collected_at).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US') : t('orderDetail.notAvailable')}
                    />
                    <Info
                      label={t('cod.ledger.reconciledAt')}
                      value={activeOrder.cod_reconciled_at ? new Date(activeOrder.cod_reconciled_at).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US') : t('orderDetail.notAvailable')}
                    />
                    {activeOrder.cod_receipt_note && (
                      <Info wide label={t('driver.cod.receiptNote')} value={activeOrder.cod_receipt_note} />
                    )}
                  </dl>
                </section>
              )}

              {activeOrder.failure_reason && <div className="mt-4 rounded-sm border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><strong>{t('orderDetail.failureReason')}</strong><p className="mt-1 leading-6">{activeOrder.failure_reason}</p></div>}
              {activeOrder.delivery_note && <div className="mt-4 rounded-sm border border-slate-200 p-4 text-sm dark:border-slate-800"><strong className="text-slate-950 dark:text-white">{t('orderDetail.deliveryNote')}</strong><p className="mt-1 leading-6 text-slate-600 dark:text-slate-300">{activeOrder.delivery_note}</p></div>}
              {activeOrder.pod_url && <button type="button" className="mt-4 w-full overflow-hidden rounded-sm border border-slate-200 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-slate-800" onClick={() => setIsPodOpen(true)}><img className="h-32 w-full bg-slate-100 object-cover dark:bg-slate-950" src={activeOrder.pod_url} alt={t('orderDetail.podAlt', { code: activeOrder.order_code })} /><span className="block px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">{t('orderDetail.openPod')}</span></button>}
              {activeOrder.signature_url && (
                <section className="mt-4 rounded-sm border border-slate-200 p-4 dark:border-slate-800" aria-labelledby={`${titleId}-signature`}>
                  <h3 id={`${titleId}-signature`} className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('signature.title')}</h3>
                  <img className="mt-3 h-24 w-full rounded-sm bg-white object-contain p-2" src={activeOrder.signature_url} alt={t('signature.existingAlt')} />
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{activeOrder.recipient_name ?? t('orderDetail.notAvailable')}</p>
                </section>
              )}

              <OrderNotificationSection order={open ? activeOrder : null} />

              <section className="mt-7" aria-labelledby={`${titleId}-timeline`}>
                <h3 id={`${titleId}-timeline`} className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('activity.title')}</h3>
                <OrderActivityTimeline activities={activities} isLoading={isLoading} error={error} />
              </section>
            </div>
            <PodPreviewModal order={isPodOpen ? activeOrder : null} onClose={() => setIsPodOpen(false)} />
            <PrintableDeliveryBillPreview
              open={isBillOpen}
              order={activeOrder}
              vehicle={activeVehicle}
              depot={billTracking?.depot ?? null}
              estimatedArrivalMinutes={billTracking?.estimated_arrival_minutes ?? null}
              isLoading={isBillLoading}
              error={billError}
              onClose={() => setIsBillOpen(false)}
            />
          </>
        )}
      </aside>
    </div>
  );
}

function Info({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 leading-6 text-slate-800 dark:text-slate-200">{value}</dd></div>;
}
