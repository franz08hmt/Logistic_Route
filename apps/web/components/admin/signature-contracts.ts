export const MAX_SIGNATURE_BYTES = 1024 * 1024;

export type SignatureUpload = {
  signature_url: string;
  uploaded_at: string;
};

export type SignatureValidationError = 'INVALID_TYPE' | 'TOO_LARGE';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafeSignatureUrl(value: unknown): value is string {
  return typeof value === 'string' && (
    value.startsWith('https://')
    || value.startsWith('http://')
    || value.startsWith('/uploads/signatures/')
  );
}

export function isSignatureUpload(value: unknown): value is SignatureUpload {
  return isRecord(value)
    && isSafeSignatureUrl(value.signature_url)
    && typeof value.uploaded_at === 'string'
    && !Number.isNaN(Date.parse(value.uploaded_at));
}

export function validateSignatureBlob(
  blob: Blob,
): SignatureValidationError | null {
  if (blob.type !== 'image/png') {
    return 'INVALID_TYPE';
  }
  if (blob.size > MAX_SIGNATURE_BYTES) {
    return 'TOO_LARGE';
  }
  return null;
}

export function createSignatureFormData(
  blob: Blob,
  recipientName: string,
): FormData {
  const formData = new FormData();
  formData.set('file', blob, 'recipient-signature.png');
  formData.set('recipient_name', recipientName.trim());
  return formData;
}
