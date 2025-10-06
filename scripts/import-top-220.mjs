import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SOURCE_FILE = path.resolve(projectRoot, 'docs', '#1_hits_full_list.txt');
const TARGET_DIR = path.resolve(projectRoot, 'src', 'content', 'rankings');

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseRankingLine = (line) => {
  const trimmed = line.trim();
  const dotIndex = trimmed.indexOf('.');

  if (dotIndex === -1) {
    throw new Error(`Unable to parse ranking line: ${line}`);
  }

  const position = Number.parseInt(trimmed.slice(0, dotIndex), 10);
  const remainder = trimmed.slice(dotIndex + 1).trim();
  const hyphenIndex = remainder.lastIndexOf(' - ');

  if (hyphenIndex === -1) {
    throw new Error(`Unable to determine artist for: ${line}`);
  }

  const titleRaw = remainder.slice(0, hyphenIndex).trim();
  let artistSection = remainder.slice(hyphenIndex + 3).trim();
  let genres;
  let year;

  const genreMatch = artistSection.match(/\[(.+)\]$/);
  if (genreMatch) {
    genres = genreMatch[1].split(',').map((genre) => genre.trim());
    artistSection = artistSection.slice(0, genreMatch.index).trim();
  }

  const yearMatch = artistSection.match(/\(([^)]+)\)$/);
  if (yearMatch) {
    year = yearMatch[1].trim();
    artistSection = artistSection.slice(0, yearMatch.index).trim();
  }

  return {
    position,
    title: stripQuotes(titleRaw),
    artist: artistSection,
    year,
    genres,
  };
};

const parseEntries = (lines) => {
  const entries = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (!/^\d+\./.test(trimmed)) {
      index += 1;
      continue;
    }

    const base = parseRankingLine(line);
    index += 1;

    const commentaryLines = [];
    while (index < lines.length) {
      const commentaryLine = lines[index];
      const commentaryTrimmed = commentaryLine.trim();

      if (/^\d+\./.test(commentaryTrimmed)) {
        break;
      }

      commentaryLines.push(commentaryLine.trimEnd());
      index += 1;
    }

    const commentary = commentaryLines.join('\n').trim();
    entries.push({ ...base, commentary });
  }

  return entries;
};

const toExcerpt = (text) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
};

const buildFrontmatter = ({ title, slug, ranking, subset, entries, commentary, excerpt }) => ({
  title,
  slug,
  release_date: '2024-01-01',
  artist: 'Cody Robards',
  ranking,
  commentary_excerpt: excerpt,
  commentary,
  chart_week: '2024-01-01',
  subset,
  entries,
  tags: ['hot-100', 'research'],
});

const buildMdx = (frontmatter, body) => {
  const yaml = stringify(frontmatter, { lineWidth: 0 });
  return `---\n${yaml}---\n\n${body}\n`;
};

const main = async () => {
  const raw = await readFile(SOURCE_FILE, 'utf8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const entries = parseEntries(lines);

  if (!entries.length) {
    throw new Error('No ranking entries found in source document.');
  }

  await mkdir(TARGET_DIR, { recursive: true });

  const topFrontmatter = buildFrontmatter({
    title: 'Top 220 Hot 100 #1 Hits',
    slug: 'top-220-hot-100-number-ones',
    ranking: 220,
    subset: 'top-220',
    entries,
    commentary:
      'The complete research ranking of every Hot 100 chart-topper considered in the project, ordered from 220 to 1.',
    excerpt: toExcerpt('The complete research ranking of every Hot 100 chart-topper considered in the project.'),
  });

  const topBody = 'Imported from docs/#1_hits_full_list.txt with commentary for each placement.';
  const topFile = path.resolve(TARGET_DIR, 'top-220-hot-100-number-ones.mdx');
  await writeFile(topFile, buildMdx(topFrontmatter, topBody), 'utf8');

  const bottomEntries = entries.slice(-60);
  const bottomFrontmatter = buildFrontmatter({
    title: 'Bottom 60 Hot 100 #1 Hits',
    slug: 'bottom-60-hot-100-number-ones',
    ranking: 60,
    subset: 'bottom-60',
    entries: bottomEntries,
    commentary:
      'The final 60 placements from the Top 220 project, spotlighting the curious and controversial chart-toppers.',
    excerpt: toExcerpt('The final 60 placements from the Top 220 project, spotlighting the curious and controversial picks.'),
  });

  const bottomBody = 'A focused view on positions 161–220 from the master list.';
  const bottomFile = path.resolve(TARGET_DIR, 'bottom-60-hot-100-number-ones.mdx');
  await writeFile(bottomFile, buildMdx(bottomFrontmatter, bottomBody), 'utf8');

  console.log(
    `Imported ${entries.length} ranking entries from ${path.relative(projectRoot, SOURCE_FILE)} (bottom ${bottomEntries.length} extracted).`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
