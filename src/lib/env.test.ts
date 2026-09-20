import { describe, expect, it } from 'vitest';

import {
  assertProductionConfig,
  checkProductionConfig,
  getAdminEmails,
  getContactMaxAgeDays,
  getContactRetentionDays,
  getDatabaseConfig,
} from './env';

const STRONG_SECRET = 'x'.repeat(40);

describe('checkProductionConfig', () => {
  it('reports nothing outside production', () => {
    expect(checkProductionConfig({ NODE_ENV: 'development' })).toEqual([]);
    expect(checkProductionConfig({})).toEqual([]);
  });

  it('flags a missing or weak secret as an error', () => {
    expect(checkProductionConfig({ NODE_ENV: 'production' })).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('BETTER_AUTH_SECRET'),
      }),
    );
    expect(
      checkProductionConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'short' }),
    ).toContainEqual(expect.objectContaining({ level: 'error' }));
  });

  it('warns about a file database and missing email settings', () => {
    const issues = checkProductionConfig({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: STRONG_SECRET,
      DATABASE_URL: 'file:./.data/local.db',
    });
    expect(issues.every((issue) => issue.level === 'warn')).toBe(true);
    expect(issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('DATABASE_URL'),
      expect.stringContaining('RESEND_API_KEY'),
      expect.stringContaining('CONTACT_TO_EMAIL'),
    ]);
  });

  it('is clean for a fully configured deployment', () => {
    expect(
      checkProductionConfig({
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: STRONG_SECRET,
        DATABASE_URL: 'libsql://db.turso.io',
        RESEND_API_KEY: 're_123',
        CONTACT_TO_EMAIL: 'owner@example.com',
      }),
    ).toEqual([]);
  });
});

describe('getDatabaseConfig', () => {
  it('defaults to the local file database', () => {
    expect(getDatabaseConfig({})).toEqual({ url: 'file:./.data/local.db', authToken: undefined });
  });

  it('accepts the names set by the Turso integration on Vercel', () => {
    expect(
      getDatabaseConfig({ TURSO_DATABASE_URL: 'libsql://db.turso.io', TURSO_AUTH_TOKEN: 'tok' }),
    ).toEqual({ url: 'libsql://db.turso.io', authToken: 'tok' });
  });

  it('prefers the template names and ignores empty values', () => {
    expect(
      getDatabaseConfig({
        DATABASE_URL: 'libsql://a.turso.io',
        TURSO_DATABASE_URL: 'libsql://b.turso.io',
        DATABASE_AUTH_TOKEN: '',
        TURSO_AUTH_TOKEN: 'tok',
      }),
    ).toEqual({ url: 'libsql://a.turso.io', authToken: 'tok' });
  });
});

describe('assertProductionConfig', () => {
  it('throws on errors and passes on warnings', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'production' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      assertProductionConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: STRONG_SECRET }),
    ).not.toThrow();
  });
});

describe('getAdminEmails', () => {
  it('normalises the list', () => {
    expect(getAdminEmails({ ADMIN_EMAILS: ' Admin@Example.com, ops@example.com ,' })).toEqual([
      'admin@example.com',
      'ops@example.com',
    ]);
    expect(getAdminEmails({})).toEqual([]);
  });
});

describe('getContactRetentionDays', () => {
  it('defaults to a year and rejects nonsense', () => {
    expect(getContactRetentionDays({})).toBe(365);
    expect(getContactRetentionDays({ CONTACT_RETENTION_DAYS: '90' })).toBe(90);
    expect(getContactRetentionDays({ CONTACT_RETENTION_DAYS: '-5' })).toBe(365);
    expect(getContactRetentionDays({ CONTACT_RETENTION_DAYS: 'soon' })).toBe(365);
  });
});

describe('getContactMaxAgeDays', () => {
  it('is off unless set to a positive number of days', () => {
    expect(getContactMaxAgeDays({})).toBeNull();
    expect(getContactMaxAgeDays({ CONTACT_MAX_AGE_DAYS: '' })).toBeNull();
    expect(getContactMaxAgeDays({ CONTACT_MAX_AGE_DAYS: '0' })).toBeNull();
    expect(getContactMaxAgeDays({ CONTACT_MAX_AGE_DAYS: 'never' })).toBeNull();
    expect(getContactMaxAgeDays({ CONTACT_MAX_AGE_DAYS: '730.5' })).toBe(730);
  });
});
