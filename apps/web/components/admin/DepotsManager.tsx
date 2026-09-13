'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { ModalDialog } from '@/components/admin/ModalDialog';
import { requestApi } from '@/components/admin/api-contracts';
import { isDepot, isValidDepotCoordinates } from '@/components/depot-contracts';
import { useDepot } from '@/context/DepotContext';
import { useI18n } from '@/context/I18nContext';

const DepotLocationMap = dynamic(
  () => import('./DepotLocationMap').then((module) => module.DepotLocationMap),
  { ssr: false },
);

const INITIAL_FORM = {
  code: '',
  name: '',
  city: '',
  address: '',
  latitude: 10.8671,
  longitude: 106.6412,
  is_default: false,
};

export function DepotsManager() {
  const { depots, refreshDepots } = useDepot();
  const { locale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 1 }),
    [locale],
  );

  async function createDepot() {
    if (!isValidDepotCoordinates(form)) {
      setError(t('depots.invalidCoordinates'));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = await requestApi('/api/v1/depots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!isDepot(payload)) throw new Error(t('depots.invalidResponse'));
      await refreshDepots();
      setForm(INITIAL_FORM);
      setIsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('depots.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="depots-list-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="depots-list-heading" className="font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('depots.listTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('depots.listDescription', { count: depots.length })}</p>
        </div>
        <button type="button" className="min-h-11 rounded-sm bg-amber-700 dark:bg-amber-400 px-4 text-sm font-semibold text-white dark:text-slate-950 hover:bg-amber-800 dark:hover:bg-amber-300" onClick={() => setIsOpen(true)}>
          {t('depots.add')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {depots.map((depot) => (
          <article key={depot.id} className="rounded-sm border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">{depot.code}</span>
                <h3 className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{depot.name}</h3>
              </div>
              {depot.is_default && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">{t('depots.default')}</span>}
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">{depot.city}</p>
            <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">{depot.address}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
              <div><dt className="text-slate-500 dark:text-slate-400">{t('depots.vehicles')}</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{depot.vehicle_count}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">{t('depots.activeOrders')}</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{depot.active_orders_count}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500 dark:text-slate-400">{t('depots.totalCapacity')}</dt><dd className="mt-1 font-bold text-slate-900 dark:text-white">{numberFormatter.format(depot.total_vehicle_capacity_kg)} kg</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <ModalDialog open={isOpen} onClose={() => setIsOpen(false)} eyebrow={t('depots.formEyebrow')} title={t('depots.formTitle')} description={t('depots.formDescription')}>
        <form className="max-h-[calc(100vh-12rem)] space-y-4 overflow-y-auto p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); void createDepot(); }}>
          {error && <p role="alert" className="rounded-sm border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {(['code', 'name', 'city', 'address'] as const).map((field) => (
              <label key={field} className={field === 'address' ? 'text-sm font-medium sm:col-span-2' : 'text-sm font-medium'}>
                {t(`depots.fields.${field}`)}
                <input required className="mt-2 h-11 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: field === 'code' ? event.target.value.toUpperCase() : event.target.value }))} />
              </label>
            ))}
            <label className="text-sm font-medium">{t('depots.fields.latitude')}<input required type="number" step="any" min="-90" max="90" className="mt-2 h-11 w-full rounded-sm border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" value={form.latitude} onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setForm((current) => ({ ...current, latitude: value })); }} /></label>
            <label className="text-sm font-medium">{t('depots.fields.longitude')}<input required type="number" step="any" min="-180" max="180" className="mt-2 h-11 w-full rounded-sm border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" value={form.longitude} onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setForm((current) => ({ ...current, longitude: value })); }} /></label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('depots.mapHint')}</p>
          <DepotLocationMap active={isOpen} position={{ latitude: form.latitude, longitude: form.longitude }} onChange={(position) => setForm((current) => ({ ...current, ...position }))} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-amber-600" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} />{t('depots.fields.isDefault')}</label>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800"><button type="button" className="min-h-10 rounded-sm border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700" onClick={() => setIsOpen(false)}>{t('common.cancel')}</button><button type="submit" disabled={isSubmitting} className="min-h-10 rounded-sm bg-amber-700 dark:bg-amber-400 px-4 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-60">{isSubmitting ? t('depots.creating') : t('depots.create')}</button></div>
        </form>
      </ModalDialog>
    </section>
  );
}
