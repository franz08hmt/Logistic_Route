'use client';

import { useDepot } from '@/context/DepotContext';
import { useI18n } from '@/context/I18nContext';

export function DepotSwitcher({ compact = false }: { compact?: boolean }) {
  const { depots, selectedDepot, isLoading, error, selectDepot } = useDepot();
  const { t } = useI18n();

  return (
    <div className={compact ? 'min-w-0' : 'w-full'}>
      <label className="sr-only" htmlFor={compact ? 'depot-switcher-mobile' : 'depot-switcher'}>
        {t('depots.switchLabel')}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-cinema-accent" aria-hidden="true">
          ●
        </span>
        <select
          id={compact ? 'depot-switcher-mobile' : 'depot-switcher'}
          className={`min-h-10 appearance-none rounded-sm border border-cinema-line bg-cinema-700 pl-7 pr-8 text-xs font-semibold text-slate-100 outline-none transition focus:border-cinema-accent focus:ring-2 focus:ring-cinema-accent/25 ${compact ? 'max-w-44' : 'w-full'}`}
          value={selectedDepot?.id ?? ''}
          onChange={(event) => selectDepot(event.target.value)}
          disabled={isLoading || depots.length === 0}
          aria-describedby={error ? 'depot-switcher-error' : undefined}
        >
          {!selectedDepot && <option value="">{t('depots.loading')}</option>}
          {depots.map((depot) => (
            <option key={depot.id} value={depot.id}>
              {depot.city} · {depot.code}
            </option>
          ))}
        </select>
        <span className="console-chrome-muted pointer-events-none absolute inset-y-0 right-3 flex items-center" aria-hidden="true">⌄</span>
      </div>
      {error && <p className="mt-1 text-[10px] text-rose-300" id="depot-switcher-error">{t('depots.loadError')}</p>}
    </div>
  );
}
