const SHOW_LABEL = 'Play on Spotify';
const HIDE_LABEL = 'Hide Spotify player';
const BUTTON_SELECTOR = '.overall-ranking-list__spotify-toggle';
const IFRAME_ALLOW = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
const INITIALIZED_FLAG = '__spotifyEmbedToggleInitialized';

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

if (hasDOM) {
  const globalScope = window as typeof window & Record<string, unknown>;
  if (globalScope[INITIALIZED_FLAG]) {
    // prevent duplicate init
  } else {
    globalScope[INITIALIZED_FLAG] = true;

    const getContainer = (button: HTMLButtonElement): HTMLElement | null => {
      const id = button.getAttribute('aria-controls');
      return id ? (document.getElementById(id) as HTMLElement | null) : null;
    };

    const createIframe = (trackId: string): HTMLIFrameElement => {
      const iframe = document.createElement('iframe');
      const src = new URL(`https://open.spotify.com/embed/track/${trackId}`);
      // autoplay param is ignored by Spotify; playback triggered below
      src.searchParams.set('utm_source', 'oembed');
      iframe.src = src.toString();
      iframe.allow = IFRAME_ALLOW;
      iframe.loading = 'lazy';
      iframe.title = 'Spotify player';
      iframe.width = '100%';
      iframe.height = '80';
      iframe.style.border = '0';
      iframe.style.borderRadius = '12px';

      // Once loaded, immediately tell Spotify to play
      iframe.addEventListener('load', () => {
        // wait a short beat so iframe JS is ready
        setTimeout(() => {
          try {
            iframe.contentWindow?.postMessage({ type: 'play' }, 'https://open.spotify.com');
          } catch {
            /* fallback: user can hit play manually */
          }
        }, 400);
      });
      return iframe;
    };

    const closeButton = (button: HTMLButtonElement) => {
      const container = getContainer(button);
      if (!container) return;
      container.hidden = true;
      container.innerHTML = '';
      button.setAttribute('aria-expanded', 'false');
      button.textContent = SHOW_LABEL;
    };

    const closeOtherWidgets = (current: HTMLButtonElement) => {
      document
        .querySelectorAll<HTMLButtonElement>(`${BUTTON_SELECTOR}[aria-expanded="true"]`)
        .forEach((btn) => {
          if (btn !== current) closeButton(btn);
        });
    };

    document.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      const button = target?.closest<HTMLButtonElement>(BUTTON_SELECTOR);
      if (!button) return;

      const trackId = button.dataset.trackId;
      const container = getContainer(button);
      if (!trackId || !container) return;

      const isOpen = button.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeButton(button);
        return;
      }

      closeOtherWidgets(button);

      // open + autoplay
      container.hidden = false;
      container.innerHTML = '';
      const iframe = createIframe(trackId);
      container.append(iframe);

      button.setAttribute('aria-expanded', 'true');
      button.textContent = HIDE_LABEL;
    });
  }
}
