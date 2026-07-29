export type OperatingZone =
  | 'central'
  | 'northwest'
  | 'west'
  | 'east'
  | 'south';

const zoneDistricts: Record<OperatingZone, string[]> = {
  central: ['quan 1', 'quan 3', 'quan 4', 'quan 5', 'quan 10', 'phu nhuan', 'binh thanh'],
  northwest: ['quan 12', 'hoc mon', 'cu chi', 'go vap', 'tan binh', 'tan phu'],
  west: ['quan 6', 'quan 8', 'quan 11', 'binh tan', 'binh chanh'],
  east: ['thu duc', 'quan 2', 'quan 9'],
  south: ['quan 7', 'nha be', 'can gio'],
};

function normalizeRegion(value: string): string {
  return value
    .replaceAll('Đ', 'D')
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function regionZone(value: string): string {
  const normalized = normalizeRegion(value);
  if (normalized in zoneDistricts) {
    return normalized;
  }
  for (const [zone, districts] of Object.entries(zoneDistricts)) {
    if (
      districts.some((district) =>
        new RegExp(`\\b${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(
          normalized,
        ),
      )
    ) {
      return zone;
    }
  }
  return normalized;
}

export function getRegionMismatch(
  deliveryRegion: string,
  driverRegion: string | null,
): { deliveryRegion: string; driverRegion: string } | null {
  if (!deliveryRegion.trim() || !driverRegion?.trim()) {
    return null;
  }

  // Geocoders return district names while vehicle assignments use broader
  // operating zones. Both values are normalized before comparison so accents
  // and administrative prefixes do not create false mismatch warnings.
  const deliveryZone = regionZone(deliveryRegion);
  const assignedZone = regionZone(driverRegion);
  const matches = deliveryZone === assignedZone;

  return matches
    ? null
    : { deliveryRegion, driverRegion };
}
