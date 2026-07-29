import type { DriverOrderStatus } from './driver-contracts';

export const MAX_POD_BYTES = 5 * 1024 * 1024;
export const POD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type PodValidationError = 'INVALID_TYPE' | 'TOO_LARGE';
export type DriverUpdateValidationError =
  | 'PHOTO_REQUIRED'
  | 'FAILURE_REASON_REQUIRED';

export type PodUpload = {
  pod_url: string;
  content_type: string;
  size_bytes: number;
};

export function validatePodFile(file: {
  type: string;
  size: number;
}): PodValidationError | null {
  if (!POD_CONTENT_TYPES.includes(file.type as (typeof POD_CONTENT_TYPES)[number])) {
    return 'INVALID_TYPE';
  }
  if (file.size > MAX_POD_BYTES) {
    return 'TOO_LARGE';
  }
  return null;
}

export function validateDriverUpdate({
  status,
  hasExistingPod,
  hasSelectedFile,
  failureReason,
}: {
  status: DriverOrderStatus;
  hasExistingPod: boolean;
  hasSelectedFile: boolean;
  failureReason: string;
}): DriverUpdateValidationError | null {
  if (status === 'DELIVERED' && !hasExistingPod && !hasSelectedFile) {
    return 'PHOTO_REQUIRED';
  }
  if (status === 'FAILED' && !failureReason.trim()) {
    return 'FAILURE_REASON_REQUIRED';
  }
  return null;
}

export function isPodUpload(value: unknown): value is PodUpload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const upload = value as Record<string, unknown>;
  const safeUrl = typeof upload.pod_url === 'string'
    && (
      upload.pod_url.startsWith('https://')
      || upload.pod_url.startsWith('http://')
      || upload.pod_url.startsWith('/uploads/pod/')
    );
  return (
    safeUrl
    && typeof upload.content_type === 'string'
    && POD_CONTENT_TYPES.includes(upload.content_type as (typeof POD_CONTENT_TYPES)[number])
    && typeof upload.size_bytes === 'number'
    && Number.isFinite(upload.size_bytes)
    && upload.size_bytes > 0
    && upload.size_bytes <= MAX_POD_BYTES
  );
}
