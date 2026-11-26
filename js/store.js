// 데이터 계층: Firebase(Firestore) 또는 체험 모드(localStorage). 두 구현이 같은 API를 가진다.
//   store.data[col]  : { id: doc }      (실시간 반영)
//   put / patch / tx : 쓰기. 삭제는 없다(문서에 deleted:true 를 표시하는 방식).
import { FIREBASE_CONFIG } from './config.js';

// 읽기 줄이기: 경기 기록·선수는 바뀐 것만(upd), 접속 표시는 최근 15분, 채팅은 채팅창을 열었을 때만 20개(닫혀 있으면 최신 1개로 새 메시지만 감지), 게시판 5개만 실시간, 라인 지원·주사위는 meta 구독 하나로.
// reveals(승률 공개 이벤트)는 계속 쌓이는 기록이라 전체를 구독하지 않고 watchCollection으로 최근 것만 따로 듣는다.
// 경매(auctions)는 경매 화면을 연 사람만 need()로 구독한다(입찰마다 모든 접속자가 다시 읽지 않게).
const WATCHED = ['players', 'matches', 'meta', 'presence', 'chat', 'posts'];
const PRESENCE_MS = 15 * 60e3; // 접속 표시는 12분 안에 신호가 있는 사람만 보이므로, 처음 읽을 때 15분 안의 기록만 받는다
const CHAT_LIMIT = 20; // 채팅은 문서가 계속 쌓이므로 최근 20개만 구독한다(기록 자체는 DB에 남는다). 채팅창이 닫혀 있으면 1개(chatFull)
const INC = ['matches', 'players']; // 마지막 수정 시각(upd) 이후 바뀐 문서만 받는 컬렉션(7일에 1번은 전체, 하루 1번 문서 수 확인)
const POST_LIMIT = 5; // 익명 게시판도 최근 5개만 실시간으로 받고(나머지는 접어 두고 읽지 않음), 이전 글은 '더 보기'를 누를 때 10개씩 한 번만 읽는다
const FUSE_MSG = '저장이 너무 잦아 이 화면의 저장을 잠시 멈췄어요. 새로고침해 주세요';
const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore는 undefined를 받지 않는다
const FB ='https://www.gstatic.com/firebasejs/10.12.5/'; // index.html 이 같은 주소를 미리 받아 둔다(modulepreload). 버전을 바꾸면 거기도 같이 바꿀 것

export async function createStore(key, onChange, opt = {}) {
  return FIREBASE_CONFIG && key !== 'local' ? firebaseStore(key, onChange, opt) : localStore(key, onChange); // 주소에 ?demo 를 붙이면 체험 모드
}

function localStore(key, onChange) {
  const k = (col) => `naejeon:${key}:${col}`;
  const load = (col) => { try { return JSON.parse(localStorage.getItem(k(col))) || {}; } catch { return {}; } };
  const data = {};
  WATCHED.concat('auctions', 'history', 'reveals', 'gacha').forEach((c) => (data[c] = load(c)));
  const recs = {}; // watchRecent(길드 사랑방): 이 컬렉션이 바뀌면 최신 n개를 다시 넘긴다
  const subs = {}; // 체험 모드에서도 다른 탭의 이벤트(승률 공개)를 받을 수 있게 한다
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('naejeon:' + key) : null;
  if (bc) bc.onmessage = (e) => {
    const c = e.data.col || e.data; data[c] = load(c);
    recs[c]?.forEach((f) => f());
    if (e.data.id && subs[c]) { const doc = data[c][e.data.id]; if (doc) subs[c].forEach((f) => f({ changes: () => [{ type: 'added', doc }] })); }
    onChange(c);
  };
  const save = (col, id) => {
    localStorage.setItem(k(col), JSON.stringify(data[col]));
    if (bc) bc.postMessage({ col, id });
    recs[col]?.forEach((f) => f());
    onChange(col);
  };
  return {
    mode: 'local', data, ready: Promise.resolve(),
    serverNow: () => Date.now(),
    serverClockReady: () => true,
    serverClockErr: () => 0,
    syncServerClock: async () => 0,
    clockSoon: async () => 0,
    async copyTo(nk, cols, prog) { let n = 0; for (const c of cols) { const v = localStorage.getItem(k(c)); if (v) { localStorage.setItem(`naejeon:${nk}:${c}`, v); n += Object.keys(JSON.parse(v) || {}).length; } prog?.(c, n); } return n; },
    need: async () => {}, needDoc: async () => {}, unneed() {}, loaded: () => true, allLoaded: () => true, // 체험 모드는 모든 컬렉션을 이미 들고 있다
    chatFull() {}, countSince: async (col, field, gt) => Object.values(data[col] || {}).filter((d) => d[field] > gt).length,
    pause() {}, isPaused: () => false, // 체험 모드는 사용량이 없으니 쉬지 않는다
    bulk: (fn) => fn(),
    watchDoc: (col, id, onData) => {
      onData(data[col]?.[id] || null);
      return () => {};
    },
    watchCollection: (col, onSnap, onError) => {
      onSnap({ changes: () => Object.values(data[col] || {}).map((d) => ({ type: 'added', doc: d })) });
      (subs[col] ||= []).push(onSnap);
      return () => {};
    },
    watchRecent(col, n, cb) { const f = () => { data[col] = load(col); cb(Object.values(data[col]).sort((a, b) => b.at - a.at).slice(0, n)); }; (recs[col] ||= new Set()).add(f); f(); return () => recs[col].delete(f); },
    bye() {},
    async get(col, id) { data[col] = load(col); return data[col][id] ? { ...data[col][id] } : null; },
    async older(col, before, n) { return Object.values(data[col] || {}).filter((d) => d.at < before).sort((a, b) => b.at - a.at).slice(0, n); },
    async count(col, field, value) { return Object.values(data[col] || {}).filter((d) => d[field] === value).length; },
    async byField(col, field, value, after, n) { return Object.entries(load(col)).map(([id, d]) => ({ ...d, id })).filter((d) => d[field] === value && !d.deleted && (!after || d.id > after)).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, n); },
    // 미리 불러 두지 않은 컬렉션(댓글 등)은 저장 전에 기존 내용을 먼저 읽는다(덮어쓰지 않게)
    async put(col, id, doc) { (data[col] ||= load(col))[id] = { ...doc, id }; save(col, id); },
    async patch(col, id, part) { data[col] ||= load(col); data[col][id] = { ...(data[col][id] || { id }), ...part }; save(col); },
    async tx(col, id, fn) {
      data[col] = load(col);
      const next = fn(data[col][id] || null);
      if (next) { data[col][id] = { ...next, id }; save(col); }
      return !!next;
    },
  };
}

async function firebaseStore(key, onChange, opt = {}) {
  const [{ initializeApp }, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore.js')]);
  // 로컬 캐시(IndexedDB): 새로고침해도 기기에 저장된 기록을 먼저 쓰고, 서버에서는 바뀐 문서만 받는다(30분 안에 다시 열면 바뀐 문서만 읽기로 계산).
  // 여러 탭을 동시에 열어도 되도록 탭 관리자를 쓴다. 저장소를 막는 브라우저(일부 사파리 개인정보 보호 모드 등)는 SDK가 알아서 지금처럼 메모리로 동작한다.
  const app = initializeApp(FIREBASE_CONFIG);
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
  catch (e) { console.warn('[store] 로컬 캐시를 쓸 수 없어 기본 방식으로 연결합니다', e); db = fs.getFirestore(app); }
  const ref = (col, id) => fs.doc(db, 'leagues', key, col, id);
  let clockOffset = 0, clockErr = 0, clockSyncedAt = 0, clockPromise = null;
  // 쓰기 안전장치: 버그로 한 화면이 저장을 반복하면(1분에 100번 넘게) 그 화면의 저장을 모두 멈추고 app.js 에 알린다(onChange('fuse')).
  // 사람이 누르는 속도로는 닿지 않는 기준. 관리자 복원·가져오기·점수 일괄 적용처럼 한 번에 많이 쓰는 일은 bulk() 안에서 해서 세지 않는다.
  // 멈춘 뒤에는 서버에 요청을 보내지 않고 바로 실패로 돌려준다(새로고침하면 다시 정상). 읽기·실시간 반영은 그대로.
  const FUSE_N = 100, FUSE_MS = 60e3, writeAt = [];
  let fused = false, bulkN = 0;
  const guard = () => {
    if (fused) throw new Error(FUSE_MSG);
    if (bulkN) return;
    const now = performance.now();
    writeAt.push(now);
    while (writeAt[0] <= now - FUSE_MS) writeAt.shift();
    if (writeAt.length > FUSE_N) { fused = true; console.warn('[store] 1분에 저장 ' + writeAt.length + '번: 이 화면의 저장을 멈춥니다'); onChange('fuse'); throw new Error(FUSE_MSG); }
  };

  // Firestore serverTimestamp()로 서버 시각을 받아 브라우저 시계 오차를 보정한다.
  // 일반 기능은 기존 Date.now()를 그대로 사용하고, reveal처럼 동시 시작이 필요한 기능만 serverNow()를 사용한다.
  const syncServerClock = async (force = false) => {
    if (!force && clockSyncedAt && performance.now() - clockSyncedAt < 5 * 60e3) return clockOffset;
    if (clockPromise) return clockPromise;
    clockPromise = (async () => {
      guard();
      const before = Date.now();
      const clockRef = ref('clock', 'sync'); // 구독하지 않는 컬렉션에 둔다(meta에 두면 누가 접속할 때마다 모두의 화면이 다시 그려진다)
      await fs.setDoc(clockRef, { at: fs.serverTimestamp() }, { merge: true });
      const wrote = Date.now(); // 서버 시각은 이 쓰기(before~wrote) 안의 어느 순간에 찍힌다. 뒤의 읽기 시간은 계산에 넣지 않는다
      const snap = await fs.getDocFromServer(clockRef);
      const ts = snap.data()?.at;
      if (ts?.toMillis) {
        // 쓰기 왕복의 중간 시점을 기준으로 오차를 추정하고, 왕복의 절반을 '최대 오차'로 둔다.
        // (휴대폰 연결이 잠깐 느리면 요청이 늦게 도착해 시계가 앞서 보일 수 있다. 경매 마감처럼 늦으면 안 되는 판단은 이 최대 오차만큼 기다린다)
        clockOffset = ts.toMillis() - ((before + wrote) / 2);
        clockErr = Math.max(0, (wrote - before) / 2);
        clockSyncedAt = performance.now();
      }
      return clockOffset;
    })().catch((e) => {
      console.warn('server clock sync failed', e);
      return clockOffset;
    }).finally(() => { clockPromise = null; });
    return clockPromise;
  };

  const serverNow = () => Date.now() + clockOffset;
  // 접속할 때마다 맞추지 않는다(쓰기 1·읽기 1 절약). 서버 시각이 필요한 일(채팅·글 시각, 라인 지원·주사위·경매 연출)을 하기 직전에만 맞춘다.
  // clockSoon: 30분 안에 맞춘 적이 있으면 그대로 쓰고, 아니면 맞춘다(최대 ms 기다림. 실패·지연 시에도 사이트는 기기 시계로 계속 동작).
  const clockSoon = (ms = 2500) => (clockSyncedAt && performance.now() - clockSyncedAt < 30 * 60e3 ? Promise.resolve(clockOffset)
    : Promise.race([syncServerClock(), new Promise((r) => setTimeout(() => r(clockOffset), ms))]));

  const data = { history: {} };
  // 사용량 자동 쉬기(meta/pause): 이 기기가 오늘 쉬는 중이라고 알고 있으면 meta 만 구독해서 시작한다(쉬는 동안 읽기 거의 0).
  // 쉬는 중이 아니었으면(관리자가 풀었거나 날이 바뀜) app.js 가 새로고침해서 정상으로 시작한다.
  const ptDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  let isPaused = (() => { try { const v = localStorage.getItem('naejeon:pause:' + key); return !!v && v === ptDay(); } catch { return false; } })(); // 기록이 없으면 시간대 계산(느림)을 하지 않는다
  const UNSUB = {};
  const startCols = isPaused ? ['meta'] : WATCHED;
  WATCHED.forEach((c) => { if (!startCols.includes(c)) data[c] = {}; });
  let pending = startCols.length, done;
  const ready = new Promise((r) => (done = r));
  const seen = {};
  const mark = (col) => { if (!seen[col]) { seen[col] = 1; if (--pending === 0) done(); } };
  // 처음 화면은 서버 확인이 끝난 값으로 그린다(캐시의 옛 값으로 시작하면 주사위·라인 지원·입장 알림이 '새로 생긴 일'로 오해할 수 있어서).
  // 그래서 캐시에서 온 첫 결과는 담아만 두고, 서버 확인 결과가 오면 준비 완료로 본다. 오프라인이면 4초 뒤 캐시 값으로 시작한다.
  const cached = {};
  setTimeout(() => startCols.forEach((col) => cached[col] && mark(col)), 4000); // 캐시가 있으면 4초, 없으면(첫 방문·빈 컬렉션) 12초까지 서버를 기다린다
  setTimeout(() => startCols.forEach(mark), 12000);
  // 경기 기록·선수(INC): 기기에 저장된 기록(Firestore 로컬 캐시)을 먼저 쓰고, 서버에서는 마지막 수정 시각(upd) 이후에 바뀐 문서만 받는다.
  // 전체 다시 받기는 7일에 한 번(예전 하루 1번 → 사람·기기마다 하루에 경기 수만큼 읽던 것이 가장 큰 읽기였다). 대신 하루에 한 번은
  // 서버의 문서 수만 세어(내려받지 않음, 1,000개당 읽기 1번) 기기 캐시와 다르면(빠진 문서가 있으면) 바로 전체를 다시 받는다.
  // upd 가 없는 예전 문서가 있으면 전체를 받으며 upd 를 채운다.
  // upd 는 사이트의 저장(put·patch·tx → stamp)과 연동 서버의 라이엇 갱신(worker.js patchWrite 의 updateTransforms)이 서버 시각으로 붙인다.
  const FULL_MS = 7 * 864e5, CNT_MS = 864e5;
  const fullKey = (col) => 'naejeon:' + (col === 'matches' ? 'mfull' : 'pfull') + ':' + key;
  const cntKey = (col) => 'naejeon:' + (col === 'matches' ? 'mcnt' : 'pcnt') + ':' + key;
  async function incQuery(col, src, force) {
    const base = {};
    if (!force) try { (await fs.getDocsFromCache(src)).forEach((d) => (base[d.id] = { ...d.data(), id: d.id })); } catch {}
    const docs = Object.values(base), ups = docs.map((d) => d.upd?.toMillis?.()).filter(Number.isFinite);
    const lastFull = +localStorage.getItem(fullKey(col)) || 0;
    const inc = !force && docs.length > 0 && ups.length > 0 && docs.every((d) => d.upd) && Date.now() - lastFull < FULL_MS;
    return inc ? { q: fs.query(src, fs.where('upd', '>=', fs.Timestamp.fromMillis(Math.max(...ups)))), base, inc } : { q: src, base: {}, inc };
  }
  // 하루 한 번 문서 수 확인(바뀐 것만 받는 중일 때만, 화면을 그린 뒤 뒤에서). 다르면 그 컬렉션만 전체로 다시 구독
  const countCheck = (col, src, n) => {
    if (Date.now() - (+localStorage.getItem(cntKey(col)) || 0) < CNT_MS) return;
    setTimeout(() => fs.getCountFromServer(src).then((r) => {
      const total = r.data().count;
      try { localStorage.setItem(cntKey(col), String(Date.now())); } catch {}
      if (total !== n && !isPaused && UNSUB[col]) { console.warn(`[store] ${col}: 기기 ${n}개 · 서버 ${total}개 → 전체 다시 받기`); try { UNSUB[col](); } catch {} delete UNSUB[col]; sub(col, true); }
    }).catch(() => {}), 5000);
  };
  const backfilled = {};
  const backfill = (col, m) => { // upd 가 없는 예전 문서에 수정 시각을 한 번 채운다(한 번만, 쓰기 = 그 문서 수)
    if (backfilled[col] || !Object.values(m).some((d) => !d.upd)) return; backfilled[col] = true;
    // 여러 사람이 동시에 채우지 않게 잠시(3~30초) 기다렸다가, 그때도 비어 있는 것만 채운다
    setTimeout(() => Object.values(data[col] || {}).filter((d) => !d.upd).forEach((d) => fs.setDoc(ref(col, d.id), { upd: fs.serverTimestamp() }, { merge: true }).catch(() => {})), 3000 + Math.random() * 27000);
  };
  // 채팅: 채팅창이 열려 있으면 최근 20개, 닫혀 있으면 최신 1개만(새 메시지 알림용). 열고 닫을 때 chatFull()로 바꿔 다시 구독한다
  let chatOn = !!opt.chatOpen;
  const sub = async (col, force = false) => {
    const src = fs.collection(db, 'leagues', key, col);
    const lim = col === 'chat' ? (chatOn ? CHAT_LIMIT : 1) : col === 'posts' ? POST_LIMIT : 0;
    let q = lim ? fs.query(src, fs.orderBy('at', 'desc'), fs.limit(lim)) : src, base = null, inc = false;
    if (col === 'presence') q = fs.query(src, fs.where('at', '>', Date.now() - PRESENCE_MS)); // 그 뒤에 들어오는 신호는 at 이 더 크므로 계속 받는다
    if (INC.includes(col)) { ({ q, base, inc } = await incQuery(col, src, force)); if (inc) { data[col] = { ...base }; cached[col] = true; } }
    if (isPaused && col !== 'meta') return; // 준비 중에 쉬기가 시작됐으면 구독하지 않는다
    let fullPending = INC.includes(col) && !inc;
    UNSUB[col] = fs.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const fromServer = !snap.metadata.fromCache, first = !seen[col];
      if (!first && !snap.docChanges().length && !(fullPending && fromServer)) return; // 내용은 그대로이고 상태 표시만 바뀐 알림은 무시(다시 그리지 않음)
      const m = base ? { ...base } : {};
      snap.forEach((d) => (m[d.id] = { ...d.data(), id: d.id }));
      data[col] = m;
      if (first && !fromServer) { cached[col] = snap.size > 0 || cached[col]; return; } // 캐시 값: 담아만 두고 서버 확인을 기다린다
      if (fullPending && fromServer) { fullPending = false; try { localStorage.setItem(fullKey(col), String(Date.now())); localStorage.setItem(cntKey(col), String(Date.now())); } catch {} backfill(col, m); } // 전체를 받았으면 7일 시계·문서 수 확인 시계를 새로
      mark(col);
      onChange(col);
    }, (err) => { console.error(err); mark(col); onChange('error', err); });
    if (inc) countCheck(col, src, Object.keys(base).length);
  };
  startCols.forEach((col) => { data[col] = {}; sub(col); });
  // 채팅창을 열면(또는 열 것 같으면) 20개로, 닫으면 1개로 다시 구독. 기기 캐시에 있는 채팅이 먼저 보이고 서버 값이 뒤따른다
  const chatFull = (on) => {
    on = !!on; if (on === chatOn) return; chatOn = on;
    if (isPaused || !UNSUB.chat) return;
    try { UNSUB.chat(); } catch {} delete UNSUB.chat; sub('chat');
  };
  // 화면을 열 때만 구독하는 컬렉션(경매). 캐시에 있으면 바로 보여 주고 서버에서 바뀐 것을 이어 받는다.
  // unneed 로 끊어도 30분 안에 다시 열면 서버는 바뀐 문서만 보낸다(Firestore 재개 토큰).
  // 경매는 방이 지워지지 않고 계속 쌓이므로 평소에는 최근 LZ_DAYS일 안에 만든 방만 구독한다(화면을 열 때 읽기 = 최근 방 수).
  // 그보다 오래된 방은 링크로 들어올 때 그 방 문서 하나만(needDoc), 백업·'이전 경매 보기'는 전체(need(col, true))를 받는다.
  const LZ_DAYS = { auctions: ['createdAt', 14] };
  const LZ = {};
  const lzMerge = (col, l) => { data[col] = { ...l.extra, ...l.docs }; };
  const need = (col, all = false) => {
    const prev = LZ[col];
    if (prev && (prev.all || !all || !LZ_DAYS[col])) return prev.ready;
    let res; const l = (LZ[col] = { got: !!prev?.got, all: all || !LZ_DAYS[col], docs: prev?.docs || {}, extra: prev?.extra || {}, xs: {}, ready: new Promise((r) => (res = r)) });
    if (prev) { try { prev.unsub(); } catch {} Object.values(prev.xs).forEach((u) => { try { u(); } catch {} }); } // 최근 → 전체로 넓힐 때: 이미 받은 방은 그대로 보여 주고 새 구독(전체)으로 이어 받는다
    const src = fs.collection(db, 'leagues', key, col), w = LZ_DAYS[col];
    const q = l.all ? src : fs.query(src, fs.where(w[0], '>=', Date.now() - w[1] * 864e5));
    l.unsub = fs.onSnapshot(q, (snap) => {
      if (LZ[col] !== l) return;
      const m = {}; snap.forEach((d) => (m[d.id] = { ...d.data(), id: d.id }));
      l.docs = m; if (l.all) l.extra = {}; lzMerge(col, l); l.got = true; res(); onChange(col);
    }, (err) => { console.error(err); l.got = true; res(); onChange('error', err); });
    return l.ready;
  };
  // 최근 구독에 없는(오래된) 문서 하나만 따로 구독해 같은 data[col]에 합친다. 이미 있으면 아무것도 하지 않는다
  const needDoc = (col, id) => {
    const l = LZ[col]; if (!l || l.all || l.docs[id]) return Promise.resolve();
    if (l.xs[id]) return l.xw[id];
    let res; (l.xw ||= {})[id] = new Promise((r) => (res = r));
    l.xs[id] = fs.onSnapshot(ref(col, id), (snap) => {
      if (LZ[col] !== l || !l.xs[id]) return;
      if (snap.exists()) l.extra[id] = { ...snap.data(), id }; else delete l.extra[id];
      lzMerge(col, l); res(); onChange(col);
    }, (err) => { console.error(err); res(); });
    return l.xw[id];
  };
  const unneed = (col) => { const l = LZ[col]; if (!l) return; delete LZ[col]; try { l.unsub(); } catch {} Object.values(l.xs).forEach((u) => { try { u(); } catch {} }); };
  // 경기 기록·선수를 쓸 때는 항상 서버 시각으로 upd 를 붙인다(다른 기기가 '바뀐 문서'로 알아보는 기준)
  const stamp = (col, o) => (INC.includes(col) ? { ...o, upd: fs.serverTimestamp() } : o);
  return {
    mode: 'firebase', data, ready,
    serverNow,
    serverClockReady: () => !!clockSyncedAt && performance.now() - clockSyncedAt < 5 * 60e3,
    serverClockErr: () => clockErr, // 서버 시각 추정의 최대 오차(ms). 실제 서버 시각은 serverNow() ± 이 값 안에 있다
    syncServerClock, clockSoon,
    need, needDoc, unneed, loaded: (col) => WATCHED.includes(col) || !!LZ[col]?.got, allLoaded: (col) => !LZ_DAYS[col] || !!LZ[col]?.all, chatFull,
    // field 가 gt 보다 큰 문서 수(내려받지 않음, 1,000개당 읽기 1번). 닫힌 채팅창의 '안 읽은 채팅' 숫자
    countSince: async (col, field, gt) => (await fs.getCountFromServer(fs.query(fs.collection(db, 'leagues', key, col), fs.where(field, '>', gt)))).data().count,
    // 쉬기 시작: meta 외 모든 실시간 구독을 끊는다(화면에 이미 받은 기록은 그대로 둔다). 다시 열 때는 새로고침으로 처음부터 시작
    // 초대 링크 바꾸기(관리 > 설정): 이 리그의 문서를 새 코드 아래로 그대로 복사(옛 문서는 지우지 않음). 컬렉션마다 전체 읽기 1번 + 문서마다 쓰기 1번
    async copyTo(nk, cols, prog) {
      let n = 0;
      for (const c of cols) {
        const snap = await fs.getDocs(fs.collection(db, 'leagues', key, c));
        let b = fs.writeBatch(db), k = 0;
        for (const d of snap.docs) { b.set(fs.doc(db, 'leagues', nk, c, d.id), d.data()); n++; if (++k === 400) { await b.commit(); b = fs.writeBatch(db); k = 0; } }
        if (k) await b.commit();
        prog?.(c, n);
      }
      return n;
    },
    pause() { isPaused = true; for (const [c, u] of Object.entries(UNSUB)) if (c !== 'meta') { try { u(); } catch {} delete UNSUB[c]; } Object.keys(LZ).forEach(unneed); },
    isPaused: () => isPaused,
    watchDoc: (col, id, onData, onError) => fs.onSnapshot(ref(col, id), (snap) => {
      if (snap.metadata.fromCache) return; // 캐시의 옛 값은 건너뛴다
      onData(snap.exists() ? { ...snap.data(), id: snap.id } : null, snap);
    }, onError),
    watchCollection: (col, onSnap, onError) => {
      const src = fs.collection(db, 'leagues', key, col);
      // reveal 이벤트는 오래된 기록을 전부 내려받을 필요가 없다.
      // 최신 20건만 실시간으로 구독해 초기 로딩과 장기 데이터 누적에 따른 비용을 줄인다.
      const q = col === 'reveals'
        ? fs.query(src, fs.orderBy('at', 'desc'), fs.limit(20))
        : src;
      return fs.onSnapshot(q, onSnap, onError);
    },
    // 최신 n개만 실시간으로(길드 사랑방 채팅·게시판). 화면을 떠나면 돌려준 함수로 끊는다. 단일 필드 정렬이라 색인을 따로 만들 필요 없음
    watchRecent: (col, n, cb, onError) => fs.onSnapshot(fs.query(fs.collection(db, 'leagues', key, col), fs.orderBy('at', 'desc'), fs.limit(n)), (snap) => {
      if (snap.metadata.fromCache && snap.empty) return;
      cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    }, onError),
    // 탭을 닫는 순간에도 전송이 끝까지 가도록 keepalive 요청(REST)으로 숫자 필드 하나만 고친다. 접속 종료 표시용.
    bye(col, id, field, value) {
      try {
        const u = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/leagues/${key}/${col}/${id}?updateMask.fieldPaths=${field}&key=${FIREBASE_CONFIG.apiKey}`;
        fetch(u, { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { [field]: { integerValue: String(value) } } }) }).catch(() => {});
      } catch {}
    },
    get: async (col, id) => { const d = await fs.getDoc(ref(col, id)); return d.exists() ? { ...d.data(), id } : null; }, // 구독하지 않는 문서(가챠 등)를 필요할 때 한 번 읽는다
    // at 이 before 보다 오래된 문서 n개를 한 번 읽는다(게시판 '더 보기'). 읽은 문서 수만큼만 읽기로 계산된다
    older: async (col, before, n) => (await fs.getDocs(fs.query(fs.collection(db, 'leagues', key, col), fs.orderBy('at', 'desc'), fs.startAfter(before), fs.limit(n)))).docs.map((d) => ({ ...d.data(), id: d.id })),
    // field == value 이고 지우지 않은 문서를 문서 id 순서로 n개(after 다음부터) 한 번 읽는다(게시판 댓글). 단일 필드 색인만으로 되는 질의
    byField: async (col, field, value, after, n) => (await fs.getDocs(fs.query(fs.collection(db, 'leagues', key, col), fs.where(field, '==', value), fs.where('deleted', '==', false), fs.orderBy(fs.documentId()), ...(after ? [fs.startAfter(after)] : []), fs.limit(n)))).docs.map((d) => ({ ...d.data(), id: d.id })),
    // 조건에 맞는 문서 수(문서를 내려받지 않음, 1,000개당 읽기 1번으로 계산)
    count: async (col, field, value) => (await fs.getCountFromServer(fs.query(fs.collection(db, 'leagues', key, col), fs.where(field, '==', value)))).data().count,
    put: async (col, id, doc) => { guard(); return fs.setDoc(ref(col, id), stamp(col, clean({ ...doc, id }))); },
    patch: async (col, id, part) => { guard(); return fs.setDoc(ref(col, id), stamp(col, clean(part)), { merge: true }); },
    // 한 번에 많이 쓰는 관리자 작업(복원·가져오기·점수 일괄 적용)은 안전장치 횟수에 넣지 않는다
    async bulk(fn) { bulkN++; try { return await fn(); } finally { bulkN--; } },
    // 거래(tx)는 실제로 저장할 때만 센다(경매 타이머의 '정산할 게 있나' 확인처럼 아무것도 안 쓰고 끝나는 경우는 세지 않음). 재시도해도 한 번만
    tx: async (col, id, fn) => { if (fused) throw new Error(FUSE_MSG); let counted = false; return fs.runTransaction(db, async (t) => {
      const s = await t.get(ref(col, id));
      const next = fn(s.exists() ? { ...s.data(), id } : null);
      if (next && !counted) { guard(); counted = true; }
      if (next) t.set(ref(col, id), stamp(col, clean({ ...next, id })));
      return next ? { ...next, id } : null;
    }); },
  };
}
