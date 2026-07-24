import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it.each([
    'test@example.com',
    'a@b.co',
    'user.name+tag@sub.example.com',
  ])('accepts a valid email: %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each([
    ['no-at-sign.com', 'missing @'],
    ['@example.com', 'empty local part'],
    ['test@', 'empty domain'],
    ['test@@example.com', 'two @ signs'],
    ['test @example.com', 'contains whitespace'],
    ['test@example', 'domain has no dot'],
    ['test@.com', 'domain starts with a dot'],
    ['test@example.', 'domain ends with a dot'],
    ['', 'empty string'],
  ])('rejects an invalid email: %s (%s)', (email) => {
    expect(validateEmail(email)).toBe(false);
  });
});
