import { describe, it, expect } from 'vitest';
import { seriesDayNumber, daysElapsedSince, seriesLockInfo } from './seriesLock.js';

describe('seriesDayNumber', () => {
  it('extrait le premier nombre trouvé dans le titre', () => {
    expect(seriesDayNumber('Jour 3 : cuisine')).toBe(3);
    expect(seriesDayNumber('Jour 12')).toBe(12);
  });

  it('renvoie null quand le titre ne contient aucun nombre', () => {
    expect(seriesDayNumber('Défi surprise')).toBeNull();
  });
});

describe('daysElapsedSince', () => {
  it('renvoie 0 pour une date d\'aujourd\'hui', () => {
    expect(daysElapsedSince(new Date())).toBe(0);
  });

  it('renvoie 1 pour hier', () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    expect(daysElapsedSince(yesterday)).toBe(1);
  });

  it('renvoie 2 pour avant-hier', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
    expect(daysElapsedSince(twoDaysAgo)).toBe(2);
  });
});

describe('seriesLockInfo', () => {
  it('jour 1 (ou sans numéro) jamais verrouillé', () => {
    expect(seriesLockInfo(1, new Map())).toBeNull();
    expect(seriesLockInfo(null, new Map())).toBeNull();
  });

  it('verrouillé tant que le jour précédent n\'est pas complété', () => {
    const progress = new Map([[1, { status: 'IN_PROGRESS', completedAt: null }]]);
    expect(seriesLockInfo(2, progress)).toEqual({ previousDayIncomplete: true, daysUntilUnlock: null });
  });

  it('verrouillé quand le jour précédent n\'a jamais été démarré', () => {
    expect(seriesLockInfo(2, new Map())).toEqual({ previousDayIncomplete: true, daysUntilUnlock: null });
  });

  it('verrouillé avec un compte à rebours le jour même de la complétion du jour précédent', () => {
    const progress = new Map([[1, { status: 'COMPLETED', completedAt: new Date() }]]);
    expect(seriesLockInfo(2, progress)).toEqual({ previousDayIncomplete: false, daysUntilUnlock: 1 });
  });

  it('débloqué le lendemain (UTC) de la complétion du jour précédent', () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const progress = new Map([[1, { status: 'COMPLETED', completedAt: yesterday }]]);
    expect(seriesLockInfo(2, progress)).toBeNull();
  });

  it('reste débloqué même après un long retard (pas de re-verrouillage)', () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
    const progress = new Map([[1, { status: 'COMPLETED', completedAt: twoWeeksAgo }]]);
    expect(seriesLockInfo(2, progress)).toBeNull();
  });
});
