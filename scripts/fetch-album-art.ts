import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import matter from 'gray-matter';

import { getSpotifyTrackId, spotifyTracks } from '../src/data/spotify-tracks.js';

import 'dotenv/config';

type TrackSource = 'spotify' | 'number-one';

interface TrackSummary {
  title: string;
  artist: string;
  slug: string;
  source: TrackSource;
  year?: number;
}

interface SpotifyArtMetadata {
  trackId?: string;
  trackName?: string;
  albumId?: string;
  albumName?: string;
  releaseDate?: string;
  releaseDatePrecision?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

interface AlbumArtEntry {
  title: string;
  artist: string;
  slug: string;
  source: TrackSource;
  year?: number;
  status: 'pending' | 'ok' | 'missing' | 'skipped';
  note?: string;
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
  imageUrl?: string;
  spotify?: SpotifyArtMetadata;
}

interface AlbumArtCache {
  meta: {
    lastFetchRun: string | null;
    lastResizeRun: string | null;
    lastValidationRun: string | null;
  };
  entries: Record<string, AlbumArtEntry>;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface SpotifyImage {
  url?: string;
  width?: number;
  height?: number;
}

interface SpotifyAlbum {
  id?: string;
  name?: string;
  release_date?: string;
  release_date_precision?: string;
  images?: SpotifyImage[];
}

interface SpotifyTrackResponse {
  id?: string;
  name?: string;
  album?: SpotifyAlbum;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.resolve(ROOT_DIR, 'raw-album-art');
const CACHE_PATH = path.resolve(ROOT_DIR, 'scripts/cache/wiki-art.json');
const YEARS_DIR = path.resolve(ROOT_DIR, 'src/content/years');

const RATE_LIMIT_MS = 250;
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY = 400;

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

const readJsonCache = async (): Promise<AlbumArtCache> => {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw) as AlbumArtCache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        meta: {
          lastFetchRun: null,
          lastResizeRun: null,
          lastValidationRun: null,
        },
        entries: {},
      } satisfies AlbumArtCache;
    }

    throw error;
  }
};

const writeJsonCache = async (cache: AlbumArtCache) => {
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

const ensureEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required ${name} environment variable.`);
  }
  return value;
};

const createSpotifyTokenManager = () => {
  const clientId = ensureEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = ensureEnv('SPOTIFY_CLIENT_SECRET');

  let accessToken: string | null = null;
  let expiresAt = 0;

  const requestToken = async () => {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to obtain Spotify access token: ${response.status} ${response.statusText}${body ? ` – ${body}` : ''}`
      );
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    accessToken = data.access_token;
    const lifetimeSeconds = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    const safetyWindowSeconds = 60;
    const effectiveLifetime = Math.max(lifetimeSeconds - safetyWindowSeconds, 60);
    expiresAt = Date.now() + effectiveLifetime * 1000;
  };

  const getToken = async () => {
    if (!accessToken || Date.now() >= expiresAt) {
      await withRetries(requestToken);
    }
    return accessToken!;
  };

  const invalidate = () => {
    accessToken = null;
    expiresAt = 0;
  };

  return { getToken, invalidate };
};

const createSpotifyClient = () => {
  const tokens = createSpotifyTokenManager();

  const call = async <T>(path: string): Promise<T> => {
    return withRetries(async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const token = await tokens.getToken();
        await rateLimiter();
        const response = await fetch(`https://api.spotify.com/v1${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 && attempt === 0) {
          tokens.invalidate();
          continue;
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Spotify request failed: ${response.status} ${response.statusText}${body ? ` – ${body}` : ''}`
          );
        }

        return (await response.json()) as T;
      }

      throw new Error('Spotify authentication failed after refresh attempt.');
    });
  };

  const getTrack = async (trackId: string) =>
    call<SpotifyTrackResponse>(`/tracks/${encodeURIComponent(trackId)}`);

  return { getTrack };
};

const pickLargestImage = (images: SpotifyImage[] | undefined) => {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const best = sorted.find((image) => typeof image.url === 'string');
  if (!best?.url) return null;
  return best as Required<Pick<SpotifyImage, 'url'>> & SpotifyImage;
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

const ensureEntry = (cache: AlbumArtCache, track: TrackSummary) => {
  if (!cache.entries[track.slug]) {
    cache.entries[track.slug] = {
      title: track.title,
      artist: track.artist,
      slug: track.slug,
      source: track.source,
      year: track.year,
      status: 'pending',
      spotify: {},
    } satisfies AlbumArtEntry;
  }
  const entry = cache.entries[track.slug];
  if (!entry.spotify) {
    entry.spotify = {};
  }
  return entry;
};

const main = async () => {
  await ensureDir(RAW_DIR);

  const { resume, skipExisting, limit } = parseArgs();
  const cache = await readJsonCache();
  const tracks = await gatherTracks();
  const spotify = createSpotifyClient();

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

    const spotifyTrackId = getSpotifyTrackId(track.title, track.artist);
    if (!spotifyTrackId) {
      entry.status = 'missing';
      entry.error = 'No Spotify track ID found for this track';
      entry.spotify = {
        trackId: undefined,
        trackName: undefined,
        albumId: undefined,
        albumName: undefined,
        releaseDate: undefined,
        releaseDatePrecision: undefined,
        imageUrl: undefined,
        imageWidth: undefined,
        imageHeight: undefined,
      };
      entry.updatedAt = new Date().toISOString();
      console.warn(`No Spotify track mapping found for ${track.title} — ${track.artist}`);
      continue;
    }

    try {
      entry.spotify = { trackId: spotifyTrackId };

      const trackData = await spotify.getTrack(spotifyTrackId);
      const album = trackData.album;
      const image = pickLargestImage(album?.images);

      entry.spotify = {
        trackId: spotifyTrackId,
        trackName: trackData.name ?? undefined,
        albumId: album?.id ?? undefined,
        albumName: album?.name ?? undefined,
        releaseDate: album?.release_date ?? undefined,
        releaseDatePrecision: album?.release_date_precision ?? undefined,
        imageUrl: image?.url ?? undefined,
        imageWidth: image?.width ?? undefined,
        imageHeight: image?.height ?? undefined,
      };

      if (!image?.url) {
        entry.status = 'missing';
        entry.error = 'Spotify album is missing artwork';
        entry.imageUrl = undefined;
        entry.updatedAt = new Date().toISOString();
        console.warn(`Spotify album lacks artwork for ${track.title} — ${track.artist}`);
        continue;
      }

      const imageUrl = image.url;
      const extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const fileName = `${track.slug}${extension}`;
      const destination = path.join(RAW_DIR, fileName);
      await downloadImage(imageUrl, destination);

      const relativeRawPath = path.relative(ROOT_DIR, destination).replace(/\\/g, '/');
      const fetchedAt = new Date().toISOString();

      entry.status = 'ok';
      entry.imageUrl = imageUrl;
      entry.rawFile = relativeRawPath;
      entry.lastFetched = fetchedAt;
      entry.updatedAt = fetchedAt;
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
