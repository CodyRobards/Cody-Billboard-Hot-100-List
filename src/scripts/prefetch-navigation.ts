(() => {
  const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (!hasDOM || !('fetch' in window) || !('history' in window)) {
    return;
  }

  const reduceDataPreference = (() => {
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
      if (nav.connection?.saveData) {
        return true;
      }
    }
    if (typeof window.matchMedia === 'function') {
      try {
        return window.matchMedia('(prefers-reduced-data: reduce)').matches;
      } catch {
        return false;
      }
    }
    return false;
  })();

  if (reduceDataPreference) {
    return;
  }

  const contentRoot = document.querySelector<HTMLElement>('#content-root');
  if (!contentRoot) {
    return;
  }

  interface PageEntry {
    html: string;
    title: string;
  }

  const cache = new Map<string, PageEntry>();
  const inflight = new Map<string, Promise<PageEntry>>();
  let currentUrl = window.location.href;

  cache.set(currentUrl, {
    html: contentRoot.innerHTML,
    title: document.title,
  });

  history.replaceState(
    { ...(history.state ?? {}), scrollY: window.scrollY },
    '',
    window.location.pathname + window.location.search + window.location.hash
  );

  function isModifyingClick(event: MouseEvent | PointerEvent): boolean {
    return (
      event.defaultPrevented ||
      ('button' in event && (event as MouseEvent).button !== 0) ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  function getAnchorFromEvent(target: EventTarget | null): HTMLAnchorElement | null {
    let el = target as HTMLElement | null;
    while (el && !(el instanceof HTMLAnchorElement)) {
      el = el.parentElement;
    }
    if (!el || !el.href) {
      return null;
    }
    if (el.target && el.target !== '_self') {
      return null;
    }
    if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') {
      return null;
    }
    return el;
  }

  async function fetchAndCache(url: URL): Promise<PageEntry> {
    const href = url.href;
    if (cache.has(href)) {
      return cache.get(href)!;
    }
    if (inflight.has(href)) {
      return inflight.get(href)!;
    }

    const request = fetch(href, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'prefetch-navigation' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const nextContent = doc.querySelector<HTMLElement>('#content-root');
        if (!nextContent) {
          throw new Error('Missing content root in response');
        }
        const title = doc.title || document.title;
        const entry: PageEntry = { html: nextContent.innerHTML, title };
        cache.set(href, entry);
        return entry;
      })
      .finally(() => {
        inflight.delete(href);
      });

    inflight.set(href, request);
    return request;
  }

  function focusMain() {
    contentRoot.setAttribute('tabindex', '-1');
    contentRoot.focus({ preventScroll: true });
    contentRoot.removeAttribute('tabindex');
  }

  function swapContent(entry: PageEntry) {
    contentRoot.innerHTML = entry.html;
    document.title = entry.title;
  }

  async function prefetch(url: URL) {
    try {
      await fetchAndCache(url);
    } catch {
      // Prefetch errors are non-fatal; allow full navigation fallback.
    }
  }

  async function render(url: URL, entry: PageEntry, pushState: boolean, scrollY: number) {
    cache.set(currentUrl, {
      html: contentRoot.innerHTML,
      title: document.title,
    });

    swapContent(entry);

    if (pushState) {
      history.pushState({ scrollY }, '', url.pathname + url.search + url.hash);
    } else {
      history.replaceState(
        { ...(history.state ?? {}), scrollY },
        '',
        url.pathname + url.search + url.hash
      );
    }

    currentUrl = url.href;
    window.scrollTo(0, scrollY);
    focusMain();
  }

  async function navigateTo(url: URL) {
    history.replaceState(
      { ...(history.state ?? {}), scrollY: window.scrollY },
      '',
      window.location.pathname + window.location.search + window.location.hash
    );

    try {
      const entry = await fetchAndCache(url);
      await render(url, entry, true, 0);
    } catch {
      window.location.href = url.href;
    }
  }

  function handleIntent(event: Event) {
    const anchor = getAnchorFromEvent(event.target);
    if (!anchor) {
      return;
    }
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return;
    }
    if (url.href === currentUrl) {
      return;
    }
    prefetch(url);
  }

  document.addEventListener('mouseover', handleIntent);
  document.addEventListener('focusin', handleIntent);
  document.addEventListener('touchstart', handleIntent, { passive: true });

  document.addEventListener(
    'click',
    (event) => {
      const anchor = getAnchorFromEvent(event.target);
      if (!anchor) {
        return;
      }

      if (isModifyingClick(event)) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }
      if (url.href === currentUrl) {
        return;
      }

      event.preventDefault();
      navigateTo(url);
    },
    true
  );

  window.addEventListener('popstate', async (event) => {
    const url = new URL(window.location.href);
    try {
      const entry = await fetchAndCache(url);
      const scrollY =
        event.state && typeof event.state.scrollY === 'number' ? event.state.scrollY : 0;
      await render(url, entry, false, scrollY);
    } catch {
      window.location.href = url.href;
    }
  });
})();
