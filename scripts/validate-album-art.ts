import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

import { spotifyTracks } from '../src/data/spotify-tracks.js';

type TrackSource = 'spotify' | 'number-one';

interface TrackSummary {
  title: string;
  artist: string;
  slug: string;
  source: TrackSource;
  year?: number;
}

interface WikiArtEntry {
  title: string;
  artist: string;
  slug: string;
  source: TrackSource;
  year?: number;
  status: 'pending' | 'ok' | 'missing' | 'skipped';
  note?: string;
  wikiPage?: string;
  imageUrl?: string;
  rawFile?: string;
  optimized?: {
    webp?: string;
    avif?: string;
  };
  lastFetched?: string;
  lastResized?: string;
  lastValidated?: string;
  updatedAt?: string;
  error?: string;
}

interface WikiArtCache {
  meta: {
    lastFetchRun: string | null;
    lastResizeRun: string | null;
    lastValidationRun: string | null;
  };
  entries: Record<string, WikiArtEntry>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CACHE_PATH = path.resolve(ROOT_DIR, 'scripts/cache/wiki-art.json');
const YEARS_DIR = path.resolve(ROOT_DIR, 'src/content/years');
const PLACEHOLDER_PATH = path.resolve(ROOT_DIR, 'public/images/placeholder.webp');

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const createKey = (title: string, artist: string) => `${normalize(title)}::${normalize(artist)}`;

const slugify = (title: string, artist: string) =>
  `${title} ${artist}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const readJsonCache = async (): Promise<WikiArtCache> => {
  const raw = await fs.readFile(CACHE_PATH, 'utf8');
  return JSON.parse(raw) as WikiArtCache;
};

const writeJsonCache = async (cache: WikiArtCache) => {
  const serialized = `${JSON.stringify(cache, null, 2)}\n`;
  await fs.writeFile(CACHE_PATH, serialized, 'utf8');
};

const gatherTracks = async (): Promise<TrackSummary[]> => {
  const seen = new Map<string, TrackSummary>();

  for (const entry of spotifyTracks) {
    const key = createKey(entry.title, entry.artist);
    if (!seen.has(key)) {
      seen.set(key, {
        title: entry.title,
        artist: entry.artist,
        slug: slugify(entry.title, entry.artist),
        source: 'spotify',
      });
    }
  }

  try {
    const files = await fs.readdir(YEARS_DIR);
    for (const file of files) {
      if (!file.endsWith('.mdx')) continue;
      const filePath = path.join(YEARS_DIR, file);
      const contents = await fs.readFile(filePath, 'utf8');
      const parsed = matter(contents);
      const numberOnes = parsed.data?.numberOnes as unknown;
      if (!Array.isArray(numberOnes)) continue;
      const year = typeof parsed.data?.year === 'number' ? parsed.data.year : undefined;

      for (const item of numberOnes) {
        if (!item || typeof item !== 'object') continue;
        const title = 'title' in item ? String(item.title) : null;
        const artist = 'artist' in item ? String(item.artist) : null;
        if (!title || !artist) continue;
        const key = createKey(title, artist);
        if (!seen.has(key)) {
          seen.set(key, {
            title,
            artist,
            slug: slugify(title, artist),
            source: 'number-one',
            year,
          });
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return Array.from(seen.values());
};

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const validateEntry = async (
  track: TrackSummary,
  cache: WikiArtCache,
  issues: string[],
  now: string
) => {
  const entry = cache.entries[track.slug];
  if (!entry) {
    issues.push(`Missing wiki-art cache entry for ${track.title} — ${track.artist}`);
    return;
  }

  if (entry.status !== 'ok') {
    issues.push(
      `Cache entry for ${track.title} — ${track.artist} is marked '${entry.status ?? 'unknown'}' instead of 'ok'`
    );
  }

  if (!entry.rawFile) {
    issues.push(`Missing raw download for ${track.title} — ${track.artist}`);
  } else {
    const absoluteRaw = path.resolve(ROOT_DIR, entry.rawFile);
    if (!(await fileExists(absoluteRaw))) {
      issues.push(`Missing raw file on disk for ${track.title} — ${track.artist}`);
    }
  }

  const optimized = entry.optimized;
  if (!optimized?.webp || !optimized?.avif) {
    issues.push(`Missing optimized thumbnails for ${track.title} — ${track.artist}`);
  } else {
    const webpPath = path.resolve(ROOT_DIR, optimized.webp);
    const avifPath = path.resolve(ROOT_DIR, optimized.avif);
    const placeholderWebp = path.resolve(PLACEHOLDER_PATH);

    if (!(await fileExists(webpPath))) {
      issues.push(`Missing WebP thumbnail for ${track.title} — ${track.artist}`);
    } else if (webpPath === placeholderWebp) {
      issues.push(`WebP thumbnail fallback in place for ${track.title} — ${track.artist}`);
    }

    if (!(await fileExists(avifPath))) {
      issues.push(`Missing AVIF thumbnail for ${track.title} — ${track.artist}`);
    }
  }

  if (!entry.lastFetched) {
    issues.push(`Cache entry missing lastFetched timestamp for ${track.title} — ${track.artist}`);
  }

  entry.lastValidated = now;
  entry.updatedAt = now;
};

const main = async () => {
  const cache = await readJsonCache();
  const tracks = await gatherTracks();
  const now = new Date().toISOString();

  const issues: string[] = [];
  for (const track of tracks) {
    if (!cache.entries[track.slug]) {
      cache.entries[track.slug] = {
        title: track.title,
        artist: track.artist,
        slug: track.slug,
        source: track.source,
        year: track.year,
        status: 'pending',
      };
    }

    await validateEntry(track, cache, issues, now);
  }

  cache.meta.lastValidationRun = now;
  await writeJsonCache(cache);

  if (issues.length > 0) {
    const message = ['Album art validation failed:', ...issues.map((issue) => ` - ${issue}`)].join(
      '\n'
    );
    throw new Error(message);
  }

  console.log(`Validated album artwork for ${tracks.length} tracks.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
