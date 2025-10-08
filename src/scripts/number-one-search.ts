interface NumberOneSearchRecord {
  id: string;
  tokens: string[];
}

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

if (hasDOM) {
  const input = document.querySelector<HTMLInputElement>('[data-number-one-search-input]');
  const list = document.querySelector<HTMLElement>('[data-number-one-search-list]');
  const emptyState = document.querySelector<HTMLElement>('[data-number-one-search-empty]');
  const countElement = document.querySelector<HTMLElement>('[data-number-one-search-count]');

  if (!input || !list) {
    // The search UI is not present on the current page.
  } else {
    const getIndexPayload = (): string | null => {
      const script = document.querySelector<HTMLScriptElement>(
        'script[data-number-one-search-index]'
      );
      const scriptPayload = script?.textContent?.trim();
      if (scriptPayload) {
        return scriptPayload;
      }

      const container = document.querySelector<HTMLElement>('[data-number-one-search-index-json]');
      if (container) {
        const attrValue = container.getAttribute('data-number-one-search-index-json');
        if (attrValue && attrValue.trim().length > 0) {
          return attrValue;
        }
      }

      return null;
    };

    const payload = getIndexPayload();
    if (!payload) {
      return;
    }

    let records: NumberOneSearchRecord[] = [];
    try {
      records = JSON.parse(payload) as NumberOneSearchRecord[];
    } catch (error) {
      console.error('Failed to parse #1 search index.', error);
      records = [];
    }

    const itemElements = Array.from(list.querySelectorAll<HTMLElement>('[data-entry-id]'));
    const elementMap = new Map<string, HTMLElement>();
    itemElements.forEach((item) => {
      const id = item.dataset.entryId;
      if (id) {
        elementMap.set(id, item);
      }
    });

    const totalCount = records.length;

    const formatCount = (visible: number) => {
      if (!countElement) return;
      const descriptor = visible === 1 ? '#1 hit' : '#1 hits';
      countElement.textContent = `Showing ${visible} of ${totalCount} ${descriptor}`;
    };

    const closeSpotify = (container: HTMLElement) => {
      const openToggle = container.querySelector<HTMLButtonElement>(
        '.overall-ranking-list__spotify-toggle[aria-expanded="true"]'
      );
      if (!openToggle) return;
      const targetId = openToggle.getAttribute('aria-controls');
      if (targetId) {
        const embedContainer = document.getElementById(targetId);
        if (embedContainer) {
          embedContainer.hidden = true;
          embedContainer.innerHTML = '';
        }
      }
      openToggle.setAttribute('aria-expanded', 'false');
      openToggle.textContent = 'Play on Spotify';
    };

    const applyVisibility = (element: HTMLElement, shouldShow: boolean) => {
      if (shouldShow) {
        if (element.hidden) {
          element.hidden = false;
          element.removeAttribute('aria-hidden');
        }
      } else {
        if (!element.hidden) {
          element.hidden = true;
          element.setAttribute('aria-hidden', 'true');
          closeSpotify(element);
        }
      }
    };

    const tokenMap = new Map<string, string[]>();
    records.forEach((record) => {
      tokenMap.set(record.id, record.tokens ?? []);
    });

    const filter = (query: string) => {
      const terms = tokenize(query);
      const hasTerms = terms.length > 0;
      let visibleCount = 0;

      records.forEach((record) => {
        const element = elementMap.get(record.id);
        if (!element) {
          return;
        }

        if (!hasTerms) {
          applyVisibility(element, true);
          visibleCount += 1;
          return;
        }

        const tokens = tokenMap.get(record.id) ?? [];
        const matches = terms.every((term) => tokens.some((token) => token.includes(term)));

        applyVisibility(element, matches);
        if (matches) {
          visibleCount += 1;
        }
      });

      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
        if (visibleCount > 0) {
          emptyState.setAttribute('aria-hidden', 'true');
        } else {
          emptyState.removeAttribute('aria-hidden');
        }
      }

      formatCount(visibleCount);
    };

    formatCount(totalCount);

    input.addEventListener('input', () => {
      filter(input.value);
    });

    input.addEventListener('search', () => {
      filter(input.value);
    });
  }
}
