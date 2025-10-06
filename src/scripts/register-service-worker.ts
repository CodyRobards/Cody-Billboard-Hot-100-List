const register = async () => {
  try {
    const hasExistingController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('/sw.js');

    if (!registration) {
      return;
    }

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) {
        return;
      }

      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated' && hasExistingController) {
          window.location.reload();
        }
      });
    };

    watchWorker(registration.installing);

    registration.addEventListener('updatefound', () => {
      watchWorker(registration.installing);
    });
  } catch {
    // Silently ignore registration errors to avoid impacting the page.
  }
};

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void register();
  });
}
