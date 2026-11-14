/**
 * Offline support for the field apps (the survey app and the positions tool).
 *
 * Each has a service worker (public/<app>/sw.js) that keeps what the page
 * fetches. The catch: on the very first visit the page has already loaded its
 * code and data before the worker starts, so none of that was kept, and the
 * first offline launch found only the bare page. Here the page tells the
 * worker, once it is running, every file of this site it has loaded so far,
 * and the worker keeps those too. One visit with a signal is then enough.
 */

export function registerOffline(swUrl: string, scope: string): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance.getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: 'keep', urls: [...new Set(urls)] });
      })
      .catch(() => { /* offline support is a bonus; the app works without it */ });
  });
}
