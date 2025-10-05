# Project Task Plan: Cody's Billboard Hot 100 Archive

## 🏗️ Project Setup

### Initialize Astro Project with Performance Baseline
**Goal:** Scaffold the Astro project with minimal boilerplate and enforce performance linting from day one.
**Why:** Establishes a lean foundation optimized for HTML-first delivery and keeps regressions from creeping in.
**Subtasks:**
- [ ] Run `npm create astro@latest` with strict template, removing demo assets/components.
- [ ] Configure TypeScript, ESLint, and Prettier with performance-focused rules (no unused JS, prefer semantic HTML).
- [ ] Add Husky + lint-staged to enforce formatting and lint checks on commit.

### Configure Repository Infrastructure
**Goal:** Set up version control automation, CI pipeline, and documentation scaffolding.
**Why:** Guarantees consistent workflows and enables fast iteration with confidence.
**Subtasks:**
- [ ] Define GitHub Actions workflow for install, lint, and build steps.
- [ ] Add CODEOWNERS, CONTRIBUTING, and issue templates reflecting performance priorities.
- [ ] Document project conventions in `README` (content structure, performance expectations).

## 📄 Content Integration

### Model Markdown Content Structure
**Goal:** Design folder structure and frontmatter schema for decades, years, and rankings.
**Why:** Keeps content maintainable and queryable for instant-rendered pages.
**Subtasks:**
- [ ] Define `/content` directory with `decades`, `years`, `rankings`, and `meta` collections.
- [ ] Specify frontmatter fields (title, slug, release_date, artist, ranking, commentary excerpt, etc.).
- [ ] Create MDX examples for each content type to validate schema.

### Implement Content Collection Utilities
**Goal:** Provide Astro collections/schema definitions and helper functions for fetching filtered content.
**Why:** Enables static generation and fast server-rendered views without runtime overhead.
**Subtasks:**
- [ ] Configure Astro content collections with Zod schemas.
- [ ] Build utility to generate per-decade/year indices during build.
- [ ] Expose helper that returns ranking subsets (Top 220, Bottom 60) for template consumption.

### Seed Initial Content Imports
**Goal:** Import a representative subset of years/decades for development and layout validation.
**Why:** Ensures templates can be tuned for readability and performance before full migration.
**Subtasks:**
- [ ] Convert sample year commentary into MDX with frontmatter.
- [ ] Populate decade overview pages with summary metadata.
- [ ] Document bulk-import workflow for remaining content.

## ⚙️ Performance Architecture

### Set Up Prefetch & PushState Navigation
**Goal:** Add hover-triggered HTML prefetch and pushState transitions for near-instant navigation.
**Why:** Mirrors McMaster-Carr's experience by minimizing perceived load time between pages.
**Subtasks:**
- [ ] Create lightweight script to prefetch on `mouseenter` and cache responses.
- [ ] Integrate with Astro island to swap HTML via `history.pushState` without SPA overhead.
- [ ] Ensure accessibility (respect reduced data and keyboard focus).

### Implement Edge Caching & Service Worker Strategy
**Goal:** Combine CDN edge caching with a service worker for stale-while-revalidate delivery.
**Why:** Maximizes cache hits and keeps navigation instant even on repeat visits.
**Subtasks:**
- [ ] Configure Netlify/Cloudflare edge headers for HTML, CSS, and assets with appropriate TTL + SWR.
- [ ] Implement service worker with offline-first caching for HTML shells and critical assets.
- [ ] Add versioning strategy to invalidate caches on deployment.

### Inline Critical CSS & Defer Non-essential Assets
**Goal:** Deliver critical styling inline while lazy-loading remaining CSS/JS.
**Why:** Improves LCP and ensures content renders immediately without blocking resources.
**Subtasks:**
- [ ] Integrate `@astrojs/critters` for automatic critical CSS inlining.
- [ ] Split non-critical CSS into async-loaded chunks.
- [ ] Audit JS bundles; mark non-essential scripts with `defer`/`module` and eliminate unused code.

### Optimize Media Handling Pipeline
**Goal:** Enforce fixed dimensions and modern formats for all media assets.
**Why:** Prevents CLS and reduces transfer size for faster render.
**Subtasks:**
- [ ] Configure Astro image integration to produce AVIF/WebP with responsive sizes.
- [ ] Add frontmatter fields for aspect ratios and enforce via build-time validation.
- [ ] Preload hero images and provide fallbacks for legacy browsers.

## 🎨 Design & UX Implementation

### Develop Minimalist Layout System
**Goal:** Build a responsive typographic layout inspired by liner notes/catalogs.
**Why:** Supports readability and consistent hierarchy across decades/years.
**Subtasks:**
- [ ] Create base typography scale using CSS custom properties and fluid sizing.
- [ ] Implement grid/flex layout for navigation, content body, and side notes.
- [ ] Include print-style accents (rules, muted palette) with accessible contrast.

### Craft Navigation Components
**Goal:** Design persistent navigation for decades, years, and ranking shortcuts.
**Why:** Facilitates frictionless browsing of large content corpus.
**Subtasks:**
- [ ] Build decade/year index component with keyboard navigability.
- [ ] Add quick jump controls for Top 220/Bottom 60.
- [ ] Ensure nav integrates with prefetch script and maintains focus state.

### Implement Template Pages
**Goal:** Create Astro page templates for homepage, decade, year, ranking, and about pages.
**Why:** Standardizes structure and ensures each route is optimized for fast render.
**Subtasks:**
- [ ] Build homepage with project overview, entry points, and performance-focused hero.
- [ ] Compose decade/year templates using Astro layouts with server-rendered content lists.
- [ ] Add ranking pages with sortable tables (progressive enhancement).

## 🧠 Monitoring & Optimization

### Configure Performance Budgets & CI Monitoring
**Goal:** Automate performance testing with Lighthouse CI and WebPageTest thresholds.
**Why:** Detects regressions early and enforces McMaster-Carr-level speed.
**Subtasks:**
- [ ] Add Lighthouse CI config targeting LCP < 1.5s, CLS < 0.05, INP < 200ms.
- [ ] Set up WebPageTest script for key user flows (home → decade → year).
- [ ] Integrate reports into GitHub PR checks with actionable output.

### Implement Real User Monitoring Hooks
**Goal:** Capture real-world performance metrics (LCP, INP) post-deployment.
**Why:** Validates optimizations and surfaces issues not seen in lab tests.
**Subtasks:**
- [ ] Use lightweight analytics (e.g., Cloudflare Web Analytics) for core web vitals.
- [ ] Send custom events for navigation timing via `PerformanceObserver`.
- [ ] Respect privacy by aggregating data and providing opt-out.

## 🚀 Deployment

### Prepare Edge Deployment Pipeline
**Goal:** Automate deployments to Cloudflare Pages or Netlify Edge with caching headers.
**Why:** Ensures consistent, performant builds shipped to the edge quickly.
**Subtasks:**
- [ ] Configure environment variables/secrets for target platform.
- [ ] Define build command and output directory in platform config.
- [ ] Add post-deploy script to purge stale caches.

### Create Go-Live Checklist & Rollout Plan
**Goal:** Document steps for launching and verifying production readiness.
**Why:** Reduces risk during launch and ensures instant experience on day one.
**Subtasks:**
- [ ] Compile checklist (content completeness, accessibility audit, perf scores).
- [ ] Schedule smoke tests across critical routes and devices.
- [ ] Plan communication for launch announcement and monitoring window.
