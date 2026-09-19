import { describe, expect, it } from 'vitest';

import { escapeLike } from './sql';

describe('escapeLike', () => {
  it('escapes wildcards and the escape character itself', () => {
    expect(escapeLike('100% sure_thing\\')).toBe('100\\% sure\\_thing\\\\');
    expect(escapeLike('plain')).toBe('plain');
  });
});
