import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RAW_DIR = path.resolve(ROOT_DIR, 'raw-album-art');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'public/images/covers');
const CACHE_PATH = path.resolve(ROOT_DIR, 'scripts/cache/wiki-art.json');
const MANIFEST_PATH = path.resolve(ROOT_DIR, 'scripts/cache/cover-manifest.json');

const ensureDir = async (target) => {
  await fs.mkdir(target, { recursive: true });
};

const readJsonCache = async () => {
  const raw = await fs.readFile(CACHE_PATH, 'utf8');
  return JSON.parse(raw);
};

const writeJsonCache = async (cache) => {
  const serialized = `${JSON.stringify(cache, null, 2)}\n`;
  await fs.writeFile(CACHE_PATH, serialized, 'utf8');
};

const main = async () => {
  await ensureDir(RAW_DIR);
  await ensureDir(OUTPUT_DIR);

  const cache = await readJsonCache();
  const rawFiles = await fs.readdir(RAW_DIR);
  const manifest = {};
  const now = new Date().toISOString();

  for (const file of rawFiles) {
    if (file === '.gitkeep' || file.startsWith('.')) continue;
    const sourcePath = path.join(RAW_DIR, file);
    const slug = path.basename(file, path.extname(file));

    const webpPath = path.join(OUTPUT_DIR, `${slug}.webp`);
    const avifPath = path.join(OUTPUT_DIR, `${slug}.avif`);

    const image = sharp(sourcePath).resize(80, 80, { fit: 'cover' });

    await image.clone().webp({ quality: 75 }).toFile(webpPath);
    await image.clone().avif({ quality: 60 }).toFile(avifPath);

    const relativeWebp = path.relative(ROOT_DIR, webpPath).replace(/\\/g, '/');
    const relativeAvif = path.relative(ROOT_DIR, avifPath).replace(/\\/g, '/');
    const relativeRaw = path.relative(ROOT_DIR, sourcePath).replace(/\\/g, '/');

    manifest[slug] = {
      webp: relativeWebp,
      avif: relativeAvif,
      source: relativeRaw,
    };

    if (!cache.entries[slug]) {
      cache.entries[slug] = {
        title: slug,
        artist: '',
        slug,
        source: 'spotify',
        status: 'pending',
      };
    }

    cache.entries[slug].optimized = { webp: relativeWebp, avif: relativeAvif };
    cache.entries[slug].lastResized = now;
    cache.entries[slug].updatedAt = now;
  }

  cache.meta.lastResizeRun = now;

  await writeJsonCache(cache);
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Generated ${Object.keys(manifest).length} optimized thumbnails.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
