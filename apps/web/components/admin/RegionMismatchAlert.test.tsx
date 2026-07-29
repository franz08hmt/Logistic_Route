import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RegionMismatchDialog } from './RegionMismatchDialog';

describe('RegionMismatchAlert', () => {
  it('uses a native modal dialog so it appears above the order dialog', () => {
    const markup = renderToStaticMarkup(
      <RegionMismatchDialog
        title="Cảnh báo khu vực"
        description="Khu vực tài xế và đơn hàng không khớp."
        cancelLabel="Chọn lại"
        confirmLabel="Vẫn phân công"
        isSubmitting={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(markup.startsWith('<dialog')).toBe(true);
    expect(markup).toContain('aria-modal="true"');
  });
});
