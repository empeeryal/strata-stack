import { describe, expect, it } from 'vitest';

import {
  axisTicks,
  barLayout,
  columnPath,
  dailyCounts,
  labelledIndexes,
  niceMax,
  summarise,
} from './chart';

describe('niceMax', () => {
  it('rounds up to a tidy bound and never returns zero', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(3)).toBe(3);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(9)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(250)).toBe(300);
    expect(niceMax(Number.NaN)).toBe(1);
  });
});

describe('axisTicks', () => {
  it('adds a midpoint only when it is a whole number', () => {
    expect(axisTicks(4)).toEqual([0, 2, 4]);
    expect(axisTicks(5)).toEqual([0, 5]);
    expect(axisTicks(1)).toEqual([0, 1]);
  });
});

describe('barLayout', () => {
  const layout = barLayout([0, 2, 4], {
    width: 100,
    height: 60,
    left: 10,
    right: 0,
    top: 0,
    bottom: 10,
  });

  it('scales heights to the nice maximum and keeps the baseline', () => {
    expect(layout.max).toBe(4);
    expect(layout.baseline).toBe(50);
    expect(layout.bars.map((bar) => bar.height)).toEqual([0, 25, 50]);
    expect(layout.bars[2]!.y).toBe(0);
  });

  it('caps the bar width and centres it in its slot', () => {
    expect(layout.bars.map((bar) => bar.width)).toEqual([24, 24, 24]);
    expect(layout.bars[0]!.slotWidth).toBe(30);
    expect(layout.bars[0]!.x).toBe(13);
    expect(layout.bars[1]!.slotX).toBe(40);
  });

  it('keeps a gap between bars when slots are narrow', () => {
    const narrow = barLayout(Array(30).fill(1), { width: 300, height: 60, left: 0, right: 0 });
    expect(narrow.bars[0]!.width).toBe(8);
  });

  it('places ticks on the gridlines', () => {
    expect(layout.ticks).toEqual([
      { value: 0, y: 50 },
      { value: 2, y: 25 },
      { value: 4, y: 0 },
    ]);
  });
});

describe('columnPath', () => {
  it('draws rounded top corners and a square base', () => {
    const path = columnPath({ x: 10, y: 20, width: 20, height: 30, slotX: 0, slotWidth: 40 });
    expect(path).toBe('M10,50 V24 Q10,20 14,20 H26 Q30,20 30,24 V50 Z');
  });

  it('shrinks the radius for tiny bars and returns nothing for empty ones', () => {
    expect(columnPath({ x: 0, y: 48, width: 20, height: 2, slotX: 0, slotWidth: 20 })).toContain(
      'Q0,48 2,48',
    );
    expect(columnPath({ x: 0, y: 50, width: 20, height: 0, slotX: 0, slotWidth: 20 })).toBe('');
  });
});

describe('labelledIndexes', () => {
  it('labels every slot up to seven and three beyond', () => {
    expect(labelledIndexes(0)).toEqual([]);
    expect(labelledIndexes(5)).toEqual([0, 1, 2, 3, 4]);
    expect(labelledIndexes(30)).toEqual([0, 14, 29]);
  });
});

describe('dailyCounts', () => {
  const now = new Date('2026-09-27T15:00:00Z');

  it('zero-fills the window, oldest first, in UTC days', () => {
    const points = dailyCounts(
      [
        new Date('2026-09-27T00:30:00Z'),
        new Date('2026-09-27T23:59:00Z'),
        new Date('2026-09-25T12:00:00Z'),
        new Date('2026-09-24T23:59:59Z'), // outside a 3-day window
        new Date('2026-09-28T00:00:00Z'), // tomorrow, ignored
      ],
      3,
      now,
    );
    expect(points.map((point) => point.label)).toEqual(['Sep 25', 'Sep 26', 'Sep 27']);
    expect(points.map((point) => point.value)).toEqual([1, 0, 2]);
    expect(points[0]!.detail).toBe('September 25, 2026');
  });

  it('summarises totals and the peak', () => {
    const points = dailyCounts([new Date('2026-09-26T10:00:00Z')], 2, now);
    expect(summarise(points)).toEqual({ total: 1, peak: points[0] });
    expect(summarise(dailyCounts([], 2, now))).toEqual({ total: 0, peak: null });
  });
});
