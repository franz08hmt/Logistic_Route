import { describe, expect, it } from 'vitest';

import {
  buildCsvPreview,
  isBulkImportResult,
  parseCsvText,
} from './csv-import-contracts';

describe('CSV import parsing', () => {
  it('preserves quoted Vietnamese addresses containing commas and a UTF-8 BOM', () => {
    const csv = [
      '\uFEFForder_code,customer_name,customer_phone,address,latitude,longitude,weight_kg,delivery_region',
      'LR-001,Nguyễn Văn A,0901234567,"123 Nguyễn Huệ, Quận 1, TP.HCM",10.7769,106.7009,15.5,Trung tâm',
    ].join('\r\n');

    const preview = buildCsvPreview(csv);

    expect(preview.missingRequiredColumns).toEqual([]);
    expect(preview.totalRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      orderCode: 'LR-001',
      customerName: 'Nguyễn Văn A',
      address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
    });
  });

  it('supports escaped quotes and newlines inside quoted CSV cells', () => {
    const rows = parseCsvText(
      'order_code,address\nLR-002,"Kho ""Miền Nam""\nCổng số 2"',
    );

    expect(rows).toEqual([
      ['order_code', 'address'],
      ['LR-002', 'Kho "Miền Nam"\nCổng số 2'],
    ]);
  });

  it('reports missing required columns before upload', () => {
    const preview = buildCsvPreview(
      'order_code,customer_name,address,latitude,weight_kg\n'
        + 'LR-003,Customer,Address,10.77,5',
    );

    expect(preview.missingRequiredColumns).toEqual(['longitude']);
  });
});

describe('bulk import response contract', () => {
  it('accepts the documented response and rejects malformed row errors', () => {
    expect(isBulkImportResult({
      total_rows: 3,
      created_count: 2,
      error_count: 1,
      errors: [
        {
          row: 2,
          order_code: 'LR-002',
          errors: ['order_code already exists'],
        },
      ],
    })).toBe(true);

    expect(isBulkImportResult({
      total_rows: 1,
      created_count: 0,
      error_count: 1,
      errors: [{ row: 0, order_code: null, errors: [] }],
    })).toBe(false);
  });
});
