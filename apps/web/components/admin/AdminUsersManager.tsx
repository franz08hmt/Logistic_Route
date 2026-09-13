'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { apiFetch } from '@/lib/api-client';
import type { AuthUser, UserStatus } from '@/lib/auth/contracts';
import { UserStatusBadge } from './UserStatusBadge';
import { VehicleAssignmentModal } from './VehicleAssignmentModal';
import { isVehicleList, type Vehicle } from './api-contracts';
import { publishDataInvalidated } from './orders-sync';
import { isAdminUserList, nextAccountAction } from './user-management';

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function AdminUsersManager() {
  const { user: currentUser } = useAuth();
  const { locale, t } = useI18n();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<AuthUser | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const loadUsers = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const [usersResponse, vehiclesResponse] = await Promise.all([
        apiFetch('/api/v1/admin/users'),
        apiFetch('/api/v1/vehicles'),
      ]);
      const [payload, vehiclesPayload] = await Promise.all([
        readPayload(usersResponse),
        readPayload(vehiclesResponse),
      ]);
      if (!usersResponse.ok || !vehiclesResponse.ok) {
        throw new Error(t('admin.users.loadError'));
      }
      if (!isAdminUserList(payload) || !isVehicleList(vehiclesPayload)) {
        throw new Error(t('admin.users.invalidList'));
      }
      setUsers(payload);
      setVehicles(vehiclesPayload);
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('admin.users.loadError'),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function updateStatus(target: AuthUser, status: UserStatus) {
    setUpdatingId(target.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        `/api/v1/admin/users/${target.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      const payload = await readPayload(response);
      const updatedUsers = [payload];
      if (!response.ok || !isAdminUserList(updatedUsers)) {
        throw new Error(t('admin.users.updateError'));
      }
      const updatedUser = updatedUsers[0];
      setUsers((current) =>
        current.map((item) => (item.id === target.id ? updatedUser : item)),
      );
      setNotice(
        t(
          status === 'ACTIVE'
            ? 'admin.users.approveSuccess'
            : 'admin.users.suspendSuccess',
          { name: target.full_name },
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('admin.users.updateError'),
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleAssignVehicle(
    driverId: string,
    vehicleId: string,
    serviceArea: string | null,
    assignmentNote: string | null,
  ) {
    setIsAssigning(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(`/api/v1/admin/users/${driverId}/vehicle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          service_area: serviceArea,
          assignment_note: assignmentNote,
        }),
      });
      if (!response.ok) {
        const payload = await readPayload(response);
        throw new Error(
          payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string'
            ? payload.detail
            : t('admin.assignment.error'),
        );
      }
      const refreshed = await loadUsers();
      if (!refreshed) {
        throw new Error(t('admin.users.loadError'));
      }
      setSelectedDriver(null);
      setNotice(t('admin.assignment.success'));
      publishDataInvalidated(['fleet', 'driver', 'overview']);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('admin.assignment.error'),
      );
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="users-table-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="users-table-heading" className="font-bold text-slate-950 dark:text-white text-base uppercase tracking-[0.14em]">{t('admin.users.listTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('admin.users.total', { count: users.length })}</p>
        </div>
        <button type="button" className="h-10 rounded-sm border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-amber-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => void loadUsers()}>
          {t('admin.users.refresh')}
        </button>
      </div>

      {error && <p className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" role="alert">{error}</p>}
      {notice && <p className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300" role="status">{notice}</p>}

      <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:bg-slate-950/50">
            <tr>
              <th className="px-5 py-3" scope="col">{t('admin.users.user')}</th>
              <th className="px-5 py-3" scope="col">{t('admin.users.role')}</th>
              <th className="px-5 py-3" scope="col">{t('common.status')}</th>
              <th className="px-5 py-3" scope="col">{t('admin.users.createdAt')}</th>
              <th className="px-5 py-3 text-right" scope="col">{t('admin.users.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index} aria-hidden="true">
                  <td className="px-5 py-4" colSpan={5}><span className="block h-8 animate-pulse rounded-sm bg-slate-100 dark:bg-slate-800" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td className="px-5 py-12 text-center text-slate-500 dark:text-slate-400" colSpan={5}>{t('admin.users.empty')}</td></tr>
            ) : users.map((user) => {
              const nextStatus = nextAccountAction(user.status);
              const isSelf = currentUser?.id === user.id;
              return (
                <tr key={user.id} className="text-slate-700 dark:text-slate-300">
                  <td className="px-5 py-4">
                    <strong className="block text-slate-950 dark:text-white">{user.full_name}</strong>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{user.email}{user.phone_number ? ` · ${user.phone_number}` : ''}</span>
                  </td>
                  <td className="px-5 py-4 font-medium">{t(`admin.users.role.${user.role}`)}</td>
                  <td className="px-5 py-4"><UserStatusBadge status={user.status} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium' }).format(new Date(user.created_at))}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {user.role === 'DRIVER' && user.status === 'ACTIVE' && !vehicles.some((vehicle) => vehicle.driver_id === user.id) && (
                        <button type="button" className="rounded-sm bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950" onClick={() => setSelectedDriver(user)}>
                          {t('admin.assignment.assignVehicle')}
                        </button>
                      )}
                      {currentUser?.role === 'ADMIN' && (
                        <button type="button" className={`rounded-sm px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${nextStatus === 'ACTIVE' ? 'bg-amber-700 dark:bg-amber-400 text-white dark:text-slate-950 hover:bg-amber-800 dark:hover:bg-amber-300 focus-visible:outline-amber-600' : 'border border-rose-200 text-rose-700 hover:bg-rose-50 focus-visible:outline-rose-600 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40'}`} disabled={updatingId === user.id || isSelf} title={isSelf ? t('admin.users.selfActionDisabled') : undefined} onClick={() => void updateStatus(user, nextStatus)}>
                          {updatingId === user.id ? t('admin.users.updating') : t(nextStatus === 'ACTIVE' ? 'admin.users.approve' : 'admin.users.suspend')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <VehicleAssignmentModal
        driver={selectedDriver}
        vehicles={vehicles}
        open={selectedDriver !== null}
        isSubmitting={isAssigning}
        onClose={() => setSelectedDriver(null)}
        onAssign={handleAssignVehicle}
      />
    </section>
  );
}
