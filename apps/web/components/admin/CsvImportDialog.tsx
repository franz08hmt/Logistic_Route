'use client';

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { useI18n } from '@/context/I18nContext';
import { apiFetch } from '@/lib/api-client';
import { ModalDialog } from './ModalDialog';
import { requestApi } from './api-contracts';
import {
  buildCsvPreview,
  isBulkImportResult,
  MAX_CSV_IMPORT_BYTES,
  type BulkImportResult,
  type CsvPreview,
} from './csv-import-contracts';

type CsvImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
};

type Step = 'upload' | 'preview' | 'result';

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Unable to read CSV as text'))
    );
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read CSV'));
    reader.readAsText(file, 'utf-8');
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(bytes < 100 * 1024 ? 1 : 0)} KB`;
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CsvImportDialog({
  open,
  onClose,
  onImported,
}: CsvImportDialogProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    if (isSubmitting) {
      return;
    }
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    onClose();
  }

  async function selectFile(selectedFile: File | undefined) {
    setError(null);
    if (!selectedFile) {
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError(t('import.invalidType'));
      return;
    }
    if (selectedFile.size > MAX_CSV_IMPORT_BYTES) {
      setError(t('import.fileTooLarge'));
      return;
    }
    if (selectedFile.size === 0) {
      setError(t('import.emptyFile'));
      return;
    }

    try {
      const text = await readFileAsText(selectedFile);
      const nextPreview = buildCsvPreview(text);
      if (nextPreview.totalRows === 0) {
        throw new Error(t('import.emptyFile'));
      }
      setFile(selectedFile);
      setPreview(nextPreview);
      setStep('preview');
    } catch (readError) {
      setError(
        readError instanceof Error ? readError.message : t('import.readError'),
      );
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    void selectFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    void selectFile(event.dataTransfer.files?.[0]);
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const response = await apiFetch('/api/v1/orders/import/template');
      if (!response.ok) {
        throw new Error(t('import.templateError'));
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'logiroute-order-import-template.csv';
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : t('import.templateError'),
      );
    }
  }

  async function submitImport() {
    if (!file || !preview || preview.missingRequiredColumns.length > 0) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const payload = await requestApi('/api/v1/orders/import', {
        method: 'POST',
        body: formData,
      });
      if (!isBulkImportResult(payload)) {
        throw new Error(t('import.invalidResponse'));
      }
      setResult(payload);
      setStep('result');
      if (payload.created_count > 0) {
        await onImported();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t('import.uploadError'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      onClose={resetAndClose}
      eyebrow={t('import.eyebrow')}
      title={t('import.title')}
      description={t('import.description')}
    >
      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              className={`grid min-h-52 cursor-pointer place-items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                isDragging
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
                  : 'border-slate-300 bg-slate-50 hover:border-teal-400 dark:border-slate-700 dark:bg-slate-950/40'
              }`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              aria-label={t('import.dropzoneLabel')}
            >
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  <UploadIcon />
                </span>
                <p className="mt-4 font-semibold">{t('import.dropTitle')}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('import.dropHint')}</p>
                <p className="mt-3 text-xs text-slate-400">{t('import.fileSupport')}</p>
              </div>
            </button>
            <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={handleFileInput} />
            <button type="button" onClick={() => void downloadTemplate()} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-400">
              <span aria-hidden="true">↓</span>
              {t('import.downloadTemplate')}
            </button>
          </div>
        )}

        {step === 'preview' && file && preview && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{t('import.previewTitle')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('import.fileMeta', {
                  name: file.name,
                  rows: preview.totalRows,
                  size: formatBytes(file.size),
                })}
              </p>
            </div>
            {preview.missingRequiredColumns.length > 0 && (
              <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {t('import.missingColumns', {
                  columns: preview.missingRequiredColumns.join(', '),
                })}
              </p>
            )}
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{t('import.orderCode')}</th>
                    <th className="px-3 py-2">{t('import.customer')}</th>
                    <th className="px-3 py-2">{t('import.address')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.rows.map((row) => (
                    <tr key={row.row}>
                      <td className="px-3 py-2 text-slate-500">{row.row}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{row.orderCode || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2">{row.customerName || '—'}</td>
                      <td className="min-w-64 px-3 py-2 text-slate-600 dark:text-slate-300">{row.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.totalRows > preview.rows.length && (
              <p className="text-xs text-slate-500">{t('import.previewLimited', { count: preview.rows.length })}</p>
            )}
            <p className="text-sm font-medium">{t('import.totalReady', { count: preview.totalRows })}</p>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setStep('upload')} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">{t('common.cancel')}</button>
              <button type="button" disabled={isSubmitting || preview.missingRequiredColumns.length > 0} onClick={() => void submitImport()} className="h-10 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? t('import.importing') : t('import.confirm')}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">{t('import.resultTitle')}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  ✓ {t('import.createdCount', { count: result.created_count })}
                </p>
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  ⚠ {t('import.errorCount', { count: result.error_count })}
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ul className="max-h-72 divide-y divide-slate-200 overflow-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {result.errors.map((rowError) => (
                  <li key={rowError.row} className="px-4 py-3">
                    <p className="text-sm font-semibold">
                      {t('import.errorRow', {
                        row: rowError.row,
                        code: rowError.order_code || t('import.unreadableCode'),
                      })}
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-rose-700 dark:text-rose-300">
                      {rowError.errors.map((message) => <li key={message}>× {message}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
              <button type="button" onClick={resetAndClose} className="h-10 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700">
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
