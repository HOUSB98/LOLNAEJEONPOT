// 데이터 계층: Firebase(Firestore) 또는 체험 모드(localStorage). 두 구현이 같은 API를 가진다.
//   store.data[col]  : { id: doc }      (실시간 반영)
//   put / patch / tx : 쓰기. 삭제는 없다(문서에 deleted:true 를 표시하는 방식).
import { FIREBASE_CONFIG } from './config.js';

// 읽기 줄이기: 경기 기록은 바뀐 것만(upd), 접속 표시는 최근 하루, 채팅 30·게시판 10개만 실시간, 라인 지원·주사위는 meta 구독 하나로.
// reveals(승률 공개 이벤트)는 계속 쌓이는 기록이라 전체를 구독하지 않고 watchCollection으로 최근 것만 따로 듣는다.
const WATCHED = ['players', 'matches', 'auctions', 'meta', 'presence', 'chat', 'posts'];
const CHAT_LIMIT = 30; // 채팅은 문서가 계속 쌓이므로 최근 30개만 구독한다(기록 자체는 DB에 남는다)
const POST_LIMIT = 10; // 익명 게시판도 최근 10개만 실시간으로 받고, 이전 글은 '더 보기'를 누를 때 10개씩 한 번만 읽는다
const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore는 undefined를 받지 않는다
const FB ='https://www.gstatic.com/firebasejs/10.12.5/';

export async function createStore(key, onChange) {
  return FIREBASE_CONFIG && key !== 'local' ? firebaseStore(key, onChange) : localStore(key, onChange); // 주소에 ?demo 를 붙이면 체험 모드
}

function localStore(key, onChange) {
  const k = (col) => `naejeon:${key}:${col}`;
  const load = (col) => { try { return JSON.parse(localStorage.getItem(k(col))) || {}; } catch { return {}; } };
  const data = {};
  WATCHED.concat('history', 'reveals', 'gacha').forEach((c) => (data[c] = load(c)));
  const subs = {}; // 체험 모드에서도 다른 탭의 이벤트(승률 공개)를 받을 수 있게 한다
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('naejeon:' + key) : null;
  if (bc) bc.onmessage = (e) => {
    const c = e.data.col || e.data; data[c] = load(c);
    if (e.data.id && subs[c]) { const doc = data[c][e.data.id]; if (doc) subs[c].forEach((f) => f({ changes: () => [{ type: 'added', doc }] })); }
    onChange(c);
  };
  const save = (col, id) => {
    localStorage.setItem(k(col), JSON.stringify(data[col]));
    if (bc) bc.postMessage({ col, id });
    onChange(col);
  };
  return {
    mode: 'local', data, ready: Promise.resolve(),
    serverNow: () => Date.now(),
    serverClockReady: () => true,
    syncServerClock: async () => 0,
    watchDoc: (col, id, onData) => {
      onData(data[col]?.[id] || null);
      return () => {};
    },
    watchCollection: (col, onSnap, onError) => {
      onSnap({ changes: () => Object.values(data[col] || {}).map((d) => ({ type: 'added', doc: d })) });
      (subs[col] ||= []).push(onSnap);
      return () => {};
    },
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

async function firebaseStore(key, onChange) {
  const [{ initializeApp }, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore.js')]);
  // 로컬 캐시(IndexedDB): 새로고침해도 기기에 저장된 기록을 먼저 쓰고, 서버에서는 바뀐 문서만 받는다(30분 안에 다시 열면 바뀐 문서만 읽기로 계산).
  // 여러 탭을 동시에 열어도 되도록 탭 관리자를 쓴다. 저장소를 막는 브라우저(일부 사파리 개인정보 보호 모드 등)는 SDK가 알아서 지금처럼 메모리로 동작한다.
  const app = initializeApp(FIREBASE_CONFIG);
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
  catch (e) { console.warn('[store] 로컬 캐시를 쓸 수 없어 기본 방식으로 연결합니다', e); db = fs.getFirestore(app); }
  const ref = (col, id) => fs.doc(db, 'leagues', key, col, id);
  let clockOffset = 0, clockSyncedAt = 0, clockPromise = null;

  // Firestore serverTimestamp()로 서버 시각을 받아 브라우저 시계 오차를 보정한다.
  // 일반 기능은 기존 Date.now()를 그대로 사용하고, reveal처럼 동시 시작이 필요한 기능만 serverNow()를 사용한다.
  const syncServerClock = async (force = false) => {
    if (!force && clockSyncedAt && performance.now() - clockSyncedAt < 5 * 60e3) return clockOffset;
    if (clockPromise) return clockPromise;
    clockPromise = (async () => {
      const before = Date.now();
      const clockRef = ref('clock', 'sync'); // 구독하지 않는 컬렉션에 둔다(meta에 두면 누가 접속할 때마다 모두의 화면이 다시 그려진다)
      await fs.setDoc(clockRef, { at: fs.serverTimestamp() }, { merge: true });
      const snap = await fs.getDocFromServer(clockRef);
      const ts = snap.data()?.at;
      const after = Date.now();
      if (ts?.toMillis) {
        // 요청 왕복시간의 중간 시점을 기준으로 서버-클라이언트 시계 오차를 추정한다.
        clockOffset = ts.toMillis() - ((before + after) / 2);
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
  // 백그라운드에서 한 번 동기화한다. 실패해도 사이트의 기존 기능은 그대로 동작한다.
  syncServerClock();

  const data = { history: {} };
  let pending = WATCHED.length, done;
  const ready = new Promise((r) => (done = r));
  const seen = {};
  const mark = (col) => { if (!seen[col]) { seen[col] = 1; if (--pending === 0) done(); } };
  // 처음 화면은 서버 확인이 끝난 값으로 그린다(캐시의 옛 값으로 시작하면 주사위·라인 지원·입장 알림이 '새로 생긴 일'로 오해할 수 있어서).
  // 그래서 캐시에서 온 첫 결과는 담아만 두고, 서버 확인 결과가 오면 준비 완료로 본다. 오프라인이면 4초 뒤 캐시 값으로 시작한다.
  const cached = {};
  setTimeout(() => WATCHED.forEach((col) => cached[col] && mark(col)), 4000); // 캐시가 있으면 4초, 없으면(첫 방문·빈 컬렉션) 12초까지 서버를 기다린다
  setTimeout(() => WATCHED.forEach(mark), 12000);
  // 경기 기록: 기기에 저장된 기록(Firestore 로컬 캐시)을 먼저 쓰고, 서버에서는 마지막 수정 시각(upd) 이후에 바뀐 경기만 받는다.
  // 하루에 한 번은 전체를 다시 받아 혹시 빠진 것을 맞추고, upd 가 없는 예전 기록에는 이때 upd 를 채워 넣는다.
  const FULL_KEY = 'naejeon:mfull:' + key;
  async function matchesQuery(src) {
    const base = {};
    try { (await fs.getDocsFromCache(src)).forEach((d) => (base[d.id] = { ...d.data(), id: d.id })); } catch {}
    const docs = Object.values(base), ups = docs.map((d) => d.upd?.toMillis?.()).filter(Number.isFinite);
    const lastFull = +localStorage.getItem(FULL_KEY) || 0;
    const inc = docs.length > 0 && ups.length > 0 && docs.every((d) => d.upd) && Date.now() - lastFull < 24 * 3600e3;
    return inc ? { q: fs.query(src, fs.where('upd', '>=', fs.Timestamp.fromMillis(Math.max(...ups)))), base, inc } : { q: src, base: {}, inc };
  }
  let backfilled = false;
  const backfill = (m) => { // upd 가 없는 예전 경기 기록에 수정 시각을 한 번 채운다(한 번만, 쓰기 = 그 경기 수)
    if (backfilled || !Object.values(m).some((d) => !d.upd)) return; backfilled = true;
    // 여러 사람이 동시에 채우지 않게 잠시(3~30초) 기다렸다가, 그때도 비어 있는 것만 채운다
    setTimeout(() => Object.values(data.matches || {}).filter((d) => !d.upd).forEach((d) => fs.setDoc(ref('matches', d.id), { upd: fs.serverTimestamp() }, { merge: true }).catch(() => {})), 3000 + Math.random() * 27000);
  };
  WATCHED.forEach(async (col) => {
    data[col] = {};
    const src = fs.collection(db, 'leagues', key, col);
    const lim = col === 'chat' ? CHAT_LIMIT : col === 'posts' ? POST_LIMIT : 0;
    let q = lim ? fs.query(src, fs.orderBy('at', 'desc'), fs.limit(lim)) : src, base = null, inc = false;
    if (col === 'presence') q = fs.query(src, fs.where('at', '>', Date.now() - 24 * 3600e3)); // 접속 표시는 최근 하루 안의 기록만(표시는 원래 12분 안의 사람만)
    if (col === 'matches') { ({ q, base, inc } = await matchesQuery(src)); if (inc) { data[col] = { ...base }; cached[col] = true; } }
    fs.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const fromServer = !snap.metadata.fromCache, first = !seen[col];
      if (!first && !snap.docChanges().length) return; // 내용은 그대로이고 상태 표시만 바뀐 알림은 무시(다시 그리지 않음)
      const m = base ? { ...base } : {};
      snap.forEach((d) => (m[d.id] = { ...d.data(), id: d.id }));
      data[col] = m;
      if (first && !fromServer) { cached[col] = snap.size > 0 || cached[col]; return; } // 캐시 값: 담아만 두고 서버 확인을 기다린다
      if (col === 'matches' && !inc && fromServer && first) { try { localStorage.setItem(FULL_KEY, String(Date.now())); } catch {} backfill(m); }
      mark(col);
      onChange(col);
    }, (err) => { console.error(err); mark(col); onChange('error', err); });
  });
  // 경기 기록을 쓸 때는 항상 서버 시각으로 upd 를 붙인다(다른 기기가 '바뀐 경기'로 알아보는 기준)
  const stamp = (col, o) => (col === 'matches' ? { ...o, upd: fs.serverTimestamp() } : o);
  return {
    mode: 'firebase', data, ready,
    serverNow,
    serverClockReady: () => !!clockSyncedAt && performance.now() - clockSyncedAt < 5 * 60e3,
    syncServerClock,
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
    put: (col, id, doc) => fs.setDoc(ref(col, id), stamp(col, clean({ ...doc, id }))),
    patch: (col, id, part) => fs.setDoc(ref(col, id), stamp(col, clean(part)), { merge: true }),
    tx: (col, id, fn) => fs.runTransaction(db, async (t) => {
      const s = await t.get(ref(col, id));
      const next = fn(s.exists() ? { ...s.data(), id } : null);
      if (next) t.set(ref(col, id), stamp(col, clean({ ...next, id })));
      return next ? { ...next, id } : null;
    }),
  };
}
