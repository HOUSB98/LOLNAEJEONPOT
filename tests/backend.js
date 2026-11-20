// 시험용 Firestore 백엔드(Node). 여러 브라우저 페이지가 같은 데이터를 공유하고, Firestore 요금 규칙대로 읽기·쓰기를 센다.
//  - 실시간 구독: 처음 = 결과 문서 수(0개여도 1), 그 뒤 결과에 새로 들어오거나 바뀐 문서마다 1 (빠지는 건 0)
//  - get / 트랜잭션 get = 1, 집계(count) = 1, 캐시 읽기 = 0, 쓰기 = 문서마다 1
const fs = require('fs'), path = require('path');
const SDK = fs.readFileSync(path.join(__dirname, 'fake-sdk.js'));
class Backend {
  constructor() { this.db = {}; this.ver = {}; this.listeners = {}; this.cache = {}; this.reads = 0; this.writes = 0; this.byCol = {}; this.log = []; this.now = () => Date.now(); }
  count(kind, col, n, who) { if (!n) return; this[kind] += n; const k = kind + ':' + col; this.byCol[k] = (this.byCol[k] || 0) + n; if (who) { const w = (this.byWho ||= {}); w[who] = (w[who] || 0) + n * (kind === 'reads' ? 1 : 0); } }
  reset() { this.reads = 0; this.writes = 0; this.byCol = {}; this.byWho = {}; }
  seed(col, docs) { this.db[col] ||= {}; for (const d of docs) this.db[col][d.id] = JSON.parse(JSON.stringify(d)); }
  val(x) { return x && typeof x === 'object' && x.__ts !== undefined ? x.__ts : x; }
  run(ref) {
    let docs = Object.entries(this.db[ref.col] || {});
    let order = null;
    for (const c of ref.cs || []) {
      if (c.t === 'where') docs = docs.filter(([, d]) => { const a = this.val(d[c.f]), b = this.val(c.v); if (a === undefined) return false; return c.op === '==' ? a === b : c.op === '>' ? a > b : c.op === '>=' ? a >= b : c.op === '<' ? a < b : false; });
      if (c.t === 'order') order = c;
    }
    if (order) docs.sort((x, y) => { const a = order.f === '__id' ? x[0] : this.val(x[1][order.f]), b = order.f === '__id' ? y[0] : this.val(y[1][order.f]); return (a < b ? -1 : a > b ? 1 : 0) * (order.d === 'desc' ? -1 : 1); });
    const af = (ref.cs || []).find((c) => c.t === 'after');
    if (af && order) docs = docs.filter(([id, d]) => { const a = order.f === '__id' ? id : this.val(d[order.f]), b = this.val(af.v); return order.d === 'desc' ? a < b : a > b; });
    const l = (ref.cs || []).find((c) => c.t === 'limit'); if (l) docs = docs.slice(0, l.n);
    return docs;
  }
  resolve(v, now) { return v && typeof v === 'object' ? (v.__serverTs ? { __ts: now } : Array.isArray(v) ? v.map((x) => this.resolve(x, now)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this.resolve(x, now)]))) : v; }
  write(col, id, d, merge, who) {
    const now = this.now(), c = (this.db[col] ||= {}), r = this.resolve(d, now);
    const before = this.snapshotSets(col);
    if (merge && c[id]) { const deep = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && v.__ts === undefined && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? deep({ ...a[k] }, v) : v; return a; }; c[id] = deep({ ...c[id] }, r); }
    else c[id] = r;
    this.ver[col + '/' + id] = (this.ver[col + '/' + id] || 0) + 1;
    this.count('writes', col, 1);
    this.log.push({ t: now, op: 'write', col, id, who });
    this.notify(col, id, before);
  }
  snapshotSets(col) { const m = {}; for (const [lid, l] of Object.entries(this.listeners)) if (l.ref.col === col) m[lid] = l.kind === 'doc' ? null : new Set(this.run(l.ref).map(([id]) => id)); return m; }
  async notify(col, id, before) {
    for (const [lid, l] of Object.entries(this.listeners)) {
      if (l.ref.col !== col) continue;
      if (l.kind === 'doc') { if (l.ref.id !== id) continue; this.count('reads', col, 1, l.who); this.push(l, lid, { id, d: this.db[col][id] ?? null }); continue; }
      const now = this.run(l.ref), had = before[lid] || new Set(), has = new Set(now.map(([i]) => i));
      const changes = [];
      if (has.has(id)) changes.push([had.has(id) ? 'modified' : 'added', id, this.db[col][id]]);
      for (const x of had) if (!has.has(x)) changes.push(['removed', x, null]);
      for (const x of has) if (!had.has(x) && x !== id) changes.push(['added', x, this.db[col][x]]);
      if (!changes.length) continue;
      this.count('reads', col, changes.filter((c) => c[0] !== 'removed').length, l.who);
      this.remember(l.who, col, changes.filter((c) => c[0] !== 'removed').map((c) => [c[1], c[2]]));
      this.push(l, lid, { docs: now, changes });
    }
  }
  push(l, lid, s) { l.page.evaluate(([lid, s]) => window.__fsPush && window.__fsPush(lid, s), [l.plid, s]).catch(() => {}); }
  async attach(ctx, who) {
    const self = this;
    await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({ body: SDK, contentType: 'text/javascript' }));
    // 탭 닫기 표시(bye)는 REST PATCH 로 온다
    await ctx.route('https://firestore.googleapis.com/**', async (r) => {
      const req = r.request(), u = new URL(req.url()), m = u.pathname.match(/documents\/leagues\/[^/]+\/([^/]+)\/([^/]+)$/);
      if (m && req.method() === 'PATCH') { const f = JSON.parse(req.postData() || '{}').fields || {}; const part = {}; for (const [k, v] of Object.entries(f)) part[k] = v.integerValue !== undefined ? +v.integerValue : v.stringValue; self.write(m[1], m[2], part, true, who()); }
      r.fulfill({ status: 200, body: '{}', contentType: 'application/json' });
    });
    await ctx.exposeBinding('__fs', async (src, op, a) => self.op(src.page, who(src.page), op, a));
  }
  op(page, who, op, a) {
    const ref = a.ref; if (a.lid) { a.plid = a.lid; a.lid = (page.__pid ||= Math.random().toString(36).slice(2)) + ':' + a.lid; }
    if (op === 'listen') {
      const kind = ref.kind === 'doc' ? 'doc' : 'q';
      if (!page.__closeHook) { page.__closeHook = true; page.on('close', () => { for (const [k, l] of Object.entries(this.listeners)) if (l.page === page) delete this.listeners[k]; }); } // 탭을 닫으면 구독도 끝
      this.listeners[a.lid] = { page, ref, kind, who, plid: a.plid };
      // 첫 결과는 따로 밀어 넣지 않고 이 요청의 응답으로 돌려준다(밀어 넣기는 가끔 사라져 시험이 들쭉날쭉했음)
      if (kind === 'doc') { this.count('reads', ref.col, 1, who); return { first: { id: ref.id, d: this.db[ref.col]?.[ref.id] ?? null } }; }
      const docs = this.run(ref); this.count('reads', ref.col, Math.max(1, docs.length), who); this.remember(who, ref.col, docs);
      return { first: { docs, changes: docs.map(([id, d]) => ['added', id, d]) } };
    }
    if (op === 'unlisten') { delete this.listeners[a.lid]; return true; }
    if (op === 'set') { this.write(ref.col, ref.id, a.d, a.merge, who); return true; }
    if (op === 'get') { this.count('reads', ref.col, 1, who); return this.db[ref.col]?.[ref.id] ?? null; }
    if (op === 'getDocs') { const docs = this.run(ref); this.count('reads', ref.col, Math.max(1, docs.length), who); return docs; }
    if (op === 'getDocsFromCache') { const c = (this.cache[who] || {})[ref.col] || {}; return Object.entries(c); }
    if (op === 'count') { this.count('reads', ref.col, 1, who); return this.run(ref).length; }
    if (op === 'txGet') { this.count('reads', ref.col, 1, who); const k = ref.col + '/' + ref.id; return { d: this.db[ref.col]?.[ref.id] ?? null, v: this.ver[k] || 0 }; }
    if (op === 'txCommit') {
      for (const [k, v] of Object.entries(a.reads)) if ((this.ver[k] || 0) !== v) return false;
      for (const w of a.writes) this.write(w.ref.col, w.ref.id, w.d, false, who);
      return true;
    }
    throw new Error('unknown op ' + op);
  }
  remember(who, col, docs) { const c = ((this.cache[who] ||= {})[col] ||= {}); for (const [id, d] of docs) c[id] = d; }
}
module.exports = { Backend };
