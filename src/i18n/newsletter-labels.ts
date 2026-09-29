import type { NewsletterFormLabels } from '@/components/react/NewsletterForm';

import type { Translate } from './index';

/** The newsletter form's strings for a locale, from the shared dictionary. */
export function newsletterLabels(t: Translate): NewsletterFormLabels {
  return {
    email: t('newsletter.email'),
    placeholder: t('newsletter.placeholder'),
    submit: t('newsletter.submit'),
    formLabel: t('newsletter.formLabel'),
    sent: t('newsletter.sent'),
    invalidEmail: t('newsletter.invalidEmail'),
  };
}
