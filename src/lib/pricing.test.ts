import { describe, expect, it } from 'vitest';

import {
  annualSavingsPercent,
  formatPrice,
  hasAnnualPricing,
  maxAnnualSavings,
  type PricingTier,
} from './pricing';

const tiers: PricingTier[] = [
  { name: 'Free', description: '', monthly: 0, features: [], cta: { label: 'Start', href: '/' } },
  {
    name: 'Pro',
    description: '',
    monthly: 20,
    annual: 16,
    features: [],
    cta: { label: 'Buy', href: '/' },
  },
  {
    name: 'Team',
    description: '',
    monthly: 50,
    annual: 45,
    features: [],
    cta: { label: 'Buy', href: '/' },
  },
  {
    name: 'Custom',
    description: '',
    monthly: null,
    features: [],
    cta: { label: 'Talk', href: '/' },
  },
];

describe('formatPrice', () => {
  it('drops decimals for whole amounts and keeps two otherwise', () => {
    expect(formatPrice(0)).toBe('$0');
    expect(formatPrice(19)).toBe('$19');
    expect(formatPrice(1000)).toBe('$1,000');
    expect(formatPrice(4.5)).toBe('$4.50');
    expect(formatPrice(9, 'EUR', 'de-DE')).toBe('9\u00a0€');
  });
});

describe('annualSavingsPercent', () => {
  it('rounds the saving and never goes negative', () => {
    expect(annualSavingsPercent(20, 16)).toBe(20);
    expect(annualSavingsPercent(19, 15)).toBe(21);
    expect(annualSavingsPercent(20, 20)).toBe(0);
    expect(annualSavingsPercent(20, 25)).toBe(0);
    expect(annualSavingsPercent(0, 0)).toBe(0);
  });
});

describe('tier helpers', () => {
  it('reports the best saving and whether a switch makes sense', () => {
    expect(maxAnnualSavings(tiers)).toBe(20);
    expect(hasAnnualPricing(tiers)).toBe(true);
    expect(hasAnnualPricing([tiers[0]!, tiers[3]!])).toBe(false);
    expect(maxAnnualSavings([tiers[0]!])).toBe(0);
  });
});
