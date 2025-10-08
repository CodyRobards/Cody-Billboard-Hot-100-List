import { describe, expect, it } from 'vitest';
import { slugifyHeading } from './slugify';

describe('slugifyHeading', () => {
  it('converts spaces and punctuation into hyphenated ids', () => {
    expect(slugifyHeading('Number One Hits! 1999 Edition')).toBe('number-one-hits-1999-edition');
  });

  it('removes diacritics and normalizes casing', () => {
    expect(slugifyHeading("Beyoncé's Résumé")).toBe('beyonces-resume');
  });

  it('falls back to a stable id when no alphanumeric characters remain', () => {
    expect(slugifyHeading('***')).toBe('section-heading');
  });
});
