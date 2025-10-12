import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const API_ENDPOINT = 'https://en.wikipedia.org/w/api.php';
const MIME_PREFIX = 'image/';

const COVER_KEYWORDS = [
  { keyword: 'album cover', weight: 260 },
  { keyword: 'single cover', weight: 250 },
  { keyword: 'cover art', weight: 240 },
  { keyword: 'cd cover', weight: 220 },
  { keyword: 'vinyl cover', weight: 220 },
  { keyword: 'front cover', weight: 230 },
  { keyword: 'front sleeve', weight: 200 },
  { keyword: 'cover', weight: 210 },
  { keyword: 'album', weight: 120 },
  { keyword: 'single', weight: 110 },
  { keyword: 'front', weight: 150 },
  { keyword: 'sleeve', weight: 140 },
  { keyword: 'jacket', weight: 130 },
  { keyword: 'artwork', weight: 120 },
  { keyword: 'picture sleeve', weight: 210 },
];

const SUPPORTING_KEYWORDS = [
  { keyword: 'promo', weight: 35 },
  { keyword: 'cassette', weight: 45 },
  { keyword: '7"', weight: 30 },
  { keyword: '7-inch', weight: 30 },
  { keyword: '12"', weight: 35 },
  { keyword: '12-inch', weight: 35 },
  { keyword: 'compact disc', weight: 40 },
  { keyword: 'picture disc', weight: 45 },
  { keyword: 'record sleeve', weight: 120 },
];

const NEGATIVE_KEYWORDS = [
  { keyword: 'logo', weight: -200 },
  { keyword: 'band', weight: -80 },
  { keyword: 'group', weight: -80 },
  { keyword: 'live', weight: -160 },
  { keyword: 'concert', weight: -150 },
  { keyword: 'performance', weight: -120 },
  { keyword: 'back cover', weight: -120 },
  { keyword: 'back sleeve', weight: -120 },
  { keyword: 'reverse', weight: -110 },
  { keyword: 'poster', weight: -80 },
  { keyword: 'ticket', weight: -90 },
  { keyword: 'lyrics', weight: -90 },
  { keyword: 'chart', weight: -70 },
  { keyword: 'map', weight: -100 },
  { keyword: 'booklet', weight: -60 },
  { keyword: 'photo', weight: -40 },
  { keyword: 'press', weight: -40 },
  { keyword: 'signature', weight: -60 },
];

const IMAGE_TYPE_BONUS: Record<string, number> = {
  'image/jpeg': 25,
  'image/jpg': 25,
  'image/png': 10,
};

const IMAGE_TYPE_PENALTY: Record<string, number> = {
  'image/svg+xml': -40,
  'image/gif': -20,
};

const DEFAULT_LOGGER: Required<Pick<Console, 'debug' | 'info' | 'warn'>> = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
};

type Logger = typeof DEFAULT_LOGGER;

interface ExtMetadataValue {
  value?: string;
}

interface MediaWikiImageInfo {
  url: string;
  mime?: string;
  extmetadata?: Record<string, ExtMetadataValue>;
}

interface MediaWikiImage {
  title: string;
}

interface MediaWikiPage {
  pageid: number;
  title: string;
  images?: MediaWikiImage[];
}

export interface PickedImage {
  title: string;
  url: string;
  mime: string;
  score: number;
  isCoverLike: boolean;
  metadataText: string;
}

export interface PickImageOptions {
  logger?: Logger;
  fetchFn?: typeof fetch;
}

async function queryMediaWiki<T>(
  params: Record<string, string>,
  fetchFn: typeof fetch
): Promise<T> {
  const searchParams = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    ...params,
  });

  const response = await fetchFn(`${API_ENDPOINT}?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`MediaWiki request failed with ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchPageByTitle(
  title: string,
  fetchFn: typeof fetch
): Promise<MediaWikiPage | undefined> {
  interface QueryResponse {
    query?: {
      pages?: MediaWikiPage[];
    };
  }

  const data = await queryMediaWiki<QueryResponse>(
    {
      action: 'query',
      redirects: '1',
      prop: 'images',
      imlimit: 'max',
      titles: title,
    },
    fetchFn
  );

  const page = data.query?.pages?.[0];
  if (!page || (page as unknown as { missing?: string }).missing) {
    return undefined;
  }

  return page;
}

async function fetchImageInfo(
  title: string,
  fetchFn: typeof fetch,
  logger: Logger
): Promise<MediaWikiImageInfo | undefined> {
  interface ImageInfoResponse {
    query?: {
      pages?: {
        imageinfo?: MediaWikiImageInfo[];
      }[];
    };
  }

  try {
    const data = await queryMediaWiki<ImageInfoResponse>(
      {
        action: 'query',
        prop: 'imageinfo',
        titles: title,
        iiprop: 'url|mime|extmetadata',
      },
      fetchFn
    );

    const info = data.query?.pages?.[0]?.imageinfo?.[0];
    if (!info?.url || !info.mime) {
      logger.debug(`Skipping ${title} because it lacks imageinfo url or mime.`);
      return undefined;
    }

    return info;
  } catch (error) {
    logger.warn(`Failed to fetch imageinfo for ${title}: ${(error as Error).message}`);
    return undefined;
  }
}

function normalizeText(value: string | undefined): string {
  return (
    value
      ?.toLowerCase()
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

function buildMetadataText(title: string, info: MediaWikiImageInfo): string {
  const pieces = new Set<string>();
  pieces.add(normalizeText(title.replace(/^File:/i, '').replace(/[_-]+/g, ' ')));

  if (info.extmetadata) {
    const fields = [
      'ObjectName',
      'ImageDescription',
      'Categories',
      'Credit',
      'LicenseShortName',
      'LicenseUrl',
    ];
    for (const field of fields) {
      const value = normalizeText(info.extmetadata[field]?.value);
      if (value) {
        pieces.add(value);
      }
    }
  }

  return Array.from(pieces).join(' ').replace(/\s+/g, ' ').trim();
}

function scoreCandidate(
  metadataText: string,
  mime: string
): { score: number; isCoverLike: boolean } {
  let score = 0;
  let isCoverLike = false;

  const text = metadataText;

  for (const { keyword, weight } of COVER_KEYWORDS) {
    if (text.includes(keyword)) {
      score += weight;
      if (
        keyword.includes('cover') ||
        keyword === 'album' ||
        keyword === 'single' ||
        keyword === 'front' ||
        keyword === 'sleeve' ||
        keyword === 'jacket' ||
        keyword === 'artwork'
      ) {
        isCoverLike = true;
      }
    }
  }

  for (const { keyword, weight } of SUPPORTING_KEYWORDS) {
    if (text.includes(keyword)) {
      score += weight;
    }
  }

  for (const { keyword, weight } of NEGATIVE_KEYWORDS) {
    if (text.includes(keyword)) {
      score += weight;
      if (keyword === 'back cover' || keyword === 'back sleeve' || keyword === 'reverse') {
        isCoverLike = false;
      }
    }
  }

  score += IMAGE_TYPE_BONUS[mime] ?? 0;
  score += IMAGE_TYPE_PENALTY[mime] ?? 0;

  if (isCoverLike) {
    score += 120;
  }

  return { score, isCoverLike };
}

function extensionFromMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return '.jpg';
  }
  if (mime === 'image/png') {
    return '.png';
  }
  if (mime === 'image/webp') {
    return '.webp';
  }
  if (mime === 'image/gif') {
    return '.gif';
  }
  if (mime === 'image/svg+xml') {
    return '.svg';
  }
  return '';
}

async function downloadImage(
  image: PickedImage,
  destinationDir: string,
  slug: string,
  fetchFn: typeof fetch,
  logger: Logger
): Promise<string | undefined> {
  const extension = extensionFromMime(image.mime);
  if (!extension) {
    logger.warn(`Cannot determine file extension for ${image.mime}; skipping download.`);
    return undefined;
  }

  const targetPath = path.join(destinationDir, `${slug}${extension}`);
  const response = await fetchFn(image.url);
  if (!response.ok) {
    logger.warn(`Failed to download ${image.url}: ${response.status} ${response.statusText}`);
    return undefined;
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
  return targetPath;
}

export async function pickImageFromPage(
  page: MediaWikiPage,
  options: PickImageOptions = {}
): Promise<PickedImage | undefined> {
  const fetchFn = options.fetchFn ?? fetch;
  const logger = options.logger ?? DEFAULT_LOGGER;

  if (!page.images || page.images.length === 0) {
    logger.warn(`No images available on Wikipedia page ${page.title}.`);
    return undefined;
  }

  const candidates: PickedImage[] = [];
  for (const image of page.images) {
    if (!image.title.startsWith('File:')) {
      continue;
    }

    const info = await fetchImageInfo(image.title, fetchFn, logger);
    if (!info) {
      continue;
    }

    const mime = info.mime?.toLowerCase() ?? '';
    if (!mime.startsWith(MIME_PREFIX)) {
      logger.debug(`Skipping ${image.title} because mime ${mime} is not an image.`);
      continue;
    }

    const metadataText = buildMetadataText(image.title, info);
    const { score, isCoverLike } = scoreCandidate(metadataText, mime);

    candidates.push({
      title: image.title,
      url: info.url,
      mime,
      score,
      isCoverLike,
      metadataText,
    });
  }

  if (candidates.length === 0) {
    logger.warn(`No usable image candidates found for ${page.title}.`);
    return undefined;
  }

  const coverCandidates = candidates.filter((candidate) => candidate.isCoverLike);
  const fallbackCandidates = candidates.filter((candidate) => !candidate.isCoverLike);

  if (coverCandidates.length > 0) {
    coverCandidates.sort((a, b) => b.score - a.score);
    return coverCandidates[0];
  }

  fallbackCandidates.sort((a, b) => b.score - a.score);
  const fallback = fallbackCandidates[0];
  if (fallback) {
    logger.warn(
      `No cover-like images found for ${page.title}; best remaining candidate ${fallback.title} is not cover art. Keeping placeholder unless caller accepts fallback.`
    );
    return fallback;
  }

  logger.warn(`No acceptable image found for ${page.title}.`);
  return undefined;
}

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchAndMaybeDownload(
  pageTitle: string,
  destinationDir: string | undefined,
  fetchFn: typeof fetch,
  logger: Logger
): Promise<void> {
  let page: MediaWikiPage | undefined;
  try {
    page = await fetchPageByTitle(pageTitle, fetchFn);
  } catch (error) {
    logger.warn(`Failed to load Wikipedia page for ${pageTitle}: ${(error as Error).message}`);
    return;
  }

  if (!page) {
    logger.warn(`Could not load Wikipedia page for ${pageTitle}.`);
    return;
  }

  const picked = await pickImageFromPage(page, { fetchFn, logger });
  if (!picked) {
    return;
  }

  if (!picked.isCoverLike) {
    logger.warn(
      `Best available image for ${page.title} (${picked.title}) is not marked as cover art; skipping download to keep placeholder.`
    );
    return;
  }

  logger.info(`Selected image ${picked.title} (score ${picked.score}) for ${page.title}`);

  if (!destinationDir) {
    return;
  }

  const savedPath = await downloadImage(
    picked,
    destinationDir,
    `${slugify(page.title)}-${slugify(picked.title.replace(/^File:/i, ''))}`,
    fetchFn,
    logger
  );

  if (savedPath) {
    logger.info(`Saved ${page.title} artwork to ${savedPath}`);
  }
}

function parseCliArguments(argv: string[]): {
  downloadDir?: string;
  pages: string[];
} {
  const pages: string[] = [];
  let downloadDir: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--download' || value === '-d') {
      downloadDir = path.join(ROOT_DIR, '.cache', 'album-art');
      continue;
    }

    if (value === '--download-dir') {
      downloadDir = argv[index + 1]
        ? path.resolve(argv[index + 1]!)
        : path.join(ROOT_DIR, '.cache', 'album-art');
      index += 1;
      continue;
    }

    pages.push(value);
  }

  return { pages, downloadDir };
}

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function runCli() {
  const { pages, downloadDir } = parseCliArguments(process.argv.slice(2));
  const logger = DEFAULT_LOGGER;
  const fetchFn = fetch;

  if (pages.length === 0) {
    logger.info('Usage: ts-node scripts/fetch-album-art.ts [--download] "Page Title" ...');
    logger.info(
      'Example: ts-node scripts/fetch-album-art.ts --download "Bad Day (Daniel Powter song)"'
    );
    return;
  }

  if (downloadDir) {
    await fs.mkdir(downloadDir, { recursive: true });
  }

  for (const pageTitle of pages) {
    logger.info(`\nFetching album art for ${pageTitle}...`);
    await fetchAndMaybeDownload(pageTitle, downloadDir, fetchFn, logger);
  }
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export async function fetchAlbumArtForPage(
  pageTitle: string,
  options: PickImageOptions & {
    downloadDir?: string;
  } = {}
): Promise<PickedImage | undefined> {
  const fetchFn = options.fetchFn ?? fetch;
  const logger = options.logger ?? DEFAULT_LOGGER;
  let page: MediaWikiPage | undefined;
  try {
    page = await fetchPageByTitle(pageTitle, fetchFn);
  } catch (error) {
    logger.warn(`Failed to load Wikipedia page for ${pageTitle}: ${(error as Error).message}`);
    return undefined;
  }

  if (!page) {
    logger.warn(`Could not load Wikipedia page for ${pageTitle}.`);
    return undefined;
  }

  const picked = await pickImageFromPage(page, { fetchFn, logger });
  if (!picked) {
    return undefined;
  }

  if (options.downloadDir && picked.isCoverLike) {
    await downloadImage(
      picked,
      options.downloadDir,
      `${slugify(page.title)}-${slugify(picked.title.replace(/^File:/i, ''))}`,
      fetchFn,
      logger
    );
  } else if (options.downloadDir) {
    logger.warn(
      `Best available image for ${page.title} (${picked.title}) is not cover art; download skipped to keep placeholder.`
    );
  }

  return picked;
}
