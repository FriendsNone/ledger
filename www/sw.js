/* Ledger — service-worker kill switch (native build).
   Phase 2 dropped the service worker from the native build: the APK already
   contains every asset, so the SW bought no offline capability and instead
   cached index.html under https://localhost, where reinstalling an updated APK
   did NOT invalidate it — the new APK kept showing the old UI.

   Removing the registration from index.html is not enough on its own: a device
   that installed an earlier APK still has the old worker registered, and it
   serves that stale index.html cache-first, so the new page never gets a chance
   to run. What does reach those devices is this file. The stale page still calls
   register("sw.js"), the browser fetches this script, sees bytes it has not seen
   before, and installs it — and all this one does is erase the caches, unregister
   itself, and reload the page, which then comes straight from the APK.

   Keep this file until every install has been through it. It is inert on a fresh
   install, where nothing registers it in the first place.

   The web/PWA build keeps a real service worker — see reference/sw.js. */

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (windows) {
        // Now uncontrolled, so this reload is served by the APK, not the cache.
        windows.forEach(function (w) { try { w.navigate(w.url); } catch (err) {} });
      })
      .catch(function () {})
  );
});

/* Deliberately no fetch handler — an unregistering worker must never answer a
   request from the cache it is in the middle of deleting. */
