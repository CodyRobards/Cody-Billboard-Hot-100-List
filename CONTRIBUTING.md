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
```

If your change affects content or data fetching, also add or update relevant tests or validation scripts. Include command outputs in your PR description when possible.

## Pull Request Guidelines

- Reference the related issue in the PR description.
- Summarize user impact, performance considerations, and testing performed.
- Keep diffs focused; split unrelated changes into separate PRs.
- Request review from the appropriate code owners listed in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Code of Conduct

We expect contributors to be respectful, inclusive, and collaborative. If you encounter behavior that conflicts with these values, contact a maintainer listed in the CODEOWNERS file.

Thank you for helping us maintain a high-performance archive!
