'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { requestApi } from '@/components/admin/api-contracts';
import { publishDataInvalidated } from '@/components/admin/orders-sync';
import {
  isDepotList,
  selectInitialDepot,
  type Depot,
} from '@/components/depot-contracts';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'logiroute:selected-depot-id';

type DepotContextValue = {
  depots: Depot[];
  selectedDepot: Depot | null;
  isLoading: boolean;
  error: string | null;
  selectDepot: (depotId: string) => void;
  refreshDepots: () => Promise<void>;
};

const DepotContext = createContext<DepotContextValue | null>(null);

export function DepotProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [selectedDepot, setSelectedDepot] = useState<Depot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDepots = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload = await requestApi('/api/v1/depots');
      if (!isDepotList(payload)) throw new Error('Invalid depot response');
      const storedId = window.localStorage.getItem(STORAGE_KEY);
      const nextSelected = selectInitialDepot(payload, storedId);
      setDepots(payload);
      setSelectedDepot(nextSelected);
      if (nextSelected) window.localStorage.setItem(STORAGE_KEY, nextSelected.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load depots');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setDepots([]);
      setSelectedDepot(null);
      return;
    }
    void refreshDepots();
  }, [isAuthLoading, isAuthenticated, refreshDepots]);

  const selectDepot = useCallback((depotId: string) => {
    const nextDepot = depots.find((depot) => depot.id === depotId);
    if (!nextDepot) return;
    setSelectedDepot(nextDepot);
    window.localStorage.setItem(STORAGE_KEY, nextDepot.id);
    publishDataInvalidated([
      'orders',
      'fleet',
      'overview',
      'driver',
      'analytics',
    ]);
  }, [depots]);

  const value = useMemo<DepotContextValue>(() => ({
    depots,
    selectedDepot,
    isLoading,
    error,
    selectDepot,
    refreshDepots,
  }), [depots, error, isLoading, refreshDepots, selectDepot, selectedDepot]);

  return <DepotContext.Provider value={value}>{children}</DepotContext.Provider>;
}

export function useDepot(): DepotContextValue {
  const context = useContext(DepotContext);
  if (!context) throw new Error('useDepot must be used inside DepotProvider');
  return context;
}
