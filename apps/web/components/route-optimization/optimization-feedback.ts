import { translate, type Locale } from '../../lib/i18n/i18n';

export function getOptimizationSuccessMessage(
  assignedOrderCount: number,
  locale: Locale = 'vi',
): string {
  if (assignedOrderCount === 0) {
    return translate(locale, 'map.nothingToOptimize');
  }

  return translate(locale, 'map.optimizeSuccess', {
    count: assignedOrderCount,
  });
}
