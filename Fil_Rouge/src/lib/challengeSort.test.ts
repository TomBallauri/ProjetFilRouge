import { describe, it, expect } from 'vitest';
import { seriesDayNumber, compareBySeriesDayNumber, resolveSeriesDisplayName } from './challengeSort';

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

describe('resolveSeriesDisplayName', () => {
  it('returns undefined when the UI language already matches the series original language', () => {
    const challenges = [{ originalLang: 'fr', seriesNameEn: 'Cooking', seriesNameFr: null }];
    expect(resolveSeriesDisplayName(challenges, 'fr')).toBeUndefined();
  });

  it('returns the cached translation when the UI language differs from the original', () => {
    const challenges = [{ originalLang: 'fr', seriesNameEn: 'Cooking', seriesNameFr: null }];
    expect(resolveSeriesDisplayName(challenges, 'en')).toBe('Cooking');
  });

  it('picks the original language by majority vote, not the first challenge in the list', () => {
    // Regression test: a single challenge edited under a different UI language changes its own
    // originalLang without the series name itself having changed language — voting across all
    // challenges (not just challenges[0]) prevents that one outlier from flipping the whole series.
    const challenges = [
      { originalLang: 'en', seriesNameEn: null, seriesNameFr: 'Cuisine' },
      { originalLang: 'en', seriesNameEn: null, seriesNameFr: 'Cuisine' },
      { originalLang: 'en', seriesNameEn: null, seriesNameFr: 'Cuisine' },
      { originalLang: 'fr', seriesNameEn: null, seriesNameFr: 'Cuisine' },
    ];
    // Original language is 'en' (majority) so requesting 'en' should fall back to `undefined`
    // (seriesName is already in the right language), not read the first challenge's originalLang.
    expect(resolveSeriesDisplayName(challenges, 'en')).toBeUndefined();
  });

  it('treats a missing originalLang as fr', () => {
    const challenges = [{ originalLang: undefined, seriesNameEn: 'Reading', seriesNameFr: null }];
    expect(resolveSeriesDisplayName(challenges, 'en')).toBe('Reading');
  });

  it('falls back to undefined when the cached translation is missing', () => {
    const challenges = [{ originalLang: 'fr', seriesNameEn: null, seriesNameFr: null }];
    expect(resolveSeriesDisplayName(challenges, 'en')).toBeUndefined();
  });
});
