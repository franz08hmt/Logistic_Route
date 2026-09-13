'use client';

import { PageBanner } from '@/components/console/PageBanner';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';

/**
 * Screen title. Renders the console's cinematic banner, so every page opens the
 * way the public portal does without each page having to know about the image.
 */
export function LocalizedPageHeader({
  eyebrowKey,
  titleKey,
  descriptionKey,
}: {
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}) {
  const { t } = useI18n();

  return (
    <PageBanner
      eyebrow={t(eyebrowKey)}
      title={t(titleKey)}
      description={t(descriptionKey)}
    />
  );
}
