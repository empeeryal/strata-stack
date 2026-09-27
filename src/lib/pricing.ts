/** Data and formatting helpers for `PricingTable.astro`. */

export interface PricingTier {
  name: string;
  description: string;
  /** Price per month when billed monthly; `null` means "contact us" style custom pricing. */
  monthly: number | null;
  /** Price per month when billed annually. Omit when the tier has one price. */
  annual?: number;
  features: string[];
  cta: { label: string; href: string };
  /** Visually emphasised tier, usually the one most visitors should pick. */
  highlighted?: boolean;
  /** Short label shown above the card, e.g. "Most popular". */
  badge?: string;
  /** Small print under the feature list. */
  footnote?: string;
}

/** Whole amounts render without decimals ("$19"); anything else keeps two ("$4.50"). */
export function formatPrice(amount: number, currency = 'USD', locale = 'en-US'): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/** Percentage saved per month when billed annually, rounded; zero when there is no saving. */
export function annualSavingsPercent(monthly: number, annual: number): number {
  if (monthly <= 0 || annual >= monthly) return 0;
  return Math.round((1 - annual / monthly) * 100);
}

/** The largest annual saving across the tiers, for the billing switch label. */
export function maxAnnualSavings(tiers: PricingTier[]): number {
  return tiers.reduce((best, tier) => {
    if (tier.monthly === null || tier.annual === undefined) return best;
    return Math.max(best, annualSavingsPercent(tier.monthly, tier.annual));
  }, 0);
}

export function hasAnnualPricing(tiers: PricingTier[]): boolean {
  return tiers.some((tier) => tier.monthly !== null && tier.annual !== undefined);
}
