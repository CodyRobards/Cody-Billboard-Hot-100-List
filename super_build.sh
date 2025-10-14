#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Fresh Rebuild + Dev Launch for Astro Project (WSL-Optimized)
# -----------------------------------------------------------------------------
# Cleans caches, reinstalls deps, builds, runs Astro dev,
# and opens the site in Windows Firefox.
# -----------------------------------------------------------------------------

set -e

URL="http://localhost:4321"

# --- STEP 1: Clean directories ---
echo "🧹 Cleaning project directories..."
rm -rf node_modules dist .astro
echo "✅ Removed node_modules, dist, and .astro"

# --- STEP 2: Clear caches ---
echo "🧽 Clearing npm and Astro caches..."
npm cache clean --force >/dev/null 2>&1 || true
rm -rf ~/.astro-cache >/dev/null 2>&1 || true
echo "✅ Cache cleared"

# --- STEP 3: Reinstall dependencies ---
echo "📦 Installing fresh dependencies..."
npm install
echo "✅ Dependencies installed"

# --- STEP 4: Build project ---
echo "🏗️  Building project..."
npm run build
echo "✅ Build complete"

echo "✨ All done!"

