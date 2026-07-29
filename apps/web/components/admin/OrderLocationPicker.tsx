'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useRef, useState } from 'react';

import { useI18n } from '@/context/I18nContext';
import { shouldRequestAddressSuggestions } from './address-search-state';
import {
  geocodingResultToLocation,
  isGeocodingResultList,
  type GeocodingResult,
  type OrderLocationValue,
} from './geocoding-contracts';
import { fieldInputClass, fieldLabelClass } from './form-styles';

const OrderLocationMap = dynamic(
  () => import('./OrderLocationMap').then((module) => module.OrderLocationMap),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800" /> },
);

export type OrderLocation = OrderLocationValue;

const defaultLocation: OrderLocation = {
  address: '',
  latitude: 10.7769,
  longitude: 106.7009,
  region: '',
};

export function OrderLocationPicker({
  value = defaultLocation,
  onChange,
}: {
  value?: OrderLocation;
  onChange: (location: OrderLocation) => void;
}) {
  const { t } = useI18n();
  const listboxId = useId();
  const [query, setQuery] = useState(value.address);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const selectedAddressRef = useRef<string | null>(
    value.address.trim() || null,
  );

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!shouldRequestAddressSuggestions({
      query: normalizedQuery,
      selectedAddress: selectedAddressRef.current,
    })) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const searchParameters = new URLSearchParams({ q: normalizedQuery });
        const response = await fetch(`/api/geocoding/search?${searchParameters}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !isGeocodingResultList(payload)) {
          throw new Error(t('orders.geocodingUnavailable'));
        }
        setResults(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setSearchError(error instanceof Error ? error.message : t('orders.geocodingUnavailable'));
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, t]);

  function selectResult(result: GeocodingResult) {
    setSearchError(null);
    setResults([]);
    // Geoapify autocomplete returns a validated address and coordinates in
    // one response, so the selected result can be bound atomically to the form.
    const location = geocodingResultToLocation(result, null);
    selectedAddressRef.current = result.formatted_address.trim();
    setQuery(result.formatted_address);
    onChange(location);
  }

  return (
    <section className="space-y-3 sm:col-span-2" aria-labelledby="delivery-location-title">
      <div className="relative">
        <label className={fieldLabelClass} htmlFor="delivery-address-search">
          <span id="delivery-location-title">{t('orders.addressSearch')}</span>
          <input
            id="delivery-address-search"
            className={fieldInputClass}
            type="search"
            value={query}
            onChange={(event) => {
              selectedAddressRef.current = null;
              setQuery(event.target.value);
              onChange({ ...value, address: event.target.value });
            }}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={results.length > 0}
            aria-busy={isSearching}
            placeholder={t('orders.addressSearchPlaceholder')}
            required
          />
        </label>
        {isSearching && <span className="absolute bottom-3 right-3 size-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" aria-label={t('orders.searchingAddress')} />}
        {results.length > 0 && (
          <ul id={listboxId} className="absolute z-[1300] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900" role="listbox">
            {results.map((result) => (
              <li key={result.id} role="option" aria-selected="false">
                <button className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600 dark:text-slate-200 dark:hover:bg-teal-950/40" type="button" onClick={() => selectResult(result)}>
                  {result.formatted_address}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {searchError && <p className="text-xs text-amber-700 dark:text-amber-300" role="status">{searchError} {t('orders.pinFallback')}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" aria-label={t('orders.locationMap')}>
        <OrderLocationMap
          position={value}
          onChange={(coordinates) => onChange({ ...value, ...coordinates })}
        />
      </div>
      <p className="text-right text-[11px] text-slate-500 dark:text-slate-400">
        <a
          className="underline underline-offset-2 hover:text-teal-700 dark:hover:text-teal-300"
          href="https://www.geoapify.com/"
          rel="noreferrer"
          target="_blank"
        >
          Powered by Geoapify
        </a>
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className={fieldLabelClass}>
          <span>{t('orders.deliveryRegion')}</span>
          <input className={fieldInputClass} value={value.region} onChange={(event) => onChange({ ...value, region: event.target.value })} placeholder={t('orders.deliveryRegionPlaceholder')} />
        </label>
        <div className="self-end rounded-xl bg-slate-50 px-3 py-2.5 text-xs tabular-nums text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
        </div>
      </div>
    </section>
  );
}
