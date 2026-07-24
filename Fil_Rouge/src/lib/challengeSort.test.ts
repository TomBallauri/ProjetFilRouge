import { describe, it, expect } from 'vitest';
import { seriesDayNumber, compareBySeriesDayNumber } from './challengeSort';

describe('seriesDayNumber', () => {
  it('extracts the day number from a French title', () => {
    expect(seriesDayNumber('Jour 3: Premier livre')).toBe(3);
  });

  it('extracts the day number from an English title', () => {
    // Regression test: the old implementation matched only the French word "Jour" via
    // /^Jour\s+(\d+)/i, so English titles ("Day 3: ...") always returned null and the
    // series sort silently did nothing once the app was switched to English.
    expect(seriesDayNumber('Day 3: First Book')).toBe(3);
  });

  it('picks the first number when the title has several', () => {
    expect(seriesDayNumber('Jour 12: Lire 5 pages')).toBe(12);
  });

  it('returns null when there is no number in the title', () => {
    expect(seriesDayNumber('Sans numéro')).toBeNull();
  });
});

describe('compareBySeriesDayNumber', () => {
  type Item = { challenge: { title: string; seriesName?: string | null } };
  const item = (title: string, seriesName: string | null = 'Lecture'): Item => ({ challenge: { title, seriesName } });

  it('sorts items within the same series by day number, ascending', () => {
    const items = [item('Jour 3: C'), item('Jour 1: A'), item('Jour 2: B')];
    const sorted = [...items].sort(compareBySeriesDayNumber);
    expect(sorted.map(i => i.challenge.title)).toEqual(['Jour 1: A', 'Jour 2: B', 'Jour 3: C']);
  });

  it('works across languages within the same series', () => {
    const items = [item('Day 2: B'), item('Day 1: A')];
    const sorted = [...items].sort(compareBySeriesDayNumber);
    expect(sorted.map(i => i.challenge.title)).toEqual(['Day 1: A', 'Day 2: B']);
  });

  it('does not reorder items belonging to different series', () => {
    const items = [item('Jour 5: X', 'Cuisine'), item('Jour 1: Y', 'Lecture')];
    const sorted = [...items].sort(compareBySeriesDayNumber);
    // Neither belongs to the same series as its neighbor, so the comparator returns 0 for
    // both and the original relative order is preserved (stable sort).
    expect(sorted.map(i => i.challenge.title)).toEqual(['Jour 5: X', 'Jour 1: Y']);
  });

  it('leaves solo (non-series) challenges in their original order', () => {
    const items = [item('Défi B', null), item('Défi A', null)];
    const sorted = [...items].sort(compareBySeriesDayNumber);
    expect(sorted.map(i => i.challenge.title)).toEqual(['Défi B', 'Défi A']);
  });
});
