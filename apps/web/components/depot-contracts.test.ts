import { describe, expect, it } from 'vitest';

import {
  canAnimateDepotMap,
  isDepotList,
  isValidDepotCoordinates,
  selectInitialDepot,
} from './depot-contracts';

const DEPOTS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'HUB-SGN',
    name: 'Southern Hub',
    city: 'TP. Hồ Chí Minh',
    address: 'District 12',
    latitude: 10.8671,
    longitude: 106.6412,
    is_default: true,
    vehicle_count: 2,
    active_orders_count: 5,
    total_vehicle_capacity_kg: 2000,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'HUB-HAN',
    name: 'Northern Hub',
    city: 'Hà Nội',
    address: 'Long Biên',
    latitude: 21.0362,
    longitude: 105.9015,
    is_default: false,
    vehicle_count: 0,
    active_orders_count: 0,
    total_vehicle_capacity_kg: 0,
  },
] as const;

describe('depot contracts', () => {
  it('accepts a complete depot list and rejects unsafe coordinates', () => {
    expect(isDepotList(DEPOTS)).toBe(true);
    expect(isDepotList([{ ...DEPOTS[0], latitude: 999 }])).toBe(false);
  });

  it('restores a stored depot and otherwise selects the default', () => {
    expect(selectInitialDepot([...DEPOTS], DEPOTS[1].id)?.code).toBe('HUB-HAN');
    expect(selectInitialDepot([...DEPOTS], 'missing')?.code).toBe('HUB-SGN');
    expect(selectInitialDepot([], null)).toBeNull();
  });

  it('rejects incomplete and non-finite map coordinates before Leaflet receives them', () => {
    expect(isValidDepotCoordinates({ latitude: 10.8671, longitude: 106.6412 })).toBe(true);
    expect(isValidDepotCoordinates({ latitude: Number.NaN, longitude: 106.6412 })).toBe(false);
    expect(isValidDepotCoordinates({ latitude: 10.8671, longitude: Number.NaN })).toBe(false);
    expect(isValidDepotCoordinates({ latitude: 91, longitude: 106.6412 })).toBe(false);
  });

  it('animates only after the depot dialog has a measurable map container', () => {
    const position = { latitude: 10.8671, longitude: 106.6412 };

    expect(canAnimateDepotMap(position, false, 640, 256)).toBe(false);
    expect(canAnimateDepotMap(position, true, 0, 0)).toBe(false);
    expect(canAnimateDepotMap(position, true, 640, 256)).toBe(true);
    expect(canAnimateDepotMap({ latitude: Number.NaN, longitude: 106.6412 }, true, 640, 256)).toBe(false);
  });
});
