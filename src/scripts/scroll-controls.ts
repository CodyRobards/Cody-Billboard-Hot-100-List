const CONTROL_SELECTOR = '.jump-control';
const BUTTON_SELECTOR = '.jump-control__button';
const ICON_SELECTOR = '.jump-control__icon';
const LABEL_SELECTOR = '.jump-control__label';

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

type Cleanup = () => void;

let cleanupScrollControls: Cleanup | null = null;

export function initializeScrollControls() {
  if (!hasDOM) {
    return;
  }

  if (cleanupScrollControls) {
    cleanupScrollControls();
    cleanupScrollControls = null;
  }

  const cleanupFns: Cleanup[] = [];

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

  const containers = Array.from(document.querySelectorAll<HTMLDivElement>(CONTROL_SELECTOR));

  if (!containers.length) {
    return;
  }

  const overallId = containers.find((item) => item.dataset.overallId)?.dataset.overallId || '';
  const overallSection = overallId ? document.getElementById(overallId) : null;

  if (!overallSection) {
    containers.forEach((container) => {
      container.hidden = true;
    });
    return;
  }

  type ControlState = 'down' | 'top';

  interface ControlConfig {
    container: HTMLDivElement;
    button: HTMLButtonElement;
    icon: HTMLElement;
    label: HTMLElement;
    getState: () => ControlState;
    setState: (state: ControlState) => void;
  }

  const controlConfigs: ControlConfig[] = [];

  containers.forEach((container) => {
    const button = container.querySelector<HTMLButtonElement>(BUTTON_SELECTOR);
    const icon = container.querySelector<HTMLElement>(ICON_SELECTOR);
    const label = container.querySelector<HTMLElement>(LABEL_SELECTOR);

    if (!button || !icon || !label) {
      container.hidden = true;
      return;
    }

    container.hidden = false;

    let currentState: ControlState = container.dataset.state === 'top' ? 'top' : 'down';

    const applyState = (state: ControlState) => {
      container.dataset.state = state;
      button.dataset.state = state;
      if (state === 'down') {
        icon.textContent = '▼';
        const message = 'Jump to overall rankings';
        label.textContent = message;
        button.setAttribute('aria-label', message);
      } else {
        icon.textContent = '▲';
        const message = 'Back to top';
        label.textContent = message;
        button.setAttribute('aria-label', message);
      }
    };

    const setState = (state: ControlState) => {
      currentState = state;
      applyState(state);
    };

    applyState(currentState);

    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      if (currentState === 'down') {
        scrollToId(overallId);
        updateHash(overallId);
      } else {
        scrollToTop();
        updateHash(null);
      }
    };

    button.addEventListener('click', handleClick);
    cleanupFns.push(() => button.removeEventListener('click', handleClick));

    controlConfigs.push({
      container,
      button,
      icon,
      label,
      getState: () => currentState,
      setState,
    });
  });

  if (!controlConfigs.length) {
    return;
  }

  const setAllStates = (state: ControlState) => {
    controlConfigs.forEach((config) => config.setState(state));
  };

  const scrollToTop = () => {
    const behavior = getScrollBehavior();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior });
    } else {
      window.scroll(0, 0);
    }
  };

  const evaluateState = (rect: DOMRect) => {
    const isAboveViewport = rect.top < 0;
    const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
    const nextState: ControlState = isAboveViewport || isIntersecting ? 'top' : 'down';
    setAllStates(nextState);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      const { boundingClientRect, isIntersecting } = entry;
      if (isIntersecting) {
        setAllStates('top');
        return;
      }
      evaluateState(boundingClientRect);
    });
    observer.observe(overallSection);
    cleanupFns.push(() => observer.disconnect());
  } else {
    const onScroll = () => {
      evaluateState(overallSection.getBoundingClientRect());
    };
    (window as Window).addEventListener('scroll', onScroll, { passive: true });
    cleanupFns.push(() => window.removeEventListener('scroll', onScroll));
    onScroll();
  }

  evaluateState(overallSection.getBoundingClientRect());

  // Ensure initial label/aria state is in sync with layout.
  setAllStates(controlConfigs[0].getState());

  cleanupScrollControls = () => {
    cleanupFns.forEach((fn) => fn());
  };
}

if (hasDOM) {
  initializeScrollControls();
  document.addEventListener('prefetch:navigated', initializeScrollControls);
}
