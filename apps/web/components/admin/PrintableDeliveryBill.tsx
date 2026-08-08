'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';

import { useI18n } from '@/context/I18nContext';
import type { PublicTrackingResponse } from '@/components/public/tracking-contracts';
import type { Order, Vehicle } from './api-contracts';

type Depot = PublicTrackingResponse['depot'];

export function PrintableDeliveryBillPreview({
  open,
  order,
  vehicle,
  depot,
  estimatedArrivalMinutes,
  isLoading,
  error,
  onClose,
}: {
  open: boolean;
  order: Order | null;
  vehicle: Vehicle | null;
  depot: Depot | null;
  estimatedArrivalMinutes: number | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open || !order || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="delivery-bill-print-root fixed inset-0 z-[1300] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={t('bill.close')}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-auto max-w-[210mm] overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <header className="delivery-bill-print-controls sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{t('bill.previewEyebrow')}</p>
            <h2 id={titleId} className="mt-1 text-lg font-bold text-slate-950">{t('bill.previewTitle')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              onClick={() => window.print()}
            >
              {t('bill.printNow')}
            </button>
            <button
              ref={closeRef}
              type="button"
              className="grid size-10 place-items-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
              aria-label={t('bill.close')}
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid min-h-80 place-items-center p-10 text-sm font-medium text-slate-500" role="status" aria-busy="true">
            {t('bill.loading')}
          </div>
        ) : error || !depot ? (
          <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
            {error ?? t('bill.loadError')}
          </div>
        ) : (
          <PrintableDeliveryBill
            order={order}
            vehicle={vehicle}
            depot={depot}
            estimatedArrivalMinutes={estimatedArrivalMinutes}
          />
        )}
      </section>
    </div>,
    document.body,
  );
}

export function PrintableDeliveryBill({
  order,
  vehicle,
  depot,
  estimatedArrivalMinutes,
}: {
  order: Order;
  vehicle: Vehicle | null;
  depot: Depot;
  estimatedArrivalMinutes: number | null;
}) {
  const { locale, t } = useI18n();
  const trackingUrl = typeof window === 'undefined'
    ? `/track/${order.tracking_token}`
    : `${window.location.origin}/track/${order.tracking_token}`;
  const numberFormatter = new Intl.NumberFormat(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { maximumFractionDigits: 1 },
  );
  const expectedDelivery = estimatedArrivalMinutes === null
    ? t('bill.notAvailable')
    : new Intl.DateTimeFormat(
      locale === 'vi' ? 'vi-VN' : 'en-US',
      { dateStyle: 'short', timeStyle: 'short' },
    ).format(new Date(Date.now() + estimatedArrivalMinutes * 60_000));

  return (
    <article className="delivery-bill-paper break-inside-avoid bg-white p-6 text-slate-950 sm:p-10">
      <header className="grid gap-6 border-b-2 border-slate-900 pb-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-xl bg-teal-600 text-lg font-black text-white">LR</span>
            <div>
              <strong className="text-xl font-black tracking-tight">LogiRoute VN</strong>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Smart Logistics Platform</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{t('bill.carrier')}</p>
          <p className="mt-1 text-sm text-slate-600">{t('bill.support')}: 1900 636 099</p>
        </div>
        <div className="flex items-start gap-4 sm:text-right">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{t('bill.orderCode')}</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{order.order_code}</p>
            <p className="mt-2 text-xs text-slate-500">{t('bill.scanTracking')}</p>
          </div>
          <QRCodeSVG
            value={trackingUrl}
            size={112}
            level="M"
            marginSize={4}
            title={t('bill.qrTitle', { code: order.order_code })}
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <BillCard title={t('bill.origin')}>
          <BillRow label={t('bill.depotName')} value={depot.name} />
          <BillRow label={t('bill.address')} value={depot.address} />
        </BillCard>
        <BillCard title={t('bill.recipient')}>
          <BillRow label={t('bill.fullName')} value={order.customer_name} />
          <BillRow label={t('bill.phone')} value={order.customer_phone ?? t('bill.notAvailable')} />
          <BillRow label={t('bill.address')} value={order.address} />
        </BillCard>
        <BillCard title={t('bill.goods')}>
          <BillRow label={t('bill.weight')} value={`${numberFormatter.format(order.weight_kg)} kg`} />
          <BillRow label={t('bill.note')} value={order.delivery_note ?? t('bill.notAvailable')} />
          <BillRow label={t('bill.estimatedDelivery')} value={expectedDelivery} />
        </BillCard>
        <BillCard title={t('bill.transport')}>
          <BillRow label={t('bill.driver')} value={vehicle?.driver_name ?? t('bill.notAvailable')} />
          <BillRow label={t('bill.vehicle')} value={vehicle?.license_plate ?? t('bill.notAvailable')} />
          <BillRow label={t('bill.region')} value={order.delivery_region ?? t('bill.notAvailable')} />
        </BillCard>
      </section>

      <section className="mt-6 break-inside-avoid" aria-labelledby="bill-confirmation-heading">
        <h3 id="bill-confirmation-heading" className="border-b border-slate-300 pb-2 text-sm font-black uppercase tracking-[0.14em]">{t('bill.confirmation')}</h3>
        <div className="grid grid-cols-3 gap-4 pt-4 text-center text-xs sm:text-sm">
          <SignatureBox title={t('bill.senderSignature')} />
          <SignatureBox title={t('bill.driverSignature')} name={vehicle?.driver_name ?? undefined} />
          <SignatureBox
            title={t('bill.recipientSignature')}
            name={order.recipient_name ?? undefined}
            imageUrl={order.signature_url ?? undefined}
          />
        </div>
      </section>

      {order.pod_url && (
        <section className="mt-6 break-inside-avoid border-t border-slate-300 pt-5">
          <h3 className="text-sm font-black uppercase tracking-[0.14em]">{t('bill.podEvidence')}</h3>
          <img
            className="mt-3 max-h-64 w-full rounded-lg border border-slate-300 object-contain"
            src={order.pod_url}
            alt={t('bill.podAlt', { code: order.order_code })}
          />
        </section>
      )}

      <footer className="mt-6 border-t border-slate-300 pt-4 text-center text-xs text-slate-500">
        {t('bill.footer')}
      </footer>
    </article>
  );
}

function BillCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-lg border border-slate-300 p-4">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">{title}</h3>
      <dl className="mt-3 space-y-2">{children}</dl>
    </section>
  );
}

function BillRow({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 text-sm leading-5 text-slate-900">{value}</dd></div>;
}

function SignatureBox({
  title,
  name,
  imageUrl,
}: {
  title: string;
  name?: string;
  imageUrl?: string;
}) {
  return (
    <div className="flex min-h-40 flex-col rounded-lg border border-slate-300 p-3">
      <strong>{title}</strong>
      <div className="grid flex-1 place-items-center py-3">
        {imageUrl && <img className="max-h-20 w-full object-contain" src={imageUrl} alt={title} />}
      </div>
      <span className="border-t border-dashed border-slate-400 pt-2 font-semibold">{name ?? ' '}</span>
    </div>
  );
}
