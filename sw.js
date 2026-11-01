/* =============================================================
   CAVEAU — il guardiano dell'involucro.
   Tiene in cache soltanto il vestito dell'app: pagina, codice,
   icone. Mai i dati, mai le foto, mai una chiamata al database:
   quelle devono sempre passare dalla rete, altrimenti si vedrebbe
   una cantina vecchia credendola aggiornata.
   Per pubblicare una versione nuova basta cambiare VERSIONE.
   ============================================================= */
var VERSIONE = 'caveau-20.0';

var INVOLUCRO = [
  './',
  './index.html',
  './app.js',
  './dati.js',
  './app.en.js',
  './dati.en.js',
  './supabase.js',
  './manifest.webmanifest',
  './icona-192.png',
  './icona-512.png',
  './icona-maskable-512.png',
  './icona-180.png',
  './favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSIONE)
      .then(function (c) { /* dalla rete, mai dalla cache HTTP: altrimenti una copia vecchia del codice entrerebbe nella versione nuova */ return Promise.all(INVOLUCRO.map(function (u) { return fetch(u, { cache: 'reload' }).then(function (r) { if (!r.ok) throw new Error(u); return c.put(u, r); }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) {
      return Promise.all(k.filter(function (x) { return x !== VERSIONE; })
                          .map(function (x) { return caches.delete(x); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;

  var u = new URL(r.url);

  /* Tutto ciò che non è questa cartella — database, storage, font —
     passa dritto alla rete. Il guardiano non lo tocca. */
  if (u.origin !== self.location.origin) return;
  if (u.pathname.indexOf('/auth/') >= 0 || u.pathname.indexOf('/rest/') >= 0) return;

  /* La pagina: prima la rete, così una versione nuova arriva subito;
     la copia in cache è solo il paracadute per quando la rete non c'è. */
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(function (risp) {
        var copia = risp.clone();
        caches.open(VERSIONE).then(function (c) { c.put('./index.html', copia); });
        return risp;
      }).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true }).then(function (c) {
          return c || new Response('Caveau non è raggiungibile.', {
            status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        });
      })
    );
    return;
  }

  /* Il resto dell'involucro: prima la cache, è immutabile dentro una versione. */
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(function (c) {
      return c || fetch(r).then(function (risp) {
        if (risp && risp.status === 200 && risp.type === 'basic') {
          var copia = risp.clone();
          caches.open(VERSIONE).then(function (k) { k.put(r, copia); });
        }
        return risp;
      });
    })
  );
});
