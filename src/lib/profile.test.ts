import { describe, expect, it } from 'vitest';

import { isHttpsUrl, ProfileValidationError, validateProfileUpdate } from './profile';

describe('isHttpsUrl', () => {
  it('accepts https links and nothing else', () => {
    expect(isHttpsUrl('https://github.com/octocat.png')).toBe(true);
    expect(isHttpsUrl('http://example.com/a.png')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
    expect(isHttpsUrl(`https://example.com/${'a'.repeat(2100)}`)).toBe(false);
  });
});

describe('validateProfileUpdate', () => {
  it('trims and collapses the name', () => {
    expect(validateProfileUpdate({ name: '  Ada   Lovelace ' })).toEqual({ name: 'Ada Lovelace' });
  });

  it('rejects names that are too short, too long or not strings', () => {
    expect(() => validateProfileUpdate({ name: 'A' })).toThrow(ProfileValidationError);
    expect(() => validateProfileUpdate({ name: 'x'.repeat(81) })).toThrow(/between 2 and 80/);
    expect(() => validateProfileUpdate({ name: 42 })).toThrow(ProfileValidationError);
  });

  it('accepts an https avatar and clears it for null or an empty string', () => {
    expect(validateProfileUpdate({ image: ' https://github.com/octocat.png ' })).toEqual({
      image: 'https://github.com/octocat.png',
    });
    expect(validateProfileUpdate({ image: '' })).toEqual({ image: null });
    expect(validateProfileUpdate({ image: null })).toEqual({ image: null });
  });

  it('rejects avatars that are not https links', () => {
    expect(() => validateProfileUpdate({ image: 'http://example.com/a.png' })).toThrow(
      /https:\/\/ link/,
    );
    expect(() => validateProfileUpdate({ image: 'javascript:alert(1)' })).toThrow(
      ProfileValidationError,
    );
  });

  it('leaves absent fields absent so partial updates pass through', () => {
    expect(validateProfileUpdate({})).toEqual({});
    expect(validateProfileUpdate({ name: 'Grace' })).not.toHaveProperty('image');
  });
});
