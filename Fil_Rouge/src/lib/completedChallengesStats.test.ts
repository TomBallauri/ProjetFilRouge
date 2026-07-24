import { describe, it, expect } from 'vitest';
import { computeView, startOfWeek, sameDay, startOfDay } from './completedChallengesStats';

// Jeudi 24 juillet 2025 — même date que celle utilisée ailleurs dans les échanges de ce projet,
// pour que les résultats attendus ci-dessous soient faciles à vérifier à la main.
const THURSDAY = new Date(2025, 6, 24);

describe('startOfWeek', () => {
  it('resolves to the Monday of the current week', () => {
    expect(startOfWeek(THURSDAY).toDateString()).toBe(new Date(2025, 6, 21).toDateString());
  });

  it('treats Sunday as the last day of its week, not the first', () => {
    const sunday = new Date(2025, 6, 27);
    expect(startOfWeek(sunday).toDateString()).toBe(new Date(2025, 6, 21).toDateString());
  });

  it('is idempotent on a Monday', () => {
    const monday = new Date(2025, 6, 21);
    expect(startOfWeek(monday).toDateString()).toBe(monday.toDateString());
  });
});

describe('sameDay / startOfDay', () => {
  it('ignores time-of-day when comparing dates', () => {
    const morning = new Date(2025, 6, 24, 3, 0);
    const night = new Date(2025, 6, 24, 23, 59);
    expect(sameDay(morning, night)).toBe(true);
  });

  it('distinguishes different calendar days', () => {
    expect(sameDay(new Date(2025, 6, 24), new Date(2025, 6, 25))).toBe(false);
  });

  it('zeroes out the time component', () => {
    const d = startOfDay(new Date(2025, 6, 24, 15, 30, 45));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('computeView', () => {
  it('week mode: 7 daily buckets, Monday to Sunday, counting same-day completions', () => {
    const items = [
      { completedAt: new Date(2025, 6, 21, 9).toISOString() },  // Monday
      { completedAt: new Date(2025, 6, 21, 20).toISOString() }, // also Monday
      { completedAt: new Date(2025, 6, 23).toISOString() },     // Wednesday
    ];
    const view = computeView(items, 'week', 0, 'fr-FR', THURSDAY);
    expect(view.buckets).toHaveLength(7);
    expect(view.buckets[0].value).toBe(2); // Monday
    expect(view.buckets[2].value).toBe(1); // Wednesday
    expect(view.buckets[3].value).toBe(0); // Thursday — none completed
    expect(view.periodStart.toDateString()).toBe(new Date(2025, 6, 21).toDateString());
  });

  it('week mode: offset navigates to a previous calendar week', () => {
    const items = [{ completedAt: new Date(2025, 6, 14).toISOString() }]; // Monday, one week back
    const view = computeView(items, 'week', 1, 'fr-FR', THURSDAY);
    expect(view.periodStart.toDateString()).toBe(new Date(2025, 6, 14).toDateString());
    expect(view.buckets[0].value).toBe(1);
  });

  it('month mode: one bucket per calendar day of the target month', () => {
    const items = [
      { completedAt: new Date(2025, 6, 1).toISOString() },
      { completedAt: new Date(2025, 6, 31).toISOString() },
    ];
    const view = computeView(items, 'month', 0, 'fr-FR', THURSDAY);
    expect(view.buckets).toHaveLength(31); // July has 31 days
    expect(view.buckets[0].value).toBe(1);
    expect(view.buckets[30].value).toBe(1);
    expect(view.buckets[15].value).toBe(0);
  });

  it('month mode: offset crosses a year boundary correctly (January -> previous December)', () => {
    const january = new Date(2025, 0, 15);
    const items = [{ completedAt: new Date(2024, 11, 25).toISOString() }]; // Dec 25, 2024
    const view = computeView(items, 'month', 1, 'fr-FR', january);
    expect(view.buckets).toHaveLength(31); // December has 31 days
    expect(view.periodStart.getFullYear()).toBe(2024);
    expect(view.periodStart.getMonth()).toBe(11);
    expect(view.buckets[24].value).toBe(1); // index 24 = the 25th
  });

  it('year mode: 12 monthly buckets for the target year', () => {
    const items = [
      { completedAt: new Date(2025, 0, 5).toISOString() },  // January
      { completedAt: new Date(2025, 0, 20).toISOString() }, // also January
      { completedAt: new Date(2025, 11, 1).toISOString() }, // December
      { completedAt: new Date(2024, 11, 1).toISOString() }, // December of the PREVIOUS year — must not count
    ];
    const view = computeView(items, 'year', 0, 'fr-FR', THURSDAY);
    expect(view.buckets).toHaveLength(12);
    expect(view.buckets[0].value).toBe(2);  // January
    expect(view.buckets[11].value).toBe(1); // December (2025 only)
    expect(view.periodLabel).toBe('2025');
  });

  it('year mode: offset navigates to a previous year', () => {
    const items = [{ completedAt: new Date(2023, 5, 1).toISOString() }];
    const view = computeView(items, 'year', 2, 'fr-FR', THURSDAY);
    expect(view.periodLabel).toBe('2023');
    expect(view.buckets[5].value).toBe(1);
  });
});
