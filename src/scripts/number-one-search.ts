/**
 * Billboard Hot 100 Archive – Client-Side Search (Progressive + Fade-In)
 * ----------------------------------------------------------------------
 * - Loads search index from inline data, sessionStorage, or JSON file
 * - Dynamically renders results when searched
 * - Fades in list once initialized
 */

(() => {
  interface NumberOneSearchRecord {
    id: string;
    title: string;
    artist: string;
    year: number;
    slug: string;
    notes?: string[];
    spotifyTrackId?: string;
    yearRanking?: number;
    sequence?: number;
    tokens: string[];
  }

  const normalize = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const tokenize = (value: string): string[] =>
    normalize(value)
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);

  /* ----------------------------- DOM Elements ----------------------------- */

  const list = document.querySelector<HTMLElement>('[data-number-one-search-list]');
  const input = document.querySelector<HTMLInputElement>('[data-number-one-search-input]');
  const empty = document.querySelector<HTMLElement>('[data-number-one-search-empty]');
  const count = document.querySelector<HTMLElement>('[data-number-one-search-count]');
  const container = document.querySelector<HTMLElement>('[data-number-one-search-index-json]');

  if (!list || !input) return;

  /* ------------------------- Load Search Index ---------------------------- */

  const loadIndex = async (): Promise<NumberOneSearchRecord[]> => {
    // 1. Check sessionStorage cache
    const cached = sessionStorage.getItem('number-one-search-index');
    if (cached) {
      try {
        return JSON.parse(cached) as NumberOneSearchRecord[];
      } catch {
        sessionStorage.removeItem('number-one-search-index');
      }
    }

    // 2. Try inline data from Astro
    const payload = container?.getAttribute('data-number-one-search-index-json');
    if (payload) {
      try {
        const data = JSON.parse(payload) as NumberOneSearchRecord[];
        sessionStorage.setItem('number-one-search-index', JSON.stringify(data));
        return data;
      } catch (err) {
        console.error('Failed to parse embedded search index:', err);
      }
    }

    // 3. Progressive load from JSON file
    try {
      const res = await fetch('/number-one-search-index.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as NumberOneSearchRecord[];
      sessionStorage.setItem('number-one-search-index', JSON.stringify(data));
      return data;
    } catch (err) {
      console.error('❌ Could not load search index:', err);
      return [];
    }
  };

  /* --------------------------- Rendering Logic ---------------------------- */

  const createResultItem = (entry: NumberOneSearchRecord): HTMLLIElement => {
    const li = document.createElement('li');
    li.className = 'overall-ranking-list__item number-one-search-results__item';
    li.dataset.entryId = entry.id;

    li.innerHTML = `
      <span class="overall-ranking-list__position">${entry.year}</span>
      <div class="overall-ranking-list__content">
        <div class="overall-ranking-list__details">
          <span class="overall-ranking-list__title">${entry.title}</span>
          <span class="overall-ranking-list__artist">${entry.artist}</span>
          <div class="number-one-search-results__meta">
            <a href="/years/${entry.slug}/" class="number-one-search-results__year-link">
              View ${entry.year} recap
            </a>
            ${
              entry.yearRanking
                ? `<span class="number-one-search-results__stat">#${entry.yearRanking} year ranking</span>`
                : ''
            }
            ${
              entry.sequence !== undefined
                ? `<span class="number-one-search-results__stat">#${entry.sequence + 1} number-one hit</span>`
                : ''
            }
          </div>
        </div>
        ${
          entry.spotifyTrackId
            ? `<div class="overall-ranking-list__preview">
                <button
                  type="button"
                  class="overall-ranking-list__spotify-toggle"
                  data-track-id="${entry.spotifyTrackId}"
                >
                  Play on Spotify
                </button>
              </div>`
            : ''
        }
      </div>
    `;
    return li;
  };

  const renderResults = (results: NumberOneSearchRecord[]) => {
    list.innerHTML = '';
    if (!results.length) return;
    const fragment = document.createDocumentFragment();
    results.forEach((r) => fragment.append(createResultItem(r)));
    list.append(fragment);
  };

  /* --------------------------- Search Filtering --------------------------- */

  const filterResults = (
    query: string,
    index: NumberOneSearchRecord[]
  ): NumberOneSearchRecord[] => {
    const terms = tokenize(query);
    if (!terms.length) return [];
    return index.filter((record) =>
      terms.every((term) => record.tokens.some((token) => token.includes(term)))
    );
  };

  const updateUI = (query: string, index: NumberOneSearchRecord[]) => {
    const results = filterResults(query, index);
    renderResults(results);
    const visible = results.length;

    if (empty) empty.hidden = visible > 0;
    if (count)
      count.textContent = visible
        ? `${visible} matching #1 hit${visible > 1 ? 's' : ''}`
        : 'No #1 hits match your search.';
  };

  /* ---------------------------- Initialization ---------------------------- */

  (async () => {
    const index = await loadIndex();
    if (!index.length) {
      if (count) count.textContent = 'Failed to load search index.';
      return;
    }

    if (count) count.textContent = 'Type to search for #1 hits…';

    input.addEventListener('input', (e) => updateUI((e.target as HTMLInputElement).value, index));
    input.addEventListener('search', (e) => updateUI((e.target as HTMLInputElement).value, index));

    // Optional: prefetch JSON after idle time for smoother future loads
    if (!sessionStorage.getItem('number-one-search-index')) {
      requestIdleCallback(async () => {
        try {
          await loadIndex();
        } catch {
          /* ignore */
        }
      });
    }

    /* ------------------- Fade-In Visibility (Option 2) ------------------- */
    const makeListVisible = () => list.classList.add('is-ready');
    if (document.readyState === 'complete') {
      makeListVisible();
    } else {
      window.addEventListener('load', makeListVisible, { once: true });
    }
  })();
})();
