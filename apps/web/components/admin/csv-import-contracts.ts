export const MAX_CSV_IMPORT_BYTES = 2 * 1024 * 1024;
export const CSV_REQUIRED_COLUMNS = [
  'order_code',
  'customer_name',
  'address',
  'latitude',
  'longitude',
  'weight_kg',
] as const;

export type CsvPreviewRow = {
  row: number;
  orderCode: string;
  customerName: string;
  address: string;
};

export type CsvPreview = {
  totalRows: number;
  rows: CsvPreviewRow[];
  missingRequiredColumns: string[];
};

export type BulkImportRowError = {
  row: number;
  order_code: string | null;
  errors: string[];
};

export type BulkImportResult = {
  total_rows: number;
  created_count: number;
  error_count: number;
  errors: BulkImportRowError[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isBulkImportResult(value: unknown): value is BulkImportResult {
  if (!isRecord(value)) {
    return false;
  }
  const errors = value.errors;
  return (
    Number.isInteger(value.total_rows)
    && (value.total_rows as number) >= 0
    && Number.isInteger(value.created_count)
    && (value.created_count as number) >= 0
    && Number.isInteger(value.error_count)
    && (value.error_count as number) >= 0
    && Array.isArray(errors)
    && value.error_count === errors.length
    && value.total_rows === (value.created_count as number) + errors.length
    && errors.every((error) => (
      isRecord(error)
      && Number.isInteger(error.row)
      && (error.row as number) >= 1
      && (typeof error.order_code === 'string' || error.order_code === null)
      && Array.isArray(error.errors)
      && error.errors.length > 0
      && error.errors.every((message) => (
        typeof message === 'string' && message.trim().length > 0
      ))
    ))
  );
}

/**
 * Small RFC 4180-style parser. It deliberately handles quoted commas,
 * escaped quotes and quoted newlines without adding a client dependency.
 */
export function parseCsvText(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error('CSV contains an unclosed quoted field');
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function buildCsvPreview(source: string): CsvPreview {
  const parsedRows = parseCsvText(source);
  if (parsedRows.length === 0) {
    return {
      totalRows: 0,
      rows: [],
      missingRequiredColumns: [...CSV_REQUIRED_COLUMNS],
    };
  }

  const headers = parsedRows[0].map((header, index) => (
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim()
  ));
  const headerIndexes = new Map(
    headers.map((header, index) => [header, index]),
  );
  const dataRows = parsedRows
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim().length > 0));
  const readCell = (cells: string[], name: string) => {
    const index = headerIndexes.get(name);
    return index === undefined ? '' : (cells[index] ?? '').trim();
  };

  return {
    totalRows: dataRows.length,
    missingRequiredColumns: CSV_REQUIRED_COLUMNS.filter(
      (column) => !headerIndexes.has(column),
    ),
    rows: dataRows.slice(0, 50).map((cells, index) => ({
      row: index + 1,
      orderCode: readCell(cells, 'order_code'),
      customerName: readCell(cells, 'customer_name'),
      address: readCell(cells, 'address'),
    })),
  };
}
