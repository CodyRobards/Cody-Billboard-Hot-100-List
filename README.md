# Cody's Billboard Hot 100 Archive

## Project Overview
Cody's Billboard Hot 100 Archive is an Astro-powered exploration of historic Billboard chart data. The site focuses on delivering
a lightning-fast, content-first experience that mirrors the feel of browsing a meticulously curated music almanac. Pages are
pre-rendered by default, rely on semantic HTML, and keep client-side JavaScript to an absolute minimum so that the archive
performs well on mid-tier mobile devices as well as desktop browsers.

## Directory Structure
- `astro.config.mjs` – Astro configuration used to control routing, image optimization, and integration settings.
- `public/` – Static assets (favicons, shared imagery, fonts) served directly by Astro without transformation.
- `public/images/covers/` – Generated 80×80 thumbnails for every album cover, produced by `npm run resize:album-art`.
- `public/images/placeholder.webp` – Reusable fallback image used only when artwork has not been sourced yet.
- `src/` – Application source code. Within `src/pages/` you will find the statically generated routes that surface chart data.
- `raw-album-art/` – Raw album art downloads (one per track) fetched directly from Spotify before optimization.
- `scripts/cache/` – Shared cache artifacts including the Spotify metadata cache (`wiki-art.json`) and the cover manifest.
- `.github/` – Issue templates, CODEOWNERS map, and CI workflows (`ci.yml`) that enforce linting and build checks on every push
  and pull request.
- `.husky/` – Local Git hooks that run `lint-staged` to keep formatting and lint rules consistent before each commit.
- `CONTRIBUTING.md` & `PROJECT_PLAN.md` – Additional documentation covering collaboration expectations and roadmap context.

## Performance Principles & Guardrails
- **Minimal JavaScript policy:** Prefer server-rendered or statically generated pages and avoid shipping optional client-side
  frameworks unless a feature absolutely requires interactivity.
- **Semantic, accessible HTML:** Use headings, lists, landmarks, and alt text to keep the experience usable for assistive
  technologies while supporting strong Core Web Vitals.
- **CI enforced quality gates:** The GitHub Actions workflow runs `npm run lint` and `npm run build` using Node.js 20 to catch
  regressions early.
- **Performance budgets:** Follow the limits described in `CONTRIBUTING.md` (LCP < 1.5s, CLS < 0.05, INP < 200ms) and call out
  expected impact in issues and PRs.

## Development Setup
1. Install [Node.js 20](https://nodejs.org/) (the same version used in CI) and npm 10+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server with hot module replacement:
   ```bash
   npm run dev
   ```
4. Visit the URL printed in the terminal (defaults to `http://localhost:4321`).

## Development Scripts
- `npm run dev` – Launch the Astro dev server for local iteration.
- `npm run build` – Generate the production build output after validating album artwork coverage.
- `npm run preview` – Serve the last build locally to validate production output.
- `npm run lint` / `npm run lint:fix` – Run ESLint across `src/**/*.{astro,ts,tsx,js,jsx}` with an option to auto-fix issues.
- `npm run format` / `npm run format:fix` – Check or rewrite formatting with Prettier across Astro, TypeScript, JavaScript,
  JSON, and CSS files.
- `npm run fetch:album-art` – Use the Spotify Web API (via `tsx`) to populate `raw-album-art/` and the persistent `wiki-art.json` cache.
- `npm run resize:album-art` – Generate 80×80 WebP and AVIF thumbnails with Sharp and refresh the slug → asset manifest.
- `npm run validate:album-art` – Ensure every Spotify/MDX track has optimized artwork (no placeholders) before builds succeed.

### Album Art Workflow & Refresh Guidance
Album art is sourced from Spotify and cached locally to avoid repeated requests. Before fetching make sure the Spotify client credentials are available in your environment (`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`). To fully refresh assets:

1. Fetch raw images (the script throttles requests to roughly four per second to respect Spotify's rate limits):
   ```bash
   npm run fetch:album-art -- [--resume] [--limit <count>] [--skip-existing]
   ```
   - `--resume` skips entries already marked as successful in `scripts/cache/wiki-art.json`.
   - `--limit` constrains the number of new downloads in a single run (helpful when testing or pacing requests).
   - `--skip-existing` leaves any raw downloads already on disk untouched.
2. Resize and optimize thumbnails:
   ```bash
   npm run resize:album-art
   ```
3. Validate coverage (also happens automatically during `npm run build`):
   ```bash
   npm run validate:album-art
   ```

`scripts/cache/wiki-art.json` (legacy name) records the canonical state for each track—Spotify IDs, album metadata, last fetched/resized/validated timestamps, and optimized paths—while `scripts/cache/cover-manifest.json` exposes a machine-readable slug → thumbnail mapping for other tooling.
Run the workflow whenever new tracks are introduced or when artwork needs a manual refresh.

## Linting, Formatting, and Pre-commit Tooling
- ESLint is configured via `.eslintrc.cjs` and integrated into CI for consistency.
- Prettier (with the Astro plugin) enforces formatting and is run automatically by `lint-staged` during commits.
- Husky hooks trigger `lint-staged` so staged files are formatted and linted before each commit lands.
- Optional manual checks: `npm run lint`, `npm run format`, or `npm run format:fix`.

## Contribution Guidelines
- Read and follow the process documented in [`CONTRIBUTING.md`](CONTRIBUTING.md) for issue triage, coding standards, and
  performance expectations.
- Keep pull requests focused, include performance considerations in descriptions, and request review from the appropriate
  code owners listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).
- Ensure CI passes locally (`npm run lint`, `npm run build`) before opening a pull request.
- Adhere to Conventional Commits for commit messages (e.g., `feat: add track spotlight`).

## Deployment Guidance
- After shipping any changes that impact cached HTML shells or static assets, bump the `HTML_CACHE` and `STATIC_CACHE`
  version strings in `public/sw.js` (for example from `html-v1` to `html-v2`). Deploying with updated identifiers ensures
  the previous caches are purged during the `activate` step so that clients receive the latest markup and assets on their
  next visit.
