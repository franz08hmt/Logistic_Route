'use client';

import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/i18n';
import { PageHeader } from './PageHeader';

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
    <PageHeader
      eyebrow={t(eyebrowKey)}
      title={t(titleKey)}
      description={t(descriptionKey)}
    />
  );
}
