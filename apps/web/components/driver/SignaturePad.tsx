'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { useI18n } from '@/context/I18nContext';

export type SignaturePadHandle = {
  clear: () => void;
  toBlob: () => Promise<Blob | null>;
};

type Point = { x: number; y: number };

export const SignaturePad = forwardRef<SignaturePadHandle, {
  disabled?: boolean;
  onEmptyChange?: (empty: boolean) => void;
}>(function SignaturePad({ disabled = false, onEmptyChange }, ref) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const emptyRef = useRef(true);
  const lastPointRef = useRef<Point | null>(null);

  function updateEmpty(empty: boolean) {
    if (emptyRef.current !== empty) {
      emptyRef.current = empty;
      onEmptyChange?.(empty);
    }
  }

  function prepareContext(canvas: HTMLCanvasElement) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const previous = document.createElement('canvas');
    previous.width = canvas.width;
    previous.height = canvas.height;
    if (!emptyRef.current && canvas.width && canvas.height) {
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
    }

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.25;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0f172a';
    if (!emptyRef.current && previous.width && previous.height) {
      context.drawImage(
        previous,
        0,
        0,
        previous.width,
        previous.height,
        0,
        0,
        rect.width,
        rect.height,
      );
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    drawingRef.current = false;
    lastPointRef.current = null;
    updateEmpty(true);
  }

  useImperativeHandle(ref, () => ({
    clear,
    toBlob: () => new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas || emptyRef.current) {
        resolve(null);
        return;
      }
      canvas.toBlob(resolve, 'image/png');
    }),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    prepareContext(canvas);
    const observer = new ResizeObserver(() => prepareContext(canvas));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled || !lastPointRef.current) {
      return;
    }
    event.preventDefault();
    const context = event.currentTarget.getContext('2d');
    if (!context) {
      return;
    }
    const current = pointFromEvent(event);
    const last = lastPointRef.current;
    const midpoint = {
      x: (last.x + current.x) / 2,
      y: (last.y + current.y) / 2,
    };
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.quadraticCurveTo(last.x, last.y, midpoint.x, midpoint.y);
    context.stroke();
    lastPointRef.current = current;
    updateEmpty(false);
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (drawingRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white dark:border-slate-600">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none cursor-crosshair disabled:cursor-not-allowed"
          role="application"
          aria-label={t('signature.canvasLabel')}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        <span className="pointer-events-none absolute inset-x-8 bottom-8 border-b border-slate-300" aria-hidden="true" />
        <span className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] text-slate-400" aria-hidden="true">
          {t('signature.signAbove')}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">{t('signature.canvasHint')}</p>
        <button
          type="button"
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={clear}
          disabled={disabled}
        >
          {t('signature.clear')}
        </button>
      </div>
    </div>
  );
});
