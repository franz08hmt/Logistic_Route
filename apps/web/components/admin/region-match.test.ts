import { describe, expect, it } from 'vitest';

import { getRegionMismatch, regionZone } from './region-match';

describe('region matching', () => {
  it('maps HCMC districts to the same operating zones used by vehicle assignment', () => {
    expect(regionZone('Quan 12, Ho Chi Minh City')).toBe('northwest');
    expect(regionZone('Quan 10, Ho Chi Minh City')).toBe('central');
    expect(regionZone('Huyện Hóc Môn')).toBe('northwest');
    expect(regionZone('Thành phố Thủ Đức')).toBe('east');
  });

  it('returns a warning when the selected driver serves a different zone', () => {
    expect(getRegionMismatch('Quận 7', 'northwest')).toEqual({
      deliveryRegion: 'Quận 7',
      driverRegion: 'northwest',
    });
    expect(getRegionMismatch('Quan 6', 'northwest')).not.toBeNull();
  });

  it('does not warn when either region is absent', () => {
    expect(getRegionMismatch('', 'northwest')).toBeNull();
    expect(getRegionMismatch('Quận 7', null)).toBeNull();
  });
});
