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

# --- STEP 5: Start dev server in background ---
echo "🚀 Starting Astro dev server..."
npm run dev &
DEV_PID=$!

# --- STEP 6: Wait a few seconds for startup ---
sleep 4

# --- STEP 7: Open in Windows Firefox ---
echo "🌐 Opening $URL in Windows Firefox..."

# Common install paths for Windows Firefox
WIN_FIREFOX_PATH_1="/mnt/c/Program Files/Mozilla Firefox/firefox.exe"
WIN_FIREFOX_PATH_2="/mnt/c/Program Files (x86)/Mozilla Firefox/firefox.exe"

if [ -f "$WIN_FIREFOX_PATH_1" ]; then
  "$WIN_FIREFOX_PATH_1" "$URL" >/dev/null 2>&1 &
elif [ -f "$WIN_FIREFOX_PATH_2" ]; then
  "$WIN_FIREFOX_PATH_2" "$URL" >/dev/null 2>&1 &
else
  # fallback: open via cmd.exe (uses Windows default browser)
  /mnt/c/Windows/System32/cmd.exe /c start "$URL"
fi

echo "✨ All done! Astro should now be live at $URL"
echo "🧰 (To stop it, press Ctrl+C or kill PID $DEV_PID)"
