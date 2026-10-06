/**
 * Pure helpers behind the SVG chart components. Everything here is plain arithmetic so the
 * components stay declarative and the maths is unit-tested on its own.
 */

export interface ChartPoint {
  /** Short axis label, e.g. "Sep 21". */
  label: string;
  value: number;
  /** Longer name used in tooltips and the table view, e.g. "21 September 2026". */
  detail?: string;
}

export interface BarLayoutOptions {
  width: number;
  height: number;
  /** Space reserved for tick labels on the left and axis labels at the bottom. */
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  /** Bars never grow thicker than this; the rest of the slot stays empty. */
  maxBarWidth?: number;
  /** Surface gap kept between adjacent bars. */
  gap?: number;
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Full slot the bar sits in, used as its hit target. */
  slotX: number;
  slotWidth: number;
}

export interface BarLayout {
  bars: BarRect[];
  baseline: number;
  plotTop: number;
  max: number;
  ticks: Array<{ value: number; y: number }>;
}

/** Rounds a maximum up to a tidy axis bound (1, 2, 3, 4, 5, 6, 8, 10 and their multiples of ten). */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

/** Gridline values for a bound: zero, the bound and the midpoint when it is a whole number. */
export function axisTicks(max: number): number[] {
  const half = max / 2;
  return Number.isInteger(half) && half > 0 ? [0, half, max] : [0, max];
}

/** Positions bars in a plot area; heights are proportional to `niceMax` of the values. */
export function barLayout(values: number[], options: BarLayoutOptions): BarLayout {
  const {
    width,
    height,
    left = 28,
    right = 8,
    top = 12,
    bottom = 20,
    maxBarWidth = 24,
    gap = 2,
  } = options;
  const plotWidth = Math.max(width - left - right, 0);
  const plotHeight = Math.max(height - top - bottom, 0);
  const baseline = top + plotHeight;
  const max = niceMax(Math.max(0, ...values));
  const slot = values.length ? plotWidth / values.length : plotWidth;
  const barWidth = Math.max(Math.min(maxBarWidth, slot - gap), 1);

  const bars = values.map((value, index) => {
    const slotX = left + index * slot;
    const barHeight = value > 0 ? (Math.min(value, max) / max) * plotHeight : 0;
    return {
      x: slotX + (slot - barWidth) / 2,
      y: baseline - barHeight,
      width: barWidth,
      height: barHeight,
      slotX,
      slotWidth: slot,
    };
  });

  const ticks = axisTicks(max).map((value) => ({
    value,
    y: baseline - (value / max) * plotHeight,
  }));

  return { bars, baseline, plotTop: top, max, ticks };
}

/** SVG path for a column with rounded top corners and a square base. */
export function columnPath(bar: BarRect, radius = 4): string {
  const { x, y, width, height } = bar;
  if (height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  return [
    `M${round(x)},${round(bottom)}`,
    `V${round(y + r)}`,
    `Q${round(x)},${round(y)} ${round(x + r)},${round(y)}`,
    `H${round(x + width - r)}`,
    `Q${round(x + width)},${round(y)} ${round(x + width)},${round(y + r)}`,
    `V${round(bottom)}`,
    'Z',
  ].join(' ');
}

/** Which slots get an axis label: every one up to seven, otherwise first, middle and last. */
export function labelledIndexes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 7) return Array.from({ length: count }, (_, index) => index);
  const middle = Math.floor((count - 1) / 2);
  return [0, middle, count - 1];
}

const DAY_MS = 86_400_000;

const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const dayDetail = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** UTC calendar day (YYYY-MM-DD) of a timestamp. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Counts events per UTC calendar day over the last `days` days ending today, with zero-filled
 * gaps, oldest first. Timestamps outside the window are ignored.
 */
export function dailyCounts(dates: Date[], days: number, now = new Date()): ChartPoint[] {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const firstStart = todayStart - (days - 1) * DAY_MS;
  const counts = new Map<string, number>();
  for (const date of dates) {
    const time = date.getTime();
    if (time < firstStart || time >= todayStart + DAY_MS) continue;
    const key = utcDay(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(firstStart + index * DAY_MS);
    return {
      label: dayLabel.format(date),
      detail: dayDetail.format(date),
      value: counts.get(utcDay(date)) ?? 0,
    };
  });
}

/** Total, peak and its label for captions; `peak` is null when every value is zero. */
export function summarise(points: ChartPoint[]) {
  let total = 0;
  let peak: ChartPoint | null = null;
  for (const point of points) {
    total += point.value;
    if (point.value > 0 && (peak === null || point.value > peak.value)) peak = point;
  }
  return { total, peak };
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
