// Service worker mínimo para PWA: permite que o navegador dispare beforeinstallprompt
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
