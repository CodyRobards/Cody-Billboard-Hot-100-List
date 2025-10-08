const BUTTON_SELECTOR = '.jump-to-overall';
const TOP_BUTTON_SELECTOR = '.jump-to-top';
const INITIALIZED_FLAG = '__scrollControlsInitialized';

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

if (hasDOM) {
  const globalScope = window as typeof window & Record<string, unknown>;
  if (!globalScope[INITIALIZED_FLAG]) {
    globalScope[INITIALIZED_FLAG] = true;

    const prefersReducedMotion = () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getScrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');

    const scrollToId = (targetId: string | null) => {
      if (!targetId) return;
      const element = document.getElementById(targetId);
      if (!element) return;
      element.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
    };

    const updateHash = (hash: string | null) => {
      const baseUrl = `${window.location.pathname}${window.location.search}`;
      const newUrl = hash ? `${baseUrl}#${hash}` : baseUrl;
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, newUrl);
      } else if (hash) {
        window.location.hash = hash;
      }
    };

    const overallButton = document.querySelector<HTMLAnchorElement>(BUTTON_SELECTOR);
    const topButton = document.querySelector<HTMLAnchorElement>(TOP_BUTTON_SELECTOR);

    if (overallButton) {
      overallButton.addEventListener('click', (event) => {
        const href = overallButton.getAttribute('href');
        if (!href || !href.startsWith('#')) {
          return;
        }
        event.preventDefault();
        const targetId = href.substring(1);
        scrollToId(targetId);
        updateHash(targetId);
      });
    }

    if (topButton) {
      const targetId = topButton.getAttribute('data-target');
      topButton.addEventListener('click', (event) => {
        event.preventDefault();
        const resolvedTarget = targetId || 'page-main';
        scrollToId(resolvedTarget);
        updateHash(null);
      });
    }

    if (overallButton && topButton) {
      const targetId = overallButton.getAttribute('href');
      const overallId = targetId && targetId.startsWith('#') ? targetId.substring(1) : null;
      const overallSection = overallId ? document.getElementById(overallId) : null;

      if (overallSection) {
        let hasReachedOverallSection = false;

        const updateVisibility = (overallSectionVisible: boolean) => {
          if (overallSectionVisible) {
            hasReachedOverallSection = true;
          }

          const shouldShow = hasReachedOverallSection;
          topButton.hidden = !shouldShow;
          if (shouldShow) {
            topButton.classList.add('is-visible');
          } else {
            topButton.classList.remove('is-visible');
          }
        };

        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver(
            (entries) => {
              const [entry] = entries;
              if (!entry) return;
              updateVisibility(entry.isIntersecting);
            },
            { threshold: 0.2 }
          );
          observer.observe(overallSection);
        } else {
          const onScroll = () => {
            const rect = overallSection.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            updateVisibility(isVisible);
          };
          window.addEventListener('scroll', onScroll, { passive: true });
          onScroll();
        }
      }
    }
  }
}
