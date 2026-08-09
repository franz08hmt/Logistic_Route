import { describe, expect, it } from 'vitest';

import type { DriverPerformanceItem } from './driver-performance-contracts';
import { buildDriverPerformanceCsv } from './driver-performance-export';

const driver: DriverPerformanceItem = {
  driver_id: 'driver-1',
  driver_name: 'Nguyen Van Minh',
  email: 'minh@logiroute.vn',
  phone_number: '0901234567',
  license_plate: '51D-12001',
  vehicle_type: 'TRUCK',
  total_orders_handled: 12,
  delivered_count: 11,
  failed_count: 1,
  success_rate: 91.67,
  route_adherence_score: 98,
  total_distance_km: 352.4,
  estimated_co2_saved_kg: 8.23,
  overall_score: 83.47,
  tier_badge: 'SILVER',
  is_eco_driver: true,
  rank: 1,
};

describe('driver performance CSV export', () => {
  it('exports all reconciliation metrics with an Excel-compatible BOM', () => {
    const csv = buildDriverPerformanceCsv([driver], {
      rank: 'Hang',
      driver: 'Tai xe',
      email: 'Email',
      phone: 'Dien thoai',
      vehicle: 'Phuong tien',
      orders: 'Tong don',
      delivered: 'Da giao',
      failed: 'That bai',
      successRate: 'Ty le thanh cong (%)',
      adherence: 'Tuan thu tuyen (%)',
      distance: 'Quang duong (km)',
      co2Saved: 'CO2 tiet kiem (kg)',
      tier: 'Danh hieu',
      score: 'Diem tong hop',
      ecoDriver: 'Eco Driver',
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Nguyen Van Minh"');
    expect(csv).toContain('"352.4"');
    expect(csv).toContain('"SILVER"');
    expect(csv).toContain('"true"');
  });
});
