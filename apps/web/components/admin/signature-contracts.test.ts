import { describe, expect, it } from 'vitest';

import {
  createSignatureFormData,
  isSignatureUpload,
  validateSignatureBlob,
} from './signature-contracts';

describe('signature API contracts', () => {
  it('accepts safe signature upload responses', () => {
    expect(isSignatureUpload({
      signature_url: 'http://localhost:8000/uploads/signatures/order.png',
      uploaded_at: '2026-08-08T09:00:00Z',
    })).toBe(true);
    expect(isSignatureUpload({
      signature_url: 'javascript:alert(1)',
      uploaded_at: '2026-08-08T09:00:00Z',
    })).toBe(false);
  });

  it('validates PNG type and the one megabyte client limit', () => {
    expect(validateSignatureBlob(new Blob(['png'], { type: 'image/png' })))
      .toBeNull();
    expect(validateSignatureBlob(new Blob(['jpeg'], { type: 'image/jpeg' })))
      .toBe('INVALID_TYPE');
    expect(validateSignatureBlob(
      new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/png' }),
    )).toBe('TOO_LARGE');
  });

  it('builds the multipart form expected by FastAPI', () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    const form = createSignatureFormData(blob, '  Nguyen Van A  ');

    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(form.get('recipient_name')).toBe('Nguyen Van A');
  });
});
