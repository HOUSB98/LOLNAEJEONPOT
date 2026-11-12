// 데이터 계층: Firebase(Firestore) 또는 체험 모드(localStorage). 두 구현이 같은 API를 가진다.
//   store.data[col]  : { id: doc }      (실시간 반영)
//   put / patch / tx : 쓰기. 삭제는 없다(문서에 deleted:true 를 표시하는 방식).
import { FIREBASE_CONFIG } from './config.js';

const WATCHED = ['players', 'matches', 'auctions', 'meta'];
const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore는 undefined를 받지 않는다
const FB ='https://www.gstatic.com/firebasejs/10.12.5/';

export async function createStore(key, onChange) {
  return FIREBASE_CONFIG ? firebaseStore(key, onChange) : localStore(key, onChange);
}

function localStore(key, onChange) {
  const k = (col) => `naejeon:${key}:${col}`;
  const load = (col) => { try { return JSON.parse(localStorage.getItem(k(col))) || {}; } catch { return {}; } };
  const data = {};
  WATCHED.concat('history').forEach((c) => (data[c] = load(c)));
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('naejeon:' + key) : null;
  if (bc) bc.onmessage = (e) => { data[e.data] = load(e.data); onChange(e.data); };
  const save = (col) => {
    localStorage.setItem(k(col), JSON.stringify(data[col]));
    if (bc) bc.postMessage(col);
    onChange(col);
  };
  return {
    mode: 'local', data, ready: Promise.resolve(),
    async put(col, id, doc) { data[col][id] = { ...doc, id }; save(col); },
    async patch(col, id, part) { data[col][id] = { ...(data[col][id] || { id }), ...part }; save(col); },
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
  const db = fs.getFirestore(initializeApp(FIREBASE_CONFIG));
  const ref = (col, id) => fs.doc(db, 'leagues', key, col, id);
  const data = { history: {} };
  let pending = WATCHED.length, done;
  const ready = new Promise((r) => (done = r));
  const seen = {};
  WATCHED.forEach((col) => {
    data[col] = {};
    fs.onSnapshot(fs.collection(db, 'leagues', key, col), (snap) => {
      const m = {};
      snap.forEach((d) => (m[d.id] = { ...d.data(), id: d.id }));
      data[col] = m;
      if (!seen[col]) { seen[col] = 1; if (--pending === 0) done(); }
      onChange(col);
    }, (err) => { console.error(err); if (!seen[col]) { seen[col] = 1; if (--pending === 0) done(); } onChange('error', err); });
  });
  return {
    mode: 'firebase', data, ready,
    put: (col, id, doc) => fs.setDoc(ref(col, id), clean({ ...doc, id })),
    patch: (col, id, part) => fs.setDoc(ref(col, id), clean(part), { merge: true }),
    tx: (col, id, fn) => fs.runTransaction(db, async (t) => {
      const s = await t.get(ref(col, id));
      const next = fn(s.exists() ? { ...s.data(), id } : null);
      if (next) t.set(ref(col, id), clean({ ...next, id }));
      return !!next;
    }),
  };
}
