# Contributing to Cody's Billboard Hot 100 Archive

Thanks for helping keep this Astro project fast and reliable! This document captures our expectations for contributions, reviews, and collaboration.

## Getting Started

1. Review the ownership map in [`.github/CODEOWNERS`](.github/CODEOWNERS) to understand who should be looped in for reviews.
2. Open an issue before starting major work so we can align on requirements. Use our templates for [bug reports](.github/ISSUE_TEMPLATE/bug-report.yml) and [feature requests](.github/ISSUE_TEMPLATE/feature-request.yml) so we can track performance impact from the start.
3. Fork the repo or create a feature branch. Keep branches small and focused on a single change.

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard to streamline release notes and automation. Use the format `type(scope): summary`, where common types include:

- `feat`: New user-facing functionality.
- `fix`: Bug fixes or regression prevention.
- `perf`: Performance improvements.
- `refactor`: Code restructuring without behavior changes.
- `docs`: Documentation-only updates.
- `chore`: Maintenance tasks, configuration changes, or dependency updates.

Commits that break existing behavior must include the `!` indicator (e.g., `feat!: ...`) and describe the breaking change in the body.

## Performance Expectations

This project is inspired by ultra-fast catalog experiences. Every change should preserve or improve:

- **Largest Contentful Paint (LCP):** < 1.5s on a mid-tier mobile device over 4G.
- **Cumulative Layout Shift (CLS):** < 0.05 through stable layouts and fixed media dimensions.
- **Interaction to Next Paint (INP):** < 200ms by minimizing JavaScript and ensuring async boundaries are responsive.

When proposing new features or content, highlight their expected performance impact in the issue template and pull request description. If a change risks exceeding these budgets, include mitigation strategies (code splitting, prefetching, caching, etc.).

## Required Checks Before Opening a PR

Run the following commands locally and ensure they pass before requesting review:

```bash
npm install
npm run lint
npm run build
npm exec lhci autorun -- --config=./lighthouserc.json
# Requires WEBPAGETEST_API_KEY and WEBPAGETEST_BASE_URL environment variables
# pointing at a deploy that WebPageTest can reach.
export BASE_URL="$WEBPAGETEST_BASE_URL"
envsubst < scripts/webpagetest-home-decade-year.wpt > /tmp/wpt-script.wpt
npm exec webpagetest test /tmp/wpt-script.wpt -- \
  --key "$WEBPAGETEST_API_KEY" \
  --server "${WEBPAGETEST_SERVER:-https://www.webpagetest.org}" \
  --label "Home → decade → year" \
  --runs 1 \
  --first \
  --location "Dulles:Chrome"
```

If your change affects content or data fetching, also add or update relevant tests or validation scripts. Include command outputs in your PR description when possible.

The Lighthouse CI step enforces our core web vital budgets: **LCP < 1.5s**, **CLS < 0.05**, and **INP < 200ms** across the key pages defined in `lighthouserc.json`. The WebPageTest script exercises the home → decade → year flow against a deployed URL and should be run against the same environment you reference in your pull request. Store API keys and base URLs in `.env.local` for local experimentation, and configure matching GitHub Actions secrets (`WEBPAGETEST_API_KEY`, `WEBPAGETEST_BASE_URL`, and optionally `WEBPAGETEST_SERVER`) so the CI pipeline mirrors your local checks.

## Updating Spotify Track References

Rankings can embed Spotify players when a matching track ID is available. These IDs live in [`src/data/spotify-tracks.ts`](src/data/spotify-tracks.ts) so that the same playlist metadata can be reused across pages.

1. Locate the track in the shared playlist and copy its Spotify URI or URL. The track ID is the alphanumeric string at the end of the URL.
2. Add or update the entry in `spotify-tracks.ts`, keeping the `title` and `artist` values consistent with the playlist naming. The lookup helper normalizes whitespace and casing, so you do not need to alter punctuation.
3. If the MDX frontmatter for a ranking already specifies `spotifyTrackId`, prefer updating the shared data file instead—the component will automatically use the shared ID when one exists.
4. Run the required checks above and include any relevant notes in your pull request.

## Pull Request Guidelines

- Reference the related issue in the PR description.
- Summarize user impact, performance considerations, and testing performed.
- Keep diffs focused; split unrelated changes into separate PRs.
- Request review from the appropriate code owners listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Code of Conduct

We expect contributors to be respectful, inclusive, and collaborative. If you encounter behavior that conflicts with these values, contact a maintainer listed in the CODEOWNERS file.

Thank you for helping us maintain a high-performance archive!
