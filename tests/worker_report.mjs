// Worker 버전(GET /) · 오류 보고(/report) 시험(디스코드·Firestore 가짜)
import fs from 'fs';
import os from 'os'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const dir = os.tmpdir();
fs.writeFileSync(path.join(dir, 'naejeon-wmodr.mjs'), fs.readFileSync(path.join(ROOT, 'worker/worker.js'), 'utf8') + '\nexport { MEM, WORKER_VER };\n');
const env = { LEAGUE_KEY: 'k', DISCORD_WEBHOOK: 'https://discord.test/hook' };
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const db = {}; const sent = []; let fsReads = 0, fsWrites = 0;
const dec = (v) => 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec) : null;
const encv = (x) => typeof x === 'boolean' ? { booleanValue: x } : typeof x === 'number' ? { integerValue: String(x) } : typeof x === 'string' ? { stringValue: x } : x && typeof x === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, encv(v)])) } } : { nullValue: null };
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('discord.test')) { sent.push(JSON.parse(opt.body)); return new Response('{}'); }
  if (url.includes(':commit')) { fsWrites++; for (const w of JSON.parse(opt.body).writes) { const id = w.update.name.split('/documents/')[1].split('/').slice(-2).join('/'); db[id] = dec({ mapValue: { fields: w.update.fields } }); } return new Response('{}'); }
  const m = url.match(/\/documents\/leagues\/k\/(\w+)\/(\w+)\?/); if (m) { fsReads++; const d = db[m[1] + '/' + m[2]]; return d ? new Response(JSON.stringify({ fields: encv(d).mapValue.fields })) : new Response('{}', { status: 404 }); }
  return new Response('{}', { status: 404 });
};
const { default: W, MEM, WORKER_VER } = await import(path.join(dir, 'naejeon-wmodr.mjs'));
const post = async (body, origin = 'https://housb98.github.io') => { const r = await W.fetch(new Request('https://w.test/report', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify({ key: 'k', ...body }) }), env, {}); return { status: r.status, j: await r.json() }; };
// 버전
const g = await W.fetch(new Request('https://w.test/', { headers: { Origin: 'https://housb98.github.io' } }), env, {}); const gj = await g.json();
const hookVer = fs.readFileSync(path.join(ROOT, 'js/hook.js'), 'utf8').match(/WORKER_VER = '([^']+)'/)[1];
ok(gj.ver === WORKER_VER && gj.ver === hookVer && !JSON.stringify(gj).includes('discord.test'), `GET / 버전 ${gj.ver} = 사이트 기대값 ${hookVer} (비밀값은 안 보임)`);
// 첫 오류 → 디스코드 1번
const e1 = { kind: 'error', msg: "Cannot read properties of undefined (reading 'x')", file: 'js/today.js', line: 312, col: 9, page: 'today', v: '20261119u', dev: '휴대폰 · Chrome · Android' };
let r = await post(e1);
ok(r.j.first && r.j.notified && sent.length === 1, `첫 오류: 디스코드 알림 ${sent.length}번`);
const em = sent[0]?.embeds?.[0]; const fv = Object.fromEntries((em?.fields || []).map((f) => [f.name, f.value]));
ok(/사이트 오류/.test(em.title) && em.description.includes("reading 'x'") && fv['위치'] === 'js/today.js:312:9' && fv['화면'] === '오늘의 내전 (#/today)' && fv['기기'] === '휴대폰 · Chrome · Android' && fv['사이트 버전'] === '20261119u', '알림 내용: ' + JSON.stringify(fv));
ok(!JSON.stringify(sent[0]).includes('"k"') && !JSON.stringify(sent[0]).includes('key'), '알림에 리그 키 없음');
// 같은 오류 다른 기기 → 알림 없이 횟수만
r = await post({ ...e1, dev: 'PC · Edge · Windows' }); r = await post(e1);
ok(!r.j.first && r.j.count === 3 && sent.length === 1, `같은 오류 2번 더: 알림 그대로 ${sent.length}번, 횟수 ${r.j.count}`);
ok(fsReads === 3 && fsWrites === 3, `보고 1건당 Firestore 읽기 1·쓰기 1 (지금까지 ${fsReads}·${fsWrites})`);
// 다른 오류 → 새 알림, 비동기 표시
r = await post({ ...e1, kind: 'promise', line: 50, msg: '다른 오류' });
ok(sent.length === 2 && /비동기/.test(sent[1].embeds[0].fields[0].value), '다른 오류: 새 알림(비동기 표시)');
// 잘못된 입력은 버림
r = await post({ ...e1, file: 'https://evil.test/x.js' }); ok(r.j.skip === 'invalid' && sent.length === 2, '사이트 파일이 아닌 곳: 버림');
r = await post({ ...e1, msg: '' }); ok(r.j.skip === 'invalid', '빈 문구: 버림');
r = await post({ ...e1, msg: 'a'.repeat(5000) + '`줄\n바꿈', line: 999 }); ok(sent[sent.length - 1].embeds[0].description.length < 300, '긴 문구는 잘라서 보냄');
// 하루 20개까지
MEM.rep = [];
for (let i = 0; i < 30; i++) { MEM.rep = []; await post({ ...e1, line: 1000 + i, msg: '폭주 ' + i }); }
ok(sent.length === 20 && db['ops/errlog'].sent === 20, `서로 다른 오류 30개: 알림은 하루 ${sent.length}개까지`);
// 1분에 30건 넘게 오면 버림
MEM.rep = []; let busy = 0; for (let i = 0; i < 35; i++) { const x = await post({ ...e1 }); if (x.j.skip === 'busy') busy++; }
ok(busy === 5, `1분에 35건: ${busy}건 버림`);
// 다음 날 초기화
db['ops/errlog'].day = '2000.01.01'; MEM.rep = []; const before = sent.length;
r = await post(e1); ok(r.j.first && sent.length === before + 1 && db['ops/errlog'].sent === 1, '날짜가 바뀌면 같은 오류도 다시 한 번 알림');
// 리그 키·출처 검사
const bad = await W.fetch(new Request('https://w.test/report', { method: 'POST', headers: { Origin: 'https://housb98.github.io' }, body: JSON.stringify({ key: 'zz', ...e1 }) }), env, {}); ok(bad.status === 403, '리그 키 틀림: 403');
r = await post(e1, 'https://evil.test'); ok(r.status === 403, '다른 사이트에서: 403');
