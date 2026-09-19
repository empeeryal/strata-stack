import { describe, expect, it } from 'vitest';

import { listQuery, paginate } from './pagination';

describe('paginate', () => {
  it('computes the window for a page', () => {
    expect(paginate(120, '3', 25)).toEqual({
      page: 3,
      pages: 5,
      offset: 50,
      from: 51,
      to: 75,
      total: 120,
      pageSize: 25,
    });
  });

  it('clamps out-of-range and invalid pages', () => {
    expect(paginate(120, '99', 25).page).toBe(5);
    expect(paginate(120, '0', 25).page).toBe(1);
    expect(paginate(120, '-4', 25).page).toBe(1);
    expect(paginate(120, 'abc', 25).page).toBe(1);
    expect(paginate(120, null, 25).page).toBe(1);
    expect(paginate(120, '2.9', 25).page).toBe(2);
  });

  it('describes an empty list as page 1 of 1 with nothing shown', () => {
    expect(paginate(0, '7', 25)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0 });
  });

  it('ends the last page at the total', () => {
    expect(paginate(26, '2', 25)).toMatchObject({ from: 26, to: 26, pages: 2 });
  });
});

describe('listQuery', () => {
  it('drops empty values and encodes the rest', () => {
    expect(listQuery({ status: 'new', q: '', page: null })).toBe('?status=new');
    expect(listQuery({ status: 'all', q: 'a b&c', page: 2 })).toBe('?status=all&q=a+b%26c&page=2');
    expect(listQuery({ q: undefined })).toBe('');
  });
});
