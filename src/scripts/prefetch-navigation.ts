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
  const contentRootEl: HTMLElement = contentRoot;

  interface SerializedHeadNode {
    tagName: 'STYLE' | 'LINK';
    attributes: Record<string, string>;
    content?: string;
  }

  interface PageEntry {
    html: string;
    title: string;
    headNodes: SerializedHeadNode[];
  }

  const managedAttribute = 'data-prefetch-managed';
  const managedKeyAttribute = 'data-prefetch-managed-key';

  function isSameDocumentNavigation(url: URL): boolean {
    return url.pathname === window.location.pathname && url.search === window.location.search;
  }

  function escapeForAttribute(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function serializeElement(element: Element): SerializedHeadNode | null {
    if (!(element instanceof HTMLStyleElement || element instanceof HTMLLinkElement)) {
      return null;
    }

    if (element instanceof HTMLLinkElement) {
      const rel = element.getAttribute('rel');
      if (!rel || !rel.toLowerCase().split(/\s+/).includes('stylesheet')) {
        return null;
      }
    }

    const attributes: Record<string, string> = {};
    for (const { name, value } of Array.from(element.attributes)) {
      if (name === managedAttribute || name === managedKeyAttribute) {
        continue;
      }
      attributes[name] = value;
    }

    if (element instanceof HTMLStyleElement) {
      return {
        tagName: 'STYLE',
        attributes,
        content: element.textContent ?? '',
      };
    }

    return {
      tagName: 'LINK',
      attributes,
    };
  }

  function serializeHeadNodesFromDocument(doc: Document): SerializedHeadNode[] {
    const nodes: SerializedHeadNode[] = [];
    const elements = doc.head?.querySelectorAll('style, link[rel~="stylesheet"]');
    if (!elements) {
      return nodes;
    }
    elements.forEach((element) => {
      const serialized = serializeElement(element);
      if (serialized) {
        nodes.push(serialized);
      }
    });
    return nodes;
  }

  function getHeadNodeKey(node: SerializedHeadNode): string {
    return JSON.stringify({
      tagName: node.tagName,
      attributes: node.attributes,
      content: node.content ?? null,
    });
  }

  function ensureManagedAttributes() {
    const elements = document.head?.querySelectorAll('style, link[rel~="stylesheet"]');
    if (!elements) {
      return;
    }
    elements.forEach((element) => {
      const serialized = serializeElement(element);
      if (!serialized) {
        return;
      }
      element.setAttribute(managedAttribute, 'true');
      element.setAttribute(managedKeyAttribute, getHeadNodeKey(serialized));
    });
  }

  function getManagedHeadNodes(): SerializedHeadNode[] {
    const nodes: SerializedHeadNode[] = [];
    const elements = document.head?.querySelectorAll(`[${managedAttribute}]`);
    if (!elements) {
      return nodes;
    }
    elements.forEach((element) => {
      const serialized = serializeElement(element);
      if (serialized) {
        nodes.push(serialized);
      }
    });
    return nodes;
  }

  function createElementFromSerialized(node: SerializedHeadNode): Element {
    const element = document.createElement(node.tagName.toLowerCase());
    for (const [name, value] of Object.entries(node.attributes)) {
      element.setAttribute(name, value);
    }
    if (node.tagName === 'STYLE' && node.content !== undefined) {
      element.textContent = node.content;
    }
    element.setAttribute(managedAttribute, 'true');
    element.setAttribute(managedKeyAttribute, getHeadNodeKey(node));
    return element;
  }

  function syncHeadNodes(headNodes: SerializedHeadNode[]) {
    const desiredKeys = new Set<string>();
    headNodes.forEach((node) => desiredKeys.add(getHeadNodeKey(node)));

    const managedElements = Array.from(
      document.head?.querySelectorAll(`[${managedAttribute}]`) ?? []
    );
    managedElements.forEach((element) => {
      const key = element.getAttribute(managedKeyAttribute);
      if (!key || !desiredKeys.has(key)) {
        element.remove();
      }
    });

    const fragment = document.createDocumentFragment();
    headNodes.forEach((node) => {
      const key = getHeadNodeKey(node);
      const existing = document.head?.querySelector(
        `[${managedKeyAttribute}="${escapeForAttribute(key)}"]`
      );
      if (existing) {
        fragment.append(existing);
        return;
      }
      fragment.append(createElementFromSerialized(node));
    });

    document.head?.append(fragment);
  }

  ensureManagedAttributes();

  const cache = new Map<string, PageEntry>();
  const inflight = new Map<string, Promise<PageEntry>>();
  let currentUrl = window.location.href;

  cache.set(currentUrl, {
    html: contentRootEl.innerHTML,
    title: document.title,
    headNodes: getManagedHeadNodes(),
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
    if (!el || !(el instanceof HTMLAnchorElement)) {
      return null;
    }
    const anchor = el;
    if (!anchor.href) {
      return null;
    }
    if (anchor.target && anchor.target !== '_self') {
      return null;
    }
    if (anchor.hasAttribute('download') || anchor.getAttribute('rel') === 'external') {
      return null;
    }
    return anchor;
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
        const entry: PageEntry = {
          html: nextContent.innerHTML,
          title,
          headNodes: serializeHeadNodesFromDocument(doc),
        };
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
    contentRootEl.setAttribute('tabindex', '-1');
    contentRootEl.focus({ preventScroll: true });
    contentRootEl.removeAttribute('tabindex');
  }

  function swapContent(entry: PageEntry) {
    syncHeadNodes(entry.headNodes);
    contentRootEl.innerHTML = entry.html;
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
      html: contentRootEl.innerHTML,
      title: document.title,
      headNodes: getManagedHeadNodes(),
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
    if (isSameDocumentNavigation(url)) {
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
      if (isSameDocumentNavigation(url)) {
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
