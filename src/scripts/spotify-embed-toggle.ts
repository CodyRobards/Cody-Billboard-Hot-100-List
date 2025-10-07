const SHOW_LABEL = 'Play on Spotify';
const HIDE_LABEL = 'Hide Spotify player';
const BUTTON_SELECTOR = '.overall-ranking-list__spotify-toggle';
const IFRAME_ALLOW = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
const INITIALIZED_FLAG = '__spotifyEmbedToggleInitialized';

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

if (hasDOM) {
  const globalScope = window as typeof window & Record<string, unknown>;
  if (globalScope[INITIALIZED_FLAG]) {
    // Avoid registering duplicate listeners when the script is executed again.
  } else {
    globalScope[INITIALIZED_FLAG] = true;

    const getContainer = (button: HTMLButtonElement): HTMLElement | null => {
      const targetId = button.getAttribute('aria-controls');
      if (!targetId) return null;
      const container = document.getElementById(targetId);
      return container instanceof HTMLElement ? container : null;
    };

    const createIframe = (trackId: string): HTMLIFrameElement => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://open.spotify.com/embed/track/${trackId}`;
      iframe.loading = 'lazy';
      iframe.allow = IFRAME_ALLOW;
      iframe.title = 'Spotify player';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.width = '100%';
      iframe.height = '152';
      iframe.style.border = '0';
      iframe.style.borderRadius = '12px';
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

    const closeOtherWidgets = (currentButton: HTMLButtonElement) => {
      const openButtons = document.querySelectorAll<HTMLButtonElement>(
        `${BUTTON_SELECTOR}[aria-expanded="true"]`
      );
      openButtons.forEach((otherButton) => {
        if (otherButton === currentButton) {
          return;
        }
        closeButton(otherButton);
      });
    };

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>(BUTTON_SELECTOR);
      if (!button) {
        return;
      }

      const trackId = button.dataset.trackId;
      if (!trackId) {
        return;
      }

      const container = getContainer(button);
      if (!container) {
        return;
      }

      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        closeButton(button);
        return;
      }

      closeOtherWidgets(button);

      container.innerHTML = '';
      container.hidden = false;
      container.append(createIframe(trackId));
      button.setAttribute('aria-expanded', 'true');
      button.textContent = HIDE_LABEL;
    });
  }
}
