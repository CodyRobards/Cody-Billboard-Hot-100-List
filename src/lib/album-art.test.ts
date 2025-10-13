import { describe, expect, it } from 'vitest';
import { generateAlbumArtSlug, getAlbumArt } from './album-art';

describe('album art helpers', () => {
  it('creates a slug matching the manifest format', () => {
    expect(generateAlbumArtSlug('21 Questions', '50 Cent feat. Nate Dogg')).toBe(
      '21-questions-50-cent-feat-nate-dogg'
    );
  });

  it('returns manifest-backed artwork when available', () => {
    const art = getAlbumArt('...Baby One More Time', 'Britney Spears');
    expect(art.webp).toBe('/images/covers/baby-one-more-time-britney-spears.webp');
    expect(art.avif).toBe('/images/covers/baby-one-more-time-britney-spears.avif');
    expect(art.alt).toBe('Album artwork for “...Baby One More Time” by Britney Spears');
  });

  it('falls back to the placeholder when missing', () => {
    const art = getAlbumArt('Nonexistent Song', 'Imaginary Artist');
    expect(art.webp).toBe('/images/placeholder.webp');
    expect(art.avif).toBeUndefined();
  });
});
