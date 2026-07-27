import { describe, expect, it } from 'vitest';

import { getOptimizationSuccessMessage } from './optimization-feedback';

describe('getOptimizationSuccessMessage', () => {
  it('reports how many orders were assigned', () => {
    expect(getOptimizationSuccessMessage(3)).toBe(
      'Đã tối ưu lộ trình thành công cho 3 đơn hàng!',
    );
  });

  it('explains that there are no pending orders when nothing was assigned', () => {
    expect(getOptimizationSuccessMessage(0)).toBe(
      'Không còn đơn hàng PENDING cần tối ưu.',
    );
  });
});
