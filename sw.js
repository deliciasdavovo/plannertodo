const CACHE = 'flowdo-v2';
const LOCAL = ['./index.html', './manifest.json', './icon.svg'];

function patchIndexHTML(html) {
  const dynamicDateBlock = `const DAYS_LETTER = ['S','T','Q','Q','S','S','D'];
const DAYS_SHORT  = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

function buildCurrentWeekDates(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatDateKey(date);
  });
}

function formatShortDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  const dayIndex = (date.getDay() + 6) % 7;
  return `${DAYS_SHORT[dayIndex]} ${date.getDate()}`;
}

function formatHeaderDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  return date
    .toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long'
    })
    .replace('.', '');
}

const TODAY = formatDateKey(new Date());
const WEEK_DATES = buildCurrentWeekDates();
const TODAY_IDX = Math.max(0, WEEK_DATES.indexOf(TODAY));
const DATES_MAP = {};

WEEK_DATES.forEach(dateKey => {
  DATES_MAP[dateKey] = formatShortDateLabel(dateKey);
});`;

  return html
    .replace(
      /const TODAY = '2026-05-12';[\s\S]*?const DATES_MAP = \{[\s\S]*?\};/,
      dynamicDateBlock
    )
    .replace(
      /if \(currentNav === 'hoje'\) sub\.hoje = `\$\{getDateLabel\(WEEK_DATES\[activeDay\]\)\} de maio`;/,
      "if (currentNav === 'hoje') sub.hoje = formatHeaderDateLabel(WEEK_DATES[activeDay]);"
    );
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(LOCAL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(async res => {
          const html = await res.text();
          const patched = patchIndexHTML(html);
          const response = new Response(patched, {
            status: res.status,
            statusText: res.statusText,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
          const cache = await caches.open(CACHE);
          cache.put('./index.html', response.clone());
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.href.includes('fonts.g')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).catch(() => caches.match('./index.html'))
    )
  );
});
