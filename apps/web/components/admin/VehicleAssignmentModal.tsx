'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { useI18n } from '@/context/I18nContext';
import type { AuthUser } from '@/lib/auth/contracts';
import type { Vehicle } from './api-contracts';

const areaOptions = [
  ['central', 'admin.assignment.areaCentral'],
  ['northwest', 'admin.assignment.areaNorthwest'],
  ['west', 'admin.assignment.areaWest'],
  ['east', 'admin.assignment.areaEast'],
  ['south', 'admin.assignment.areaSouth'],
] as const;

export function VehicleAssignmentModal({
  driver,
  vehicles,
  isSubmitting,
  open,
  onClose,
  onAssign,
}: {
  driver: AuthUser | null;
  vehicles: Vehicle[];
  isSubmitting: boolean;
  open: boolean;
  onClose: () => void;
  onAssign: (driverId: string, vehicleId: string, serviceArea: string | null, note: string | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [vehicleId, setVehicleId] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [note, setNote] = useState('');
  const availableVehicles = vehicles.filter(
    (vehicle) => vehicle.status === 'IDLE' && vehicle.driver_id === null,
  );

  useEffect(() => {
    if (open) {
      setVehicleId(availableVehicles[0]?.id ?? '');
      setServiceArea('');
      setNote('');
    }
  }, [open, vehicles]);

  if (!open || !driver) {
    return null;
  }
  const selectedDriver = driver;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onAssign(selectedDriver.id, vehicleId, serviceArea || null, note.trim() || null);
  }

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose(); }}>
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="vehicle-assignment-title">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">{t('admin.assignment.eyebrow')}</p>
            <h2 id="vehicle-assignment-title" className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{t('admin.assignment.title', { name: selectedDriver.full_name })}</h2>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-600 dark:hover:bg-slate-800 dark:hover:text-white" onClick={onClose} disabled={isSubmitting} aria-label={t('common.closeDialog')}>×</button>
        </header>

        <form className="space-y-5 p-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="assignment-vehicle">
            {t('admin.assignment.vehicle')} <span className="text-rose-600" aria-hidden="true">*</span>
            <select id="assignment-vehicle" className="mt-2 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required disabled={isSubmitting}>
              <option value="">{t('admin.assignment.selectVehicle')}</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.license_plate} · {vehicle.capacity_kg.toLocaleString()} kg · {vehicle.vehicle_type}</option>
              ))}
            </select>
            {availableVehicles.length === 0 && <small className="mt-1.5 block text-xs text-amber-700 dark:text-amber-300">{t('admin.assignment.noAvailableVehicles')}</small>}
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="assignment-area">
            {t('admin.assignment.area')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
            <select id="assignment-area" className="mt-2 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} disabled={isSubmitting}>
              <option value="">{t('admin.assignment.selectArea')}</option>
              {areaOptions.map(([value, labelKey]) => <option key={value} value={t(labelKey)}>{t(labelKey)}</option>)}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="assignment-note">
            {t('admin.assignment.note')} <span className="font-normal text-slate-400">({t('common.optional')})</span>
            <textarea id="assignment-note" className="mt-2 block min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('admin.assignment.notePlaceholder')} maxLength={2000} disabled={isSubmitting} />
          </label>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
            <button type="button" className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</button>
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={!vehicleId || isSubmitting}>
              {isSubmitting && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />}
              {isSubmitting ? t('admin.assignment.assigning') : t('admin.assignment.confirm')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
