/**
 * Billboard Hot 100 Archive – Client-Side Search (Progressive + Fade-In)
 * ----------------------------------------------------------------------
 * - Loads search index from inline data, sessionStorage, or JSON file
 * - Dynamically renders results when searched
 * - Fades in list once initialized
 */

(() => {
  interface NumberOneSearchRecordAppearance {
    year: number;
    slug: string;
    yearRanking: number;
    sequence: number;
  }

  interface NumberOneSearchRecord {
    id: string;
    title: string;
    artist: string;
    notes: string[];
    appearances: NumberOneSearchRecordAppearance[];
    spotifyTrackId?: string;
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
  const form = document.querySelector<HTMLFormElement>('[data-number-one-search-form]');
  const clearButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-number-one-search-clear]')
  );
  const triggerButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-number-one-search-trigger]')
  );
  const defaultCountMessage = 'Type to search for #1 hits…';

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
    li.className = 'number-one-search-results__item';
    li.dataset.entryId = entry.id;
    const embedId = `search-${entry.id}`;

    const notes = entry.notes.map((note) => `<li>${note}</li>`).join('');

    const notesMarkup = notes ? `<ul class="number-one-search-results__notes">${notes}</ul>` : '';
    const yearsLabel = entry.appearances.map((appearance) => appearance.year).join(', ');
    const recapLinks = entry.appearances
      .map((appearance, index) => {
        const separator =
          index > 0
            ? '<span class="number-one-search-results__separator" aria-hidden="true"> | </span>'
            : '';
        return `
          <span class="number-one-search-results__recap-item">
            ${separator}<a class="number-one-search-results__link number-one-search-results__link--pill" href="/years/${appearance.slug}/">View ${appearance.year} Recap</a>
          </span>
        `.trim();
      })
      .join('');

    const spotifyMarkup = entry.spotifyTrackId
      ? `<div class="number-one-search-results__spotify">
            <button
              type="button"
              class="overall-ranking-list__spotify-toggle"
              data-track-id="${entry.spotifyTrackId}"
              aria-controls="${embedId}"
              aria-expanded="false"
            >
              Play on Spotify
            </button>
            <div id="${embedId}" class="overall-ranking-list__spotify" hidden></div>
          </div>`
      : '';

    li.innerHTML = `
      <header class="number-one-search-results__header">
        <span class="number-one-search-results__year">${yearsLabel}</span>
        <h3 class="number-one-search-results__title">
          <span class="number-one-search-results__song">“${entry.title}”</span>
          <span class="number-one-search-results__artist">
            by <a class="number-one-search-results__artist-link" href="/search/?q=${encodeURIComponent(entry.artist)}">${entry.artist}</a>
          </span>
        </h3>
      </header>
      ${notesMarkup}
      <div class="number-one-search-results__actions">
        <div class="number-one-search-results__recaps">${recapLinks}</div>
        ${spotifyMarkup}
      </div>
    `;
    return li;
  };

  const sortResults = (items: NumberOneSearchRecord[]) =>
    items.slice().sort((a, b) => {
      const aFirst = a.appearances[0];
      const bFirst = b.appearances[0];
      if (!aFirst || !bFirst) return 0;
      if (aFirst.year === bFirst.year) {
        return aFirst.sequence - bFirst.sequence;
      }
      return aFirst.year - bFirst.year;
    });

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
    const matches = index.filter((record) =>
      terms.every((term) => record.tokens.some((token) => token.includes(term)))
    );
    return sortResults(matches);
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

    if (count) count.textContent = defaultCountMessage;

    const handleInput = (event: Event) => updateUI((event.target as HTMLInputElement).value, index);

    input.addEventListener('input', handleInput);
    input.addEventListener('search', handleInput);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      updateUI(input.value, index);
    });

    triggerButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        updateUI(input.value, index);
      });
    });

    const resetSearch = () => {
      input.value = '';
      list.innerHTML = '';
      if (empty) empty.hidden = true;
      if (count) count.textContent = defaultCountMessage;
      input.focus();
    };

    clearButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        resetSearch();
      });
    });

    // Optional: prefetch JSON after idle time for smoother future loads
    if (!sessionStorage.getItem('number-one-search-index')) {
      const prefetch = async () => {
        try {
          await loadIndex();
        } catch {
          /* ignore */
        }
      };

      if ('requestIdleCallback' in window) {
        (
          window as Window & { requestIdleCallback: typeof requestIdleCallback }
        ).requestIdleCallback(prefetch);
      } else {
        window.setTimeout(prefetch, 200);
      }
    }

    const urlQuery = new URLSearchParams(window.location.search).get('q')?.trim() ?? '';

    if (urlQuery) {
      input.value = urlQuery;
      updateUI(urlQuery, index);
    } else {
      const initialQueryValue = input.value.trim();
      if (initialQueryValue) {
        updateUI(initialQueryValue, index);
      } else {
        list.innerHTML = '';
        if (empty) empty.hidden = true;
        if (count) count.textContent = defaultCountMessage;
      }
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
