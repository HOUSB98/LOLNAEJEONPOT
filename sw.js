// 휴대폰 알림용 서비스 워커. 화면 캐시는 하지 않는다(사이트를 고치면 바로 반영되도록 fetch 를 가로채지 않음).
// 연동 서버(Worker)가 보내는 알림은 내용이 없는 '깨우기' 신호다. 깨어나면 리그의 ops/push 문서(최근 알림 10개)를 읽어
// 아직 안 보여 준 것 중 내가 켜 둔 종류만 알림으로 띄운다. 리그 코드는 등록할 때 주소(?k=)로 받는다.
const Q = new URL(location.href).searchParams, KEY = Q.get('k') || '', CID = Q.get('c') || ''; // 리그 코드, 이 기기 id
const PROJECT = 'lolnaejeonpot', API_KEY = 'AIzaSyBx9DdwpagQTZqFqkISJLPpRe7zHYKOgC0'; // 공개값(js/config.js 와 같음)
const ALL = ['board', 'match', 'gacha', 'post'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// 상태(마지막으로 보여 준 시각, 켜 둔 종류)는 이 기기의 Cache Storage 에 둔다
const STATE = '/__naejeon_push_state';
async function getState() { try { const r = await (await caches.open('naejeon-push')).match(STATE); return r ? await r.json() : {}; } catch { return {}; } }
async function setState(s) { try { await (await caches.open('naejeon-push')).put(STATE, new Response(JSON.stringify(s))); } catch {} }
self.addEventListener('message', (e) => {
  if (e.data?.type === 'prefs') e.waitUntil(getState().then((s) => setState({ ...s, prefs: e.data.prefs, last: Math.max(+s.last || 0, +e.data.since || 0) })));
});

function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  return null;
}

self.addEventListener('push', (e) => e.waitUntil((async () => {
  const s = await getState(), prefs = Array.isArray(s.prefs) ? s.prefs : ALL;
  let items = [];
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/leagues/${KEY}/ops/push?key=${API_KEY}`);
    if (r.ok) items = dec({ mapValue: { fields: (await r.json()).fields || {} } }).items || [];
  } catch {}
  let fresh = items.filter((x) => x && +x.at > (+s.last || 0) && (x.type === 'test' ? x.to === CID : prefs.includes(x.type))).sort((a, b) => a.at - b.at).slice(-3);
  if (!fresh.length) fresh = [{ title: 'NAEJEONPOT', body: '새 소식이 있어요. 눌러서 확인해 보세요', url: '', at: +s.last || 0 }]; // 브라우저 규칙상 알림은 꼭 하나 띄워야 한다
  await setState({ ...s, last: Math.max(+s.last || 0, ...fresh.map((x) => +x.at || 0)) });
  for (const x of fresh) {
    await self.registration.showNotification(x.title || 'NAEJEONPOT', { body: x.body || '', icon: 'icons/icon-192.png', badge: 'icons/badge-72.png', tag: x.id || undefined, renotify: !!x.id, data: { url: x.url || '' } });
  }
})()));

// 알림을 누르면 열려 있는 창이 있으면 그 창으로, 없으면 새로 연다
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = e.notification.data?.url || '#/home';
  const target = new URL(`./?k=${encodeURIComponent(KEY)}${hash.startsWith('#') ? hash : '#/home'}`, self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = list.find((c) => c.url.startsWith(self.registration.scope));
    if (win) { await win.focus(); win.postMessage({ type: 'go', hash }); return; }
    await self.clients.openWindow(target);
  })());
});
