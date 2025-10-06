import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SOURCE_FILE = path.resolve(projectRoot, 'docs', 'hot100_#1s.txt');
const TARGET_DIR = path.resolve(projectRoot, 'src', 'content', 'years');

const dividerLine = '----------------------------------------------------------';

const stripQuotes = (value) => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseEntryLine = (line) => {
  const trimmed = line.trim();
  const dotIndex = trimmed.indexOf('.');

  if (dotIndex === -1) {
    throw new Error(`Unable to parse entry line: ${line}`);
  }

  const position = Number.parseInt(trimmed.slice(0, dotIndex), 10);
  const remainder = trimmed.slice(dotIndex + 1).trim();
  let titleRaw;
  let artistSection;

  const hyphenIndex = remainder.lastIndexOf(' - ');

  if (hyphenIndex !== -1) {
    titleRaw = remainder.slice(0, hyphenIndex).trim();
    artistSection = remainder.slice(hyphenIndex + 3).trim();
  } else if (remainder.startsWith('"')) {
    const closingQuote = remainder.indexOf('"', 1);
    if (closingQuote === -1) {
      throw new Error(`Unable to locate closing quote in: ${line}`);
    }
    titleRaw = remainder.slice(0, closingQuote + 1).trim();
    artistSection = remainder.slice(closingQuote + 1).trim();
  } else {
    const parts = remainder.split(/\s{2,}/);
    if (parts.length >= 2) {
      [titleRaw, artistSection] = [parts[0].trim(), parts.slice(1).join(' ').trim()];
    } else {
      const firstSpace = remainder.indexOf(' ');
      if (firstSpace === -1) {
        throw new Error(`Unable to locate artist separator in: ${line}`);
      }
      titleRaw = remainder.slice(0, firstSpace).trim();
      artistSection = remainder.slice(firstSpace + 1).trim();
    }
  }

  const artist = artistSection.startsWith('-') ? artistSection.slice(1).trim() : artistSection;

  return {
    position,
    title: stripQuotes(titleRaw),
    artist,
  };
};

const parseYearBlocks = (lines) => {
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index]?.trim() !== '----') {
      index += 1;
      continue;
    }

    const yearLine = lines[index + 1]?.trim();
    const year = Number.parseInt(yearLine ?? '', 10);

    if (Number.isNaN(year)) {
      throw new Error(`Encountered invalid year marker near line ${index + 1}`);
    }

    index += 3; // Skip "----", year, "----"

    while (index < lines.length && !lines[index].trim()) {
      index += 1;
    }

    const numberOnes = [];
    let encounteredEntry = false;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed === 'OVERALL RANKING') {
        break;
      }

      if (!/^\d+\./.test(trimmed)) {
        if (encounteredEntry) {
          break;
        }
        index += 1;
        continue;
      }

      const entry = parseEntryLine(line);
      index += 1;
      encounteredEntry = true;

      const notes = [];
      while (index < lines.length) {
        const noteLine = lines[index];
        const noteTrimmed = noteLine.trim();

        if (!noteTrimmed) {
          index += 1;
          continue;
        }

        if (!noteTrimmed.startsWith('-')) {
          break;
        }

        notes.push(noteTrimmed.replace(/^-[\s]*/, '').trim());
        index += 1;
      }

      numberOnes.push({ ...entry, notes });
    }

    while (index < lines.length && lines[index].trim() && lines[index].trim() !== 'OVERALL RANKING') {
      // Advance to the OVERALL RANKING marker or next block divider
      if (lines[index].trim() === dividerLine) {
        break;
      }
      index += 1;
    }

    if (lines[index]?.trim() === 'OVERALL RANKING') {
      index += 1;
    }

    const overallRanking = [];
    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (!/^\d+\./.test(trimmed)) {
        break;
      }

      overallRanking.push(parseEntryLine(line));
      index += 1;
    }

    const summaryLines = [];
    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed && summaryLines.length === 0) {
        index += 1;
        continue;
      }

      if (trimmed === dividerLine || trimmed === '----') {
        break;
      }

      summaryLines.push(line);
      index += 1;
    }

    if (lines[index]?.trim() === dividerLine) {
      index += 1;
    }

    const summary = summaryLines.join('\n').trim();
    const paragraphs = summary
      ? summary
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      : [];

    const [commentary, ...rest] = paragraphs;
    const commentaryText = commentary ?? `Every Hot 100 number one from ${year}, catalogued.`;
    const summaryTail = rest.join('\n\n');

    blocks.push({
      year,
      numberOnes,
      overallRanking,
      commentary: commentaryText,
      summary: summaryTail,
    });
  }

  return blocks;
};

const toExcerpt = (text) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
};

const buildSlug = (year) => `hot-100-number-ones-${year}`;

const buildFrontmatter = (block) => {
  const { year, numberOnes, overallRanking, commentary, summary } = block;
  const excerpt = toExcerpt(commentary);

  return {
    title: `Billboard Hot 100 #1s — ${year}`,
    slug: buildSlug(year),
    release_date: `${year}-12-31`,
    artist: 'Various Artists',
    ranking: 1,
    commentary_excerpt: excerpt,
    commentary,
    year,
    numberOnes,
    overallRanking,
    yearSummary: summary || undefined,
    tags: ['hot-100', 'number-ones'],
  };
};

const buildMdx = (frontmatter) => {
  const yaml = stringify(frontmatter, { lineWidth: 0 });
  return `---\n${yaml}---\n\nThis entry was generated from docs/hot100_#1s.txt.\n`;
};

const main = async () => {
  const raw = await readFile(SOURCE_FILE, 'utf8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks = parseYearBlocks(lines);

  await mkdir(TARGET_DIR, { recursive: true });

  await Promise.all(
    blocks.map(async (block) => {
      const frontmatter = buildFrontmatter(block);
      const fileName = `${block.year}-${buildSlug(block.year)}.mdx`;
      const targetFile = path.resolve(TARGET_DIR, fileName);
      await writeFile(targetFile, buildMdx(frontmatter), 'utf8');
    })
  );

  console.log(`Imported ${blocks.length} year entries from ${path.relative(projectRoot, SOURCE_FILE)}.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
