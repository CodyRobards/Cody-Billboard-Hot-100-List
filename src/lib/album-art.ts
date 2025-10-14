import coverManifest from '../../scripts/cache/cover-manifest.json';
import { generateAlbumArtSlug as createAlbumArtSlug } from './album-art-slug.js';

export { generateAlbumArtSlug } from './album-art-slug.js';

export interface AlbumArtSource {
  webp: string;
  avif?: string;
  alt: string;
  slug: string | null;
}

interface CoverManifestEntry {
  webp: string;
  avif?: string;
  source?: string;
}

const PLACEHOLDER_WEBP = '/images/placeholder.webp';

const manifest = coverManifest as Record<string, CoverManifestEntry>;

const normalizeManifestPath = (path: string): string => {
  return path.startsWith('public/') ? `/${path.slice(7)}` : path;
};

const buildAltText = (title: string, artist: string): string => {
  const normalizedTitle = title?.trim();
  const normalizedArtist = artist?.trim();
  if (normalizedTitle && normalizedArtist) {
    return `Album artwork for “${normalizedTitle}” by ${normalizedArtist}`;
  }

  if (normalizedTitle) {
    return `Album artwork for “${normalizedTitle}”`;
  }

  return 'Album artwork';
};

export const getAlbumArt = (title: string, artist: string): AlbumArtSource => {
  const slug = createAlbumArtSlug(title, artist);
  if (slug) {
    const entry = manifest[slug];
    if (entry) {
      const webp = normalizeManifestPath(entry.webp);
      const avif = entry.avif ? normalizeManifestPath(entry.avif) : undefined;
      return {
        webp,
        avif,
        alt: buildAltText(title, artist),
        slug,
      };
    }
  }

  return {
    webp: PLACEHOLDER_WEBP,
    alt: buildAltText(title, artist),
    avif: undefined,
    slug,
  };
};
