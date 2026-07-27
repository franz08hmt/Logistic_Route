export function getOptimizationSuccessMessage(assignedOrderCount: number): string {
  if (assignedOrderCount === 0) {
    return 'Không còn đơn hàng PENDING cần tối ưu.';
  }

  return `Đã tối ưu lộ trình thành công cho ${assignedOrderCount} đơn hàng!`;
}
