import type { OptimizationResult } from './types';
import { useI18n } from '@/context/I18nContext';

export function RouteCostSummary({
  result,
  onExport,
}: {
  result: OptimizationResult | null;
  onExport: () => void;
}) {
  const { locale, t } = useI18n();
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  const currencyFormatter = new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  });
  const numberFormatter = new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 1,
  });

  return (
    <section className="border-t border-slate-200 px-4 py-4 dark:border-slate-800" aria-labelledby="route-cost-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">{t('map.routeCost')}</p>
          <h3 id="route-cost-title" className="mt-1 font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('map.routeCost')}</h3>
        </div>
        <button
          type="button"
          className="rounded-sm border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-amber-700 dark:hover:text-amber-300"
          onClick={onExport}
          disabled={!result || result.routes.length === 0}
        >
          ↓ {t('map.exportCsv')}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <article className="rounded-sm bg-slate-50 p-2.5 dark:bg-slate-950/60">
          <span className="block text-[10px] text-slate-500 dark:text-slate-400">{t('map.totalCost')}</span>
          <strong className="mt-1 block truncate text-xs text-slate-950 dark:text-white" title={result ? currencyFormatter.format(result.cost_metrics.total_cost_vnd) : undefined}>
            {result ? currencyFormatter.format(result.cost_metrics.total_cost_vnd) : '—'}
          </strong>
        </article>
        <article className="rounded-sm bg-emerald-50 p-2.5 dark:bg-emerald-950/30">
          <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">{t('map.aiSavings')}</span>
          <strong className="mt-1 block truncate text-xs text-emerald-800 dark:text-emerald-300">
            {result ? currencyFormatter.format(result.cost_metrics.estimated_savings_vnd) : '—'}
          </strong>
        </article>
        <article className="rounded-sm bg-slate-50 p-2.5 dark:bg-slate-950/60">
          <span className="block text-[10px] text-slate-500 dark:text-slate-400">{t('map.co2Emissions')}</span>
          <strong className="mt-1 block text-xs text-slate-950 dark:text-white">
            {result ? `${numberFormatter.format(result.cost_metrics.co2_emissions_kg)} kg` : '—'}
          </strong>
        </article>
      </div>
    </section>
  );
}
