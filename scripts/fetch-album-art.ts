import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
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

interface WikimediaPage {
  pageid?: number;
  index?: number;
  fullurl?: string;
  original?: { source?: string };
  pageprops?: Record<string, string>;
  images?: WikimediaImageListing[];
}

interface WikimediaImageListing {
  title: string;
}

interface WikimediaImageInfoPage {
  imageinfo?: { url?: string }[];
}

interface WikimediaQueryResponse<T> {
  query?: {
    pages?: Record<string, T>;
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.resolve(ROOT_DIR, 'raw-album-art');
const CACHE_PATH = path.resolve(ROOT_DIR, 'scripts/cache/wiki-art.json');
const YEARS_DIR = path.resolve(ROOT_DIR, 'src/content/years');

const RATE_LIMIT_MS = 750;
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY = 400;
const SEARCH_RESULTS_LIMIT = 5;

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const slugify = (title: string, artist: string) =>
  `${title} ${artist}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const createKey = (title: string, artist: string) => `${normalize(title)}::${normalize(artist)}`;

const ensureDir = async (target: string) => {
  await fs.mkdir(target, { recursive: true });
};

const readJsonCache = async (): Promise<WikiArtCache> => {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw) as WikiArtCache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        meta: {
          lastFetchRun: null,
          lastResizeRun: null,
          lastValidationRun: null,
        },
        entries: {},
      } satisfies WikiArtCache;
    }

    throw error;
  }
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

  return Array.from(seen.values()).sort((a, b) => a.slug.localeCompare(b.slug));
};

const rateLimiter = (() => {
  let nextAvailable = Date.now();
  return async () => {
    const now = Date.now();
    if (now < nextAvailable) {
      await delay(nextAvailable - now);
    }
    nextAvailable = Date.now() + RATE_LIMIT_MS;
  };
})();

const withRetries = async <T>(operation: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= MAX_RETRIES) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt > MAX_RETRIES) break;
      const delayMs = RETRY_BASE_DELAY * 2 ** (attempt - 1);
      await delay(delayMs + Math.random() * 150);
    }
  }
  throw lastError;
};

const callWikimedia = async <T = unknown>(params: Record<string, string>): Promise<T> => {
  const searchParams = new URLSearchParams({
    format: 'json',
    origin: '*',
    redirects: '1',
    ...params,
  });
  const url = `https://en.wikipedia.org/w/api.php?${searchParams.toString()}`;
  await rateLimiter();
  const response = await withRetries(async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Billboard-Hot-100-Art-Fetcher/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Wikimedia request failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  });
  return response as T;
};

const pickImageFromPage = async (
  page: WikimediaPage
): Promise<{ imageUrl: string; pageUrl?: string } | null> => {
  if (page?.original?.source) {
    return {
      imageUrl: page.original.source as string,
      pageUrl: page.fullurl as string | undefined,
    };
  }

  if (!page?.pageid) return null;

  const imageQuery = await callWikimedia<WikimediaQueryResponse<WikimediaPage>>({
    action: 'query',
    prop: 'images',
    pageids: String(page.pageid),
  });

  const pageKey = String(page.pageid);
  const images = imageQuery.query?.pages?.[pageKey]?.images;
  if (!images?.length) return null;

  const preference = (title: string) => {
    const normalized = title.toLowerCase();
    if (normalized.includes('cover')) return 0;
    if (normalized.includes('album')) return 1;
    if (normalized.includes('front')) return 2;
    return 3;
  };

  const preferred = images
    .map((img) => img.title)
    .filter((title) => typeof title === 'string')
    .sort((a, b) => preference(a) - preference(b));

  for (const imageTitle of preferred) {
    if (!imageTitle.startsWith('File:')) continue;
    try {
      const details = await callWikimedia<WikimediaQueryResponse<WikimediaImageInfoPage>>({
        action: 'query',
        prop: 'imageinfo',
        titles: imageTitle,
        iiprop: 'url|mime',
        iiurlwidth: '1024',
      });
      const pageInfo = details.query?.pages;
      if (!pageInfo) continue;
      const fileInfo = Object.values(pageInfo)[0];
      const info = Array.isArray(fileInfo?.imageinfo) ? fileInfo.imageinfo[0] : undefined;
      if (info?.url) {
        return { imageUrl: info.url as string, pageUrl: page.fullurl as string | undefined };
      }
    } catch (error) {
      console.warn(`Failed to inspect image ${imageTitle}:`, error);
    }
  }

  return null;
};

const findImageForTrack = async (
  track: TrackSummary
): Promise<{ imageUrl: string; pageUrl?: string } | null> => {
  const baseQuery = `${track.title} ${track.artist}`;
  const searchTerms = [
    `${baseQuery} single cover art`,
    `${baseQuery} album cover`,
    `${baseQuery} cover art`,
  ];

  for (const term of searchTerms) {
    const result = await callWikimedia<WikimediaQueryResponse<WikimediaPage>>({
      action: 'query',
      prop: 'pageimages|info|pageprops',
      generator: 'search',
      gsrlimit: String(SEARCH_RESULTS_LIMIT),
      gsrsearch: term,
      piprop: 'original',
      inprop: 'url',
    });

    const pages = result.query?.pages;
    if (!pages) continue;

    const candidates = Object.values(pages)
      .filter((value): value is WikimediaPage => Boolean(value))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    for (const page of candidates) {
      const picked = await pickImageFromPage(page);
      if (picked) return picked;

      const pageProps = page?.pageprops;
      const albumTitle = pageProps?.disambiguation ? undefined : pageProps?.wikibase_item;
      if (albumTitle) {
        try {
          const sitelinks = await callWikimedia<{
            entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
          }>({
            action: 'wbgetentities',
            format: 'json',
            ids: albumTitle,
            props: 'sitelinks',
          });
          const enwiki = sitelinks.entities?.[albumTitle]?.sitelinks?.enwiki?.title;
          if (enwiki) {
            const followUp = await callWikimedia<WikimediaQueryResponse<WikimediaPage>>({
              action: 'query',
              prop: 'pageimages|info',
              titles: enwiki,
              piprop: 'original',
              inprop: 'url',
            });
            const followPages = followUp.query?.pages;
            if (followPages) {
              const followEntry = Object.values(followPages)[0];
              const pickedFollow = await pickImageFromPage(followEntry);
              if (pickedFollow) return pickedFollow;
            }
          }
        } catch (error) {
          console.warn(`Failed to follow album entity for ${track.title}:`, error);
        }
      }
    }
  }

  return null;
};

const downloadImage = async (url: string, destination: string) => {
  await rateLimiter();
  const buffer = await withRetries(async () => {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Billboard-Hot-100-Art-Fetcher/1.0' },
    });
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  });
  await fs.writeFile(destination, buffer);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let resume = false;
  let skipExisting = false;
  let limit: number | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--resume') {
      resume = true;
    } else if (arg === '--skip-existing') {
      skipExisting = true;
    } else if (arg === '--limit') {
      const value = Number(args[i + 1]);
      if (Number.isFinite(value) && value > 0) {
        limit = value;
      }
      i += 1;
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0) {
        limit = value;
      }
    }
  }

  return { resume, skipExisting, limit };
};

const ensureEntry = (cache: WikiArtCache, track: TrackSummary) => {
  if (!cache.entries[track.slug]) {
    cache.entries[track.slug] = {
      title: track.title,
      artist: track.artist,
      slug: track.slug,
      source: track.source,
      year: track.year,
      status: 'pending',
    } satisfies WikiArtEntry;
  }
  return cache.entries[track.slug];
};

const main = async () => {
  await ensureDir(RAW_DIR);

  const { resume, skipExisting, limit } = parseArgs();
  const cache = await readJsonCache();
  const tracks = await gatherTracks();

  let processed = 0;
  for (const track of tracks) {
    if (limit !== null && processed >= limit) {
      break;
    }

    const entry = ensureEntry(cache, track);
    const existingRawFile = entry.rawFile ? path.resolve(ROOT_DIR, entry.rawFile) : null;

    const hasRawFile = existingRawFile
      ? await fs
          .access(existingRawFile)
          .then(() => true)
          .catch(() => false)
      : false;

    if (resume && entry.status === 'ok' && hasRawFile) {
      continue;
    }

    if (skipExisting && hasRawFile) {
      entry.status = 'skipped';
      entry.note = 'Skipped existing raw asset';
      entry.updatedAt = new Date().toISOString();
      continue;
    }

    try {
      const result = await findImageForTrack(track);
      if (!result) {
        entry.status = 'missing';
        entry.error = 'No image located via Wikimedia API';
        entry.updatedAt = new Date().toISOString();
        console.warn(`No art found for ${track.title} — ${track.artist}`);
        continue;
      }

      const imageUrl = result.imageUrl;
      const extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const fileName = `${track.slug}${extension}`;
      const destination = path.join(RAW_DIR, fileName);
      await downloadImage(imageUrl, destination);

      const relativeRawPath = path.relative(ROOT_DIR, destination);

      entry.status = 'ok';
      entry.imageUrl = imageUrl;
      entry.wikiPage = result.pageUrl;
      entry.rawFile = relativeRawPath;
      entry.lastFetched = new Date().toISOString();
      entry.updatedAt = entry.lastFetched;
      delete entry.error;
      delete entry.note;
      processed += 1;
      console.log(`Fetched artwork for ${track.title} — ${track.artist}`);
    } catch (error) {
      entry.status = 'missing';
      entry.error = error instanceof Error ? error.message : String(error);
      entry.updatedAt = new Date().toISOString();
      console.error(`Failed to fetch ${track.title} — ${track.artist}:`, error);
    }
  }

  cache.meta.lastFetchRun = new Date().toISOString();
  await writeJsonCache(cache);

  console.log(`Processed ${processed} track${processed === 1 ? '' : 's'}.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
