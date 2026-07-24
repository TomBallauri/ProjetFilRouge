import { describe, it, expect } from 'vitest';
import { streakMultiplier, nextStreakMilestone, streakWeekProgress } from './streak';

describe('streakMultiplier', () => {
  it('is ×1 with no streak', () => {
    expect(streakMultiplier(0)).toBe(1);
  });

  it('is unchanged within the first 7-day week', () => {
    expect(streakMultiplier(6)).toBe(1);
  });

  it('bumps by +5% at each full week of streak', () => {
    expect(streakMultiplier(7)).toBe(1.05);
    expect(streakMultiplier(14)).toBe(1.1);
    expect(streakMultiplier(21)).toBe(1.15);
  });

  it('caps at ×3 no matter how long the streak', () => {
    expect(streakMultiplier(1000)).toBe(3);
  });
});

describe('nextStreakMilestone', () => {
  it('targets 7 for a fresh streak', () => {
    expect(nextStreakMilestone(0)).toBe(7);
  });

  it('targets the next milestone once the previous one is passed', () => {
    expect(nextStreakMilestone(7)).toBe(14);
    expect(nextStreakMilestone(29)).toBe(30);
  });

  it('falls back to 100 once every milestone has been passed', () => {
    expect(nextStreakMilestone(100)).toBe(100);
    expect(nextStreakMilestone(500)).toBe(100);
  });
});

describe('streakWeekProgress', () => {
  it('is 0 right at the start of a week', () => {
    expect(streakWeekProgress(0)).toBe(0);
    expect(streakWeekProgress(7)).toBe(0);
  });

  it('grows fractionally through the week', () => {
    expect(streakWeekProgress(3)).toBeCloseTo(3 / 7);
    expect(streakWeekProgress(6)).toBeCloseTo(6 / 7);
  });
});
