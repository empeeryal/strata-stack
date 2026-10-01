import { describe, expect, it } from 'vitest';

import { csvField, csvRow } from './csv';

describe('csvField', () => {
  it('passes plain values through and quotes separators, quotes and line breaks', () => {
    expect(csvField('ada@example.com')).toBe('ada@example.com');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises cells a spreadsheet would evaluate', () => {
    expect(csvField('=1+1')).toBe("'=1+1");
    expect(csvField('-1-1@example.com')).toBe("'-1-1@example.com");
    expect(csvField('+cmd')).toBe("'+cmd");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\tx')).toBe("'\tx");
  });

  it('leaves a validated column alone when asked, but still quotes it', () => {
    expect(csvField('-deals@example.com', { neutralise: false })).toBe('-deals@example.com');
    expect(csvField('+a,b@example.com', { neutralise: false })).toBe('"+a,b@example.com"');
  });

  it('joins a row, with per-cell options', () => {
    expect(csvRow(['a', 'b,c', '=x'])).toBe(`a,"b,c",'=x`);
    expect(csvRow([['-x@example.com', { neutralise: false }], '=y'])).toBe(`-x@example.com,'=y`);
  });
});
