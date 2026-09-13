'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDepot } from '@/context/DepotContext';
import { useI18n } from '@/context/I18nContext';

import {
  COD_STATUSES,
  SETTLEMENT_STATUSES,
  fetchCodLedger,
  fetchCodSummary,
  fetchShiftSettlements,
  type CodLedgerItem,
  type CodStatus,
  type CodSummary,
  type SettlementStatus,
  type ShiftSettlement,
} from './cod-contracts';
import {
  codStatusTone,
  downloadCodLedgerCsv,
  formatVnd,
  formatVndCompact,
  settlementVariance,
} from './cod-format';
import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  InboxArrowDownIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

import { PillButton, SearchField, SelectField } from '../ui/Controls';
import { StatTile } from '../ui/StatTile';
import { SettlementReviewModal } from './SettlementReviewModal';

type CodTab = 'settlements' | 'ledger';

export function CodReconciliationCenter() {
  const { t, locale } = useI18n();
  const { selectedDepot } = useDepot();
  const [tab, setTab] = useState<CodTab>('settlements');
  const [nationwide, setNationwide] = useState(false);
  const [summary, setSummary] = useState<CodSummary | null>(null);
  const [settlements, setSettlements] = useState<ShiftSettlement[]>([]);
  const [ledger, setLedger] = useState<CodLedgerItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | ''>('');
  const [codStatusFilter, setCodStatusFilter] = useState<CodStatus | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ShiftSettlement | null>(null);
  const [reviewApproving, setReviewApproving] = useState(true);

  const scope = useMemo(
    () => ({ depotId: selectedDepot?.id ?? null, nationwide }),
    [selectedDepot?.id, nationwide],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextSummary, nextSettlements, nextLedger] = await Promise.all([
        fetchCodSummary(scope),
        fetchShiftSettlements(scope, statusFilter || undefined),
        fetchCodLedger({
          ...scope,
          codStatus: codStatusFilter || undefined,
          search,
        }),
      ]);
      setSummary(nextSummary);
      setSettlements(nextSettlements);
      setLedger(nextLedger);
    } catch {
      setError(t('cod.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [scope, statusFilter, codStatusFilter, search, t]);

  useEffect(() => {
    // Debounced so typing in the ledger search does not fire a request per key.
    const timer = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const handleExport = () => {
    downloadCodLedgerCsv(ledger, {
      orderCode: t('cod.ledger.orderCode'),
      customer: t('cod.ledger.customer'),
      address: t('cod.ledger.address'),
      depot: t('cod.ledger.depot'),
      vehicle: t('cod.ledger.vehicle'),
      driver: t('cod.ledger.driver'),
      orderStatus: t('cod.ledger.orderStatus'),
      amount: t('cod.ledger.amount'),
      paymentMethod: t('cod.ledger.paymentMethod'),
      codStatus: t('cod.ledger.codStatus'),
      collectedAt: t('cod.ledger.collectedAt'),
      reconciledAt: t('cod.ledger.reconciledAt'),
      settlementCode: t('cod.ledger.settlementCode'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-sm bg-slate-100 p-1 dark:bg-slate-800">
          <ScopeButton
            active={!nationwide}
            label={selectedDepot ? selectedDepot.name : t('cod.scope.hub')}
            onClick={() => setNationwide(false)}
          />
          <ScopeButton
            active={nationwide}
            label={t('cod.scope.nationwide')}
            onClick={() => setNationwide(true)}
          />
        </div>
        <PillButton
          onClick={handleExport}
          disabled={ledger.length === 0}
          icon={<ArrowDownTrayIcon aria-hidden="true" className="size-4" />}
        >
          {t('cod.export.action')}
        </PillButton>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
          <button
            type="button"
            className="rounded-sm border border-rose-300 px-3 py-1.5 text-xs font-bold dark:border-rose-800"
            onClick={load}
          >
            {t('cod.retry')}
          </button>
        </div>
      )}

      <section
        aria-label={t('cod.title')}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatTile
          icon={<BanknotesIcon aria-hidden="true" className="size-5" />}
          tone="neutral"
          label={t('cod.summary.expected')}
          value={summary ? formatVndCompact(summary.total_cod_expected, locale) : '—'}
          hint={
            summary
              ? t('cod.summary.pendingOrders', { count: summary.pending_orders_count })
              : t('cod.summary.expectedHint')
          }
        />
        <StatTile
          icon={<TruckIcon aria-hidden="true" className="size-5" />}
          tone="warning"
          label={t('cod.summary.cashInHand')}
          value={summary ? formatVndCompact(summary.total_cash_in_hand, locale) : '—'}
          hint={t('cod.summary.cashInHandHint')}
        />
        <StatTile
          icon={<BuildingLibraryIcon aria-hidden="true" className="size-5" />}
          tone="info"
          label={t('cod.summary.vietqr')}
          value={summary ? formatVndCompact(summary.total_vietqr_paid, locale) : '—'}
          hint={t('cod.summary.vietqrHint')}
        />
        <StatTile
          icon={<InboxArrowDownIcon aria-hidden="true" className="size-5" />}
          tone="accent"
          label={t('cod.summary.reconciled')}
          value={summary ? formatVndCompact(summary.total_reconciled, locale) : '—'}
          hint={
            summary
              ? t('cod.summary.pendingSettlements', {
                  count: summary.pending_settlements_count,
                })
              : t('cod.summary.reconciledHint')
          }
        />
      </section>

      <div className="grid grid-cols-2 rounded-sm bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        <TabButton
          active={tab === 'settlements'}
          label={t('cod.tabs.settlements')}
          onClick={() => setTab('settlements')}
        />
        <TabButton
          active={tab === 'ledger'}
          label={t('cod.tabs.ledger')}
          onClick={() => setTab('ledger')}
        />
      </div>

      {isLoading && (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" role="status">
          {t('cod.loading')}
        </p>
      )}

      {!isLoading && tab === 'settlements' && (
        <section className="space-y-4" aria-labelledby="cod-settlements-heading">
          {/* The tab button already names this panel on screen, so the heading
              exists for the document outline and assistive technology only. */}
          <h2 className="sr-only" id="cod-settlements-heading">
            {t('cod.tabs.settlements')}
          </h2>
          <search className="max-w-xs">
            <SelectField
              compact
              label={t('cod.settlements.status')}
              value={statusFilter}
              onChange={(next) => setStatusFilter(next as SettlementStatus | '')}
            >
              <option value="">{t('cod.settlements.filterAll')}</option>
              {SETTLEMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`cod.status.${value}`)}
                </option>
              ))}
            </SelectField>
          </search>

          {settlements.length === 0 ? (
            <EmptyState message={t('cod.settlements.empty')} />
          ) : (
            <ul className="space-y-3">
              {settlements.map((settlement) => (
                <SettlementCard
                  key={settlement.id}
                  settlement={settlement}
                  onReview={(approving) => {
                    setReviewApproving(approving);
                    setReviewTarget(settlement);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {!isLoading && tab === 'ledger' && (
        <section className="space-y-4" aria-labelledby="cod-ledger-heading">
          <h2 className="sr-only" id="cod-ledger-heading">
            {t('cod.tabs.ledger')}
          </h2>
          <search className="grid items-end gap-3 sm:grid-cols-2">
            <SearchField
              hideLabel={false}
              label={t('cod.ledger.searchPlaceholder')}
              value={search}
              onChange={setSearch}
            />
            <SelectField
              label={t('cod.ledger.codStatus')}
              value={codStatusFilter}
              onChange={(next) => setCodStatusFilter(next as CodStatus | '')}
            >
              <option value="">{t('cod.ledger.filterAll')}</option>
              {COD_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`cod.codStatus.${value}`)}
                </option>
              ))}
            </SelectField>
          </search>

          {ledger.length === 0 ? (
            <EmptyState message={t('cod.ledger.empty')} />
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {t('cod.ledger.count', { count: ledger.length })}
              </p>
              <div className="overflow-x-auto rounded-sm border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3">{t('cod.ledger.orderCode')}</th>
                      <th className="px-4 py-3">{t('cod.ledger.customer')}</th>
                      <th className="px-4 py-3">{t('cod.ledger.vehicle')}</th>
                      <th className="px-4 py-3 text-right">{t('cod.ledger.amount')}</th>
                      <th className="px-4 py-3">{t('cod.ledger.paymentMethod')}</th>
                      <th className="px-4 py-3">{t('cod.ledger.codStatus')}</th>
                      <th className="px-4 py-3">{t('cod.ledger.settlementCode')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {ledger.map((item) => (
                      <tr key={item.order_id}>
                        <td className="px-4 py-3 font-bold">{item.order_code}</td>
                        <td className="px-4 py-3">
                          <span className="block">{item.customer_name}</span>
                          <span className="block max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                            {item.address}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">{item.license_plate ?? '—'}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {item.driver_name ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {formatVnd(item.cod_amount, locale)}
                        </td>
                        <td className="px-4 py-3">
                          {t(`cod.paymentMethod.${item.payment_method}`)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-sm px-2.5 py-1 text-xs font-bold ${codStatusTone(item.cod_status)}`}
                          >
                            {t(`cod.codStatus.${item.cod_status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {item.settlement_code ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <SettlementReviewModal
        settlement={reviewTarget}
        approving={reviewApproving}
        onClose={() => setReviewTarget(null)}
        onReviewed={() => {
          setReviewTarget(null);
          void load();
        }}
      />
    </div>
  );
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-sm px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-white text-cinema-accent-ink dark:bg-slate-950 dark:text-cinema-accent'
          : 'text-slate-500 dark:text-slate-400'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`rounded-sm px-3 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-white text-cinema-accent-ink dark:bg-slate-950 dark:text-cinema-accent'
          : 'text-slate-500 dark:text-slate-400'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="rounded-sm border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900"
    >
      {message}
    </p>
  );
}

function SettlementCard({
  settlement,
  onReview,
}: {
  settlement: ShiftSettlement;
  onReview: (approving: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const variance = settlementVariance(settlement);
  const isPending = settlement.status === 'SUBMITTED';

  return (
    <li className="rounded-sm border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {t('cod.settlements.code')}
          </p>
          <h3 className="mt-0.5 font-black tracking-tight text-base uppercase tracking-[0.14em]">
            {settlement.settlement_code}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {settlement.driver_name ?? '—'} · {settlement.license_plate ?? '—'} ·{' '}
            {settlement.depot_name ?? '—'}
          </p>
        </div>
        <span
          className={`rounded-sm px-3 py-1.5 text-xs font-bold ${
            settlement.status === 'APPROVED'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
              : settlement.status === 'REJECTED'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
                : 'bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200'
          }`}
        >
          {t(`cod.status.${settlement.status}`)}
        </span>
      </header>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t('cod.settlements.orders')}
          value={t('cod.settlements.deliveredFailed', {
            delivered: settlement.delivered_count,
            failed: settlement.failed_count,
          })}
        />
        <Metric
          label={t('cod.settlements.expectedCash')}
          value={formatVnd(settlement.expected_cash_amount, locale)}
        />
        <Metric
          label={t('cod.settlements.declaredCash')}
          value={formatVnd(settlement.total_cash_collected, locale)}
        />
        <Metric
          label={t('cod.settlements.variance')}
          value={
            variance === 'balanced'
              ? t('cod.variance.balanced')
              : t(`cod.variance.${variance}`, {
                  amount: formatVnd(Math.abs(settlement.variance_amount), locale),
                })
          }
          tone={variance === 'balanced' ? 'ok' : 'warn'}
        />
      </dl>

      {settlement.notes && (
        <p className="mt-3 rounded-sm bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
          <strong className="font-semibold">{t('cod.settlements.notes')}:</strong>{' '}
          {settlement.notes}
        </p>
      )}
      {settlement.review_note && (
        <p className="mt-2 rounded-sm bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
          <strong className="font-semibold">{t('cod.settlements.reviewNote')}:</strong>{' '}
          {settlement.review_note}
          {settlement.approved_by_name && (
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t('cod.settlements.reviewedBy')}: {settlement.approved_by_name}
            </span>
          )}
        </p>
      )}

      {isPending && (
        <footer className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-sm bg-amber-700 dark:bg-amber-400 px-5 text-sm font-bold text-white dark:text-slate-950 transition hover:bg-amber-800 dark:hover:bg-amber-300"
            onClick={() => onReview(true)}
          >
            ✓ {t('cod.settlements.approve')}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-sm border border-rose-300 px-5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
            onClick={() => onReview(false)}
          >
            {t('cod.settlements.reject')}
          </button>
        </footer>
      )}
    </li>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm font-bold tabular-nums ${
          tone === 'warn'
            ? 'text-rose-600 dark:text-rose-400'
            : tone === 'ok'
              ? 'text-amber-700 dark:text-amber-300'
              : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
