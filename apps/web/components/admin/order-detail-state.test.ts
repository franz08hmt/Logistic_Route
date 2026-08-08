import { describe, expect, it } from 'vitest';

import { shouldResetOrderDetailOverlays } from './order-detail-state';

describe('order detail overlay state', () => {
  it('keeps open overlays when a background refresh replaces the same order object', () => {
    expect(shouldResetOrderDetailOverlays('order-123', 'order-123')).toBe(false);
  });

  it('resets overlays when the dispatcher opens a different order', () => {
    expect(shouldResetOrderDetailOverlays('order-123', 'order-456')).toBe(true);
  });
});
