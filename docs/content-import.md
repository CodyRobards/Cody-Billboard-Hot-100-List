# Content Import Workflow

This project curates Billboard Hot 100 inspired editorial content using the Astro content collections. Follow the
workflow below to bulk import new decades, yearly summaries, and ranking snapshots.

## 1. Prepare your source data
- Collect your track metadata (title, artist, release dates, chart positions) in a spreadsheet or JSON file.
- Normalize artist spellings and ensure dates use ISO format (`YYYY-MM-DD`).
- Identify the destination collection for each entry:
  - `decades/` for long-form decade recaps.
  - `years/` for single-year highlights.
  - `rankings/` for extended chart breakdowns (Top 220, Bottom 60, etc.).

## 2. Name files consistently
Use lowercase, hyphenated slugs for filenames so they automatically match the `slug` frontmatter field.

| Collection | Filename pattern | Example |
|------------|-----------------|---------|
| `decades/` | `<decade>-<focus>.mdx` | `1980s-synthwave-boom.mdx` |
| `years/`   | `<year>-<theme>.mdx`   | `1984-electro-pop-wave.mdx` |
| `rankings/`| `<focus>-<chart-date>.mdx` | `top-220-neon-nights-1984-08-04.mdx` |

Keep filenames and slugs unique across the repository to avoid routing conflicts.

## 3. Fill in required frontmatter
Each collection shares a base schema and adds one specific field. All fields are required unless noted.

```yaml
---
title: "Human readable title"
slug: "matching-file-slug"
release_date: YYYY-MM-DD
artist: "Primary artist or Various Artists"
ranking: <number>
commentary_excerpt: "One-sentence summary"
commentary: |
  Multi-line Markdown commentary.
cover_image: "/images/..." (optional)
tags:
  - tag-one
  - tag-two
# Plus one of the following:
decade: "1980s"           # decades collection only
year: 1984                 # years collection only
chart_week: YYYY-MM-DD     # rankings collection only
---
```

When creating Top/Bottom lists, the `ranking` value should reflect the highest position covered (e.g., `220` for a
Top 220 recap or `280` when spotlighting entries that dip into the bottom 60 slots).

## 4. Reference related content
Add internal links so visitors can hop between related entries. Use absolute paths that match the slug, e.g.
`[1984 Electro Pop Wave](/years/1984-electro-pop-wave/)`.

## 5. Automate generation (optional)
For large imports, convert your spreadsheet into MDX using a small script. The following Node snippet demonstrates
mapping JSON data into files under `src/content/`:

```ts
import { writeFileSync } from 'node:fs';
import data from './my-export.json' assert { type: 'json' };

data.forEach((entry) => {
  const frontmatter = `---\n${Object.entries(entry)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}\n---\n\n${entry.body}\n`;
  const filepath = `src/content/${entry.collection}/${entry.slug}.mdx`;
  writeFileSync(filepath, frontmatter, 'utf8');
});
```

Run the script with `node ./scripts/generate-content.js` or similar. Keep scripts inside a `scripts/` directory so they
can be reused.

## 6. Validate before committing
1. Format and lint content: `npm run format:fix` and `npm run lint`.
2. Run the Astro type checker if needed: `npm run astro -- check`.
3. Preview locally with `npm run dev` to confirm links and metadata render as expected.

Following these steps ensures every bulk import respects the schema, naming rules, and editorial tone of the project.
