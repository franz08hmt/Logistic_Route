import { describe, expect, it } from 'vitest';

import {
  isPodUpload,
  validateDriverUpdate,
  validatePodFile,
} from './driver-pod';

describe('driver POD validation', () => {
  it('requires a proof image for delivered orders', () => {
    expect(validateDriverUpdate({
      status: 'DELIVERED',
      hasExistingPod: false,
      hasSelectedFile: false,
      hasExistingSignature: false,
      hasDrawnSignature: false,
      recipientName: '',
      failureReason: '',
    })).toBe('PHOTO_REQUIRED');
  });

  it('requires a reason but not a photo for failed orders', () => {
    expect(validateDriverUpdate({
      status: 'FAILED',
      hasExistingPod: false,
      hasSelectedFile: false,
      hasExistingSignature: false,
      hasDrawnSignature: false,
      recipientName: '',
      failureReason: '',
    })).toBe('FAILURE_REASON_REQUIRED');
    expect(validateDriverUpdate({
      status: 'FAILED',
      hasExistingPod: false,
      hasSelectedFile: false,
      hasExistingSignature: false,
      hasDrawnSignature: false,
      recipientName: '',
      failureReason: 'CUSTOMER_UNAVAILABLE',
    })).toBeNull();
  });

  it('requires recipient identity and signature for delivered orders', () => {
    expect(validateDriverUpdate({
      status: 'DELIVERED',
      hasExistingPod: true,
      hasSelectedFile: false,
      hasExistingSignature: false,
      hasDrawnSignature: false,
      recipientName: 'Nguyen Van A',
      failureReason: '',
    })).toBe('SIGNATURE_REQUIRED');
    expect(validateDriverUpdate({
      status: 'DELIVERED',
      hasExistingPod: true,
      hasSelectedFile: false,
      hasExistingSignature: false,
      hasDrawnSignature: true,
      recipientName: '   ',
      failureReason: '',
    })).toBe('RECIPIENT_NAME_REQUIRED');
  });

  it('rejects oversized or unsupported files', () => {
    expect(validatePodFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBeNull();
    expect(validatePodFile({ type: 'image/gif', size: 100 })).toBe('INVALID_TYPE');
    expect(validatePodFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('TOO_LARGE');
  });

  it('validates the upload API response', () => {
    expect(isPodUpload({
      pod_url: 'http://localhost:8000/uploads/pod/order.jpg',
      content_type: 'image/jpeg',
      size_bytes: 1000,
    })).toBe(true);
    expect(isPodUpload({ pod_url: 'javascript:alert(1)' })).toBe(false);
  });
});
