'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import {
  isOrderList,
  requestApi,
} from '@/components/admin/api-contracts';
import {
  publishDataInvalidated,
  publishOrdersUpdated,
  subscribeToDataInvalidated,
} from '@/components/admin/orders-sync';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';

import { DriverOverview } from './DriverOverview';
import { DriverStatusDialog } from './DriverStatusDialog';
import { DriverStopCard } from './DriverStopCard';
import { DriverUnassignedEmptyState } from './DriverUnassignedEmptyState';
import {
  createSignatureFormData,
  isSignatureUpload,
  validateSignatureBlob,
} from '@/components/admin/signature-contracts';
import {
  isDriverRoute,
  isDriverStop,
  type DriverOrderStatus,
  type DriverRoute,
  type DriverStop,
} from './driver-contracts';
import {
  isPodUpload,
  validateDriverUpdate,
  validatePodFile,
} from './driver-pod';
import { driverStatusTranslationKeys } from './driver-ui';
import type { SignaturePadHandle } from './SignaturePad';

type DriverToast = {
  code: string;
  status: DriverOrderStatus;
};

export function DriverWorkspace() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<DriverStop | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DriverOrderStatus>('DELIVERED');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [podUrl, setPodUrl] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podPreviewUrl, setPodPreviewUrl] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<DriverToast | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    async function loadRoute() {
      try {
        const payload = await requestApi('/api/v1/driver/route', {
          signal: controller.signal,
        });
        if (!isDriverRoute(payload)) {
          throw new Error(t('driver.invalidRoute'));
        }
        setRoute(payload);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : t('driver.loadError'),
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRoute();
    return () => controller.abort();
  }, [refreshVersion, t]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(
    () => subscribeToDataInvalidated(
      ['driver'],
      () => setRefreshVersion((version) => version + 1),
    ),
    [],
  );

  function openStatusDialog(stop: DriverStop) {
    setSelectedStop(stop);
    setSelectedStatus('DELIVERED');
    setDeliveryNote(stop.delivery_note ?? '');
    setPodUrl(stop.pod_url ?? '');
    setFailureReason(stop.failure_reason ?? '');
    setPodFile(null);
    setPodPreviewUrl(stop.pod_url ?? '');
    setRecipientName(stop.recipient_name ?? stop.customer_name);
    setHasDrawnSignature(false);
    setError(null);
  }

  function closeStatusDialog() {
    if (!isSubmitting) {
      if (podPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(podPreviewUrl);
      }
      setSelectedStop(null);
      setPodFile(null);
      setPodPreviewUrl('');
      setRecipientName('');
      setHasDrawnSignature(false);
    }
  }

  function refreshAssignment() {
    setRefreshVersion((version) => version + 1);
  }

  function handlePodFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    const validationError = validatePodFile(file);
    if (validationError) {
      setError(t(
        validationError === 'TOO_LARGE'
          ? 'driver.photoTooLarge'
          : 'driver.photoInvalid',
      ));
      event.target.value = '';
      return;
    }

    // Preview through a short-lived blob URL instead of converting the image
    // to base64. Old URLs are revoked to avoid leaking browser memory.
    if (podPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(podPreviewUrl);
    }
    setPodFile(file);
    setPodPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStop) {
      return;
    }

    const validationError = validateDriverUpdate({
      status: selectedStatus,
      hasExistingPod: Boolean(podUrl),
      hasSelectedFile: Boolean(podFile),
      hasExistingSignature: Boolean(selectedStop.signature_url),
      hasDrawnSignature,
      recipientName,
      failureReason,
    });
    if (validationError) {
      const validationMessage = {
        PHOTO_REQUIRED: 'driver.photoRequired',
        SIGNATURE_REQUIRED: 'signature.required',
        RECIPIENT_NAME_REQUIRED: 'signature.recipientRequired',
        FAILURE_REASON_REQUIRED: 'driver.failureReasonRequired',
      } as const;
      setError(t(validationMessage[validationError]));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const signatureBlob = selectedStatus === 'DELIVERED' && hasDrawnSignature
        ? await signaturePadRef.current?.toBlob() ?? null
        : null;
      if (hasDrawnSignature && !signatureBlob) {
        throw new Error(t('signature.exportError'));
      }
      if (signatureBlob) {
        const signatureError = validateSignatureBlob(signatureBlob);
        if (signatureError) {
          throw new Error(t(
            signatureError === 'TOO_LARGE'
              ? 'signature.tooLarge'
              : 'signature.invalid',
          ));
        }
      }

      const podUploadPromise = podFile
        ? requestApi(
          `/api/v1/driver/orders/${selectedStop.id}/pod`,
          {
            method: 'POST',
            headers: { 'Content-Type': podFile.type },
            body: podFile,
          },
        )
        : Promise.resolve(null);
      const signatureUploadPromise = signatureBlob
        ? requestApi(
          `/api/v1/driver/orders/${selectedStop.id}/signature`,
          {
            method: 'POST',
            body: createSignatureFormData(signatureBlob, recipientName),
          },
        )
        : Promise.resolve(null);
      const [podUpload, signatureUpload] = await Promise.all([
        podUploadPromise,
        signatureUploadPromise,
      ]);
      if (podUpload !== null && !isPodUpload(podUpload)) {
        throw new Error(t('driver.photoInvalid'));
      }
      if (signatureUpload !== null && !isSignatureUpload(signatureUpload)) {
        throw new Error(t('signature.invalidResponse'));
      }
      const resolvedPodUrl = podUpload?.pod_url ?? podUrl;

      const payload = await requestApi(
        `/api/v1/driver/orders/${selectedStop.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: selectedStatus,
            delivery_note: deliveryNote.trim() || null,
            failure_reason: selectedStatus === 'FAILED' ? failureReason : null,
            pod_url: resolvedPodUrl || null,
          }),
        },
      );
      if (!isDriverStop(payload)) {
        throw new Error(t('driver.invalidStatus'));
      }

      setRoute((currentRoute) => {
        if (!currentRoute) {
          return currentRoute;
        }
        const stops = currentRoute.stops.map((stop) =>
          stop.id === payload.id ? payload : stop,
        );
        return {
          ...currentRoute,
          stops,
          completed_orders: stops.filter((stop) => stop.status === 'DELIVERED').length,
        };
      });
      setToast({ code: payload.order_code, status: payload.status });
      const ordersPayload = await requestApi('/api/v1/orders');
      if (isOrderList(ordersPayload)) {
        publishOrdersUpdated(ordersPayload);
      }
      publishDataInvalidated(['orders', 'fleet', 'driver', 'overview']);
      if (podPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(podPreviewUrl);
      }
      setSelectedStop(null);
      setPodFile(null);
      setPodPreviewUrl('');
      setRecipientName('');
      setHasDrawnSignature(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('driver.updateError'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-busy="true">
        <div className="text-center">
          <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{t('driver.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6" aria-label={t('driver.workspace')}>
      {toast && (
        <div className="fixed left-1/2 top-20 z-[1100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl backdrop-blur dark:border-emerald-900 dark:bg-slate-900/95 dark:text-emerald-300" role="status">
          ✓ {t('driver.updateSuccess', {
            code: toast.code,
            status: t(driverStatusTranslationKeys[toast.status]),
          })}
        </div>
      )}

      {route?.vehicle ? (
        <DriverOverview route={route} driverName={user?.full_name ?? t('driver.defaultName')} />
      ) : route ? (
        <DriverUnassignedEmptyState isRefreshing={isLoading} onRefresh={refreshAssignment} />
      ) : null}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      {route?.vehicle && (
        <section aria-labelledby="driver-route-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-400">{t('driver.todayRoute')}</p>
              <h2 id="driver-route-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white">{t('driver.routeTitle')}</h2>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{t('driver.stopCount', { count: route.stops.length })}</span>
          </div>

          {route.stops.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900" role="status">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden="true">✓</span>
              <strong className="mt-4 block text-slate-950 dark:text-white">{t('driver.emptyTitle')}</strong>
              <p className="mt-2 text-sm text-slate-500">{t('driver.emptyDescription')}</p>
            </div>
          ) : (
            <ol>
              {route.stops.map((stop) => (
                <DriverStopCard key={stop.id} stop={stop} onUpdate={openStatusDialog} />
              ))}
            </ol>
          )}
        </section>
      )}

      <DriverStatusDialog
        stop={selectedStop}
        status={selectedStatus}
        deliveryNote={deliveryNote}
        failureReason={failureReason}
        podPreviewUrl={podPreviewUrl}
        hasSelectedFile={podFile !== null}
        recipientName={recipientName}
        hasDrawnSignature={hasDrawnSignature}
        signaturePadRef={signaturePadRef}
        error={error}
        isSubmitting={isSubmitting}
        onStatusChange={setSelectedStatus}
        onDeliveryNoteChange={setDeliveryNote}
        onFailureReasonChange={setFailureReason}
        onPodFileChange={handlePodFileChange}
        onRecipientNameChange={setRecipientName}
        onSignaturePresenceChange={setHasDrawnSignature}
        onClose={closeStatusDialog}
        onSubmit={handleStatusSubmit}
      />
    </section>
  );
}
