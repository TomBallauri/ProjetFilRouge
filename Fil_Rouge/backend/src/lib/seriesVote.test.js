import { describe, it, expect } from 'vitest';
import { computeSeriesOriginalLangs } from './seriesVote.js';

describe('computeSeriesOriginalLangs', () => {
  it('ignore les défis sans seriesName', () => {
    const result = computeSeriesOriginalLangs([{ seriesName: null, originalLang: 'en' }]);
    expect(result.size).toBe(0);
  });

  it('traite originalLang manquant comme fr', () => {
    const result = computeSeriesOriginalLangs([{ seriesName: 'Yoga', originalLang: undefined }]);
    expect(result.get('Yoga')).toBe('fr');
  });

  it('vote majoritaire fr quand la majorité des défis sont en fr', () => {
    const challenges = [
      { seriesName: 'Cuisine', originalLang: 'fr' },
      { seriesName: 'Cuisine', originalLang: 'fr' },
      { seriesName: 'Cuisine', originalLang: 'en' },
    ];
    expect(computeSeriesOriginalLangs(challenges).get('Cuisine')).toBe('fr');
  });

  it('vote majoritaire en quand la majorité des défis sont en en, malgré un défi modifié individuellement en fr', () => {
    // Reproduit le bug corrigé cette session : un seul défi édité sous une autre langue
    // d'interface ne doit pas faire basculer toute la série.
    const challenges = [
      { seriesName: 'Fitness', originalLang: 'en' },
      { seriesName: 'Fitness', originalLang: 'en' },
      { seriesName: 'Fitness', originalLang: 'en' },
      { seriesName: 'Fitness', originalLang: 'fr' },
    ];
    expect(computeSeriesOriginalLangs(challenges).get('Fitness')).toBe('en');
  });

  it('égalité stricte retombe sur fr', () => {
    const challenges = [
      { seriesName: 'Lecture', originalLang: 'fr' },
      { seriesName: 'Lecture', originalLang: 'en' },
    ];
    expect(computeSeriesOriginalLangs(challenges).get('Lecture')).toBe('fr');
  });

  it('gère plusieurs séries indépendamment', () => {
    const challenges = [
      { seriesName: 'A', originalLang: 'en' },
      { seriesName: 'B', originalLang: 'fr' },
    ];
    const result = computeSeriesOriginalLangs(challenges);
    expect(result.get('A')).toBe('en');
    expect(result.get('B')).toBe('fr');
  });
});
