// 브라우저용 가짜 Firestore SDK(store.js가 쓰는 함수만). 실제 데이터와 읽기·쓰기 집계는 Node 쪽 백엔드(backend.js)가 맡는다.
// window.__fs(op, args) → 백엔드 호출, 백엔드는 window.__fsPush(lid, snap) 로 실시간 변경을 보낸다.
export class Timestamp { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } static fromMillis(ms) { return new Timestamp(ms); } }
const SERVER_TS = { __serverTs: 1 };
export const serverTimestamp = () => SERVER_TS;
const enc = (v) => (v === SERVER_TS ? { __serverTs: 1 } : v instanceof Timestamp ? { __ts: v.ms } : Array.isArray(v) ? v.map(enc) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) : v);
const dec = (v) => (v && typeof v === 'object' ? (v.__ts !== undefined ? new Timestamp(v.__ts) : Array.isArray(v) ? v.map(dec) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]))) : v);
export const initializeApp = () => ({}); export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export const initializeFirestore = () => ({}); export const getFirestore = () => ({});
export const collection = (db, ...p) => ({ kind: 'col', col: p[p.length - 1], cs: [] });
export const doc = (db, ...p) => ({ kind: 'doc', col: p[p.length - 2], id: p[p.length - 1], lg: p[p.length - 3] });
export const where = (f, op, v) => ({ t: 'where', f, op, v: enc(v) });
export const orderBy = (f, d) => ({ t: 'order', f: f && f.__docId ? '__id' : f, d });
export const limit = (n) => ({ t: 'limit', n });
export const startAfter = (v) => ({ t: 'after', v: enc(v) });
export const documentId = () => ({ __docId: 1 });
export const query = (c, ...cs) => ({ ...c, cs: [...(c.cs || []), ...cs] });
const docSnap = (id, d) => ({ id, exists: () => d != null, data: () => (d == null ? undefined : dec(d)), metadata: { fromCache: false, hasPendingWrites: false } });
const qSnap = (docs, changes, fromCache = false) => ({
  metadata: { fromCache, hasPendingWrites: false }, size: docs.length, empty: !docs.length,
  docs: docs.map(([id, d]) => docSnap(id, d)), forEach(f) { docs.forEach(([id, d]) => f(docSnap(id, d))); },
  docChanges: () => changes.map(([type, id, d]) => ({ type, doc: docSnap(id, d) })),
});
const L = {}; let seq = 0; window.__fsL = L; window.__fsLog = [];
window.__fsPush = (lid, s) => { const l = L[lid]; if (!l) return; if (l.kind === 'doc') l.cb(docSnap(s.id, s.d)); else l.cb(qSnap(s.docs, s.changes)); };
const call = (op, a) => window.__fs(op, a);
export function onSnapshot(ref, a, b, c) {
  const cb = typeof a === 'function' ? a : b, err = typeof a === 'function' ? b : c;
  const lid = 'L' + ++seq; L[lid] = { cb, kind: ref.kind };
  window.__fsLog.push('listen ' + lid + ' ' + ref.col); call('listen', { lid, ref }).then((r) => { window.__fsLog.push('got ' + lid + ' ' + !!(r && r.first)); if (r && r.first) window.__fsPush(lid, r.first); }).catch((e) => { window.__fsLog.push('err ' + lid + ' ' + e); err && err(e); });
  return () => { delete L[lid]; call('unlisten', { lid }); };
}
export const setDoc = (ref, d, o) => call('set', { ref, d: enc(d), merge: !!(o && o.merge) });
export const getDoc = async (ref) => { const r = await call('get', { ref }); return docSnap(ref.id, r); };
export const getDocFromServer = getDoc;
export const getDocs = async (q) => { const r = await call('getDocs', { ref: q }); return qSnap(r, []); };
export const getDocsFromCache = async (q) => { const r = await call('getDocsFromCache', { ref: q }); return qSnap(r, [], true); };
export const getCountFromServer = async (q) => { const n = await call('count', { ref: q }); return { data: () => ({ count: n }) }; };
export async function runTransaction(db, fn) {
  for (let i = 0; i < 5; i++) {
    const reads = {}, writes = [];
    const t = { get: async (ref) => { const r = await call('txGet', { ref }); reads[ref.col + '/' + ref.id] = r.v; return docSnap(ref.id, r.d); }, set: (ref, d) => { writes.push({ ref, d: enc(d) }); } };
    const out = await fn(t);
    const ok = await call('txCommit', { reads, writes });
    if (ok) return out;
  }
  throw new Error('transaction failed');
}
// 묶음 쓰기(초대 링크 바꾸기 store.copyTo): 가짜 백엔드는 리그 하나만 다루므로 실제로 쓰지 않고 window.__batch 에 [리그 코드, 컬렉션, id]만 남긴다
export const writeBatch = () => { const w = []; return { set: (ref, d) => w.push([ref.lg, ref.col, ref.id, enc(d)]), commit: async () => { (window.__batch ||= []).push(...w); } }; };
