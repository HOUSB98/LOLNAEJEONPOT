// 사이트 오류 알림 · 연동 서버 버전 확인 시험(가짜 Firestore + 가짜 연동 서버)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const W = { ver: '2026-11-26a', reports: [] };
  const mk = async (name, ctx) => {
    const p = await client(b, be, 'WORK', name, ctx ? { ctx } : {});
    await p.route(/workers\.dev/, async (r) => { const u = new URL(r.request().url()); const h = { 'Access-Control-Allow-Origin': 'https://site.test' };
      if (u.pathname === '/') return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify({ ok: true, ver: W.ver }) });
      if (u.pathname === '/report') { W.reports.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, contentType: 'application/json', headers: h, body: '{"ok":true}' }); }
      if (u.pathname === '/live') return r.fulfill({ status: 404, contentType: 'application/json', headers: h, body: '{"error":"not found"}' });
      return r.fulfill({ status: 500, contentType: 'application/json', headers: h, body: '{"error":"시험용 연동 서버"}' }); });
    return p;
  };
  const A = await mk('기기A'); await open(A, 'rank'); await A.waitForTimeout(500);
  const W0 = W.reports.length;
  ok(W0 === 0, '평소 사용: 오류 보고 0건');
  // 1) 사이트 코드(stats.js) 안에서 난 오류
  await A.evaluate(async () => { const m = await import('/js/stats.js'); setTimeout(() => m.compute(null), 0); });
  await A.waitForTimeout(800);
  const r1 = W.reports[0];
  ok(W.reports.length === 1 && r1.file === 'js/stats.js' && r1.line > 0 && r1.kind === 'error' && r1.page === 'rank' && /^\d{8}\w$/.test(r1.v) && /PC · /.test(r1.dev), `우리 코드 오류 → 보고: ${JSON.stringify(r1 && { file: r1.file, line: r1.line, page: r1.page, v: r1.v, dev: r1.dev, msg: r1.msg.slice(0, 50) })}`);
  ok(Object.keys(r1).sort().join() === 'col,dev,file,key,kind,line,msg,page,v' && !JSON.stringify(r1).includes('기기A'), '보내는 값: 오류 정보만(닉네임 없음) · ' + Object.keys(r1).join(','));
  // 같은 오류 다시 → 안 보냄
  await A.evaluate(async () => { const m = await import('/js/stats.js'); setTimeout(() => m.compute(null), 0); }); await A.waitForTimeout(500);
  ok(W.reports.length === 1, '같은 오류 다시: 보내지 않음');
  // 2) 비동기 오류(Promise)
  await A.evaluate(async () => { const m = await import('/js/stats.js'); Promise.resolve().then(() => m.ovrOf(null, 1000)); }); await A.waitForTimeout(600);
  const r2 = W.reports[1];
  ok(r2 && r2.kind === 'promise' && r2.file === 'js/stats.js' && r2.line > 0, `비동기 오류 → 보고(promise, ${r2?.file}:${r2?.line})`);
  // 3) 우리 코드가 아닌 오류 · 무시할 오류
  await A.evaluate(() => { setTimeout(() => { throw new Error('확장 프로그램 오류'); }, 0); setTimeout(() => { throw new Error('ResizeObserver loop limit exceeded'); }, 0); Promise.reject(new TypeError('Failed to fetch')); });
  await A.waitForTimeout(600);
  ok(W.reports.length === 2, `우리 코드가 아닌 오류·연결 끊김·ResizeObserver: 보내지 않음 (${W.reports.length}건)`);
  // 4) 한 탭 3건까지
  await A.evaluate(async () => { const m = await import('/js/stats.js'); for (const f of ['bestDuo', 'evalLineup', 'aiBalance']) setTimeout(() => m[f](undefined, undefined), 0); }); await A.waitForTimeout(800);
  ok(W.reports.length === 3, `오류가 더 나도 한 탭에서 3건까지 (${W.reports.length}건)`);
  // 5) 새로고침해도 같은 오류는 오늘 다시 안 보냄
  await A.reload(); await A.waitForFunction(() => window.NP_OK && (document.getElementById('main').innerText || '').length > 50); await A.waitForTimeout(800);
  await A.evaluate(async () => { const m = await import('/js/stats.js'); setTimeout(() => m.compute(null), 0); }); await A.waitForTimeout(600);
  ok(W.reports.length === 3, '새로고침 뒤 같은 오류: 오늘은 다시 안 보냄');
  // 6) 관리 화면 버전 표시
  await A.evaluate(() => (location.hash = '#/admin/server')); await A.waitForTimeout(1200);
  const v1 = await A.evaluate(() => document.querySelector('.wk-ver')?.innerText);
  ok(/연동 서버 최신 버전 \(2026-11-26a\)/.test(v1 || ''), '같은 버전: ' + v1);
  W.ver = '2026-11-17a';
  const B = await mk('기기B'); await open(B, 'admin'); await B.waitForTimeout(1500);
  ok(await B.evaluate(() => document.querySelector('.adm-tabs .on')?.dataset.t === 'players' && !!document.querySelector('[data-t=server] .adm-dot') && !document.querySelector('.wk-ver')), '옛 버전: 다른 탭에 있어도 서버 탭에 빨간 점');
  await B.evaluate(() => document.querySelector('[data-a=admTab][data-t=server]').click()); await B.waitForTimeout(600);
  const v2 = await B.evaluate(() => document.querySelector('.wk-ver')?.innerText.replace(/\s+/g, ' '));
  ok(/옛 버전이에요/.test(v2 || '') && /2026-11-17a/.test(v2) && /2026-11-26a/.test(v2) && /Deploy/.test(v2), '옛 버전: ' + (v2 || '').slice(0, 120));
  W.ver = '';
  await B.evaluate(() => document.querySelector('[data-a=wkVer]').click()); await B.waitForTimeout(800);
  const v3 = await B.evaluate(() => document.querySelector('.wk-ver')?.innerText.replace(/\s+/g, ' '));
  ok(/알 수 없음\(아주 옛 버전\)/.test(v3 || ''), '버전 정보가 없는 옛 Worker: ' + (v3 || '').slice(0, 80));
  W.ver = '2026-11-26a'; await B.evaluate(() => document.querySelector('[data-a=wkVer]').click()); await B.waitForTimeout(800);
  ok(/최신 버전/.test(await B.evaluate(() => document.querySelector('.wk-ver')?.innerText)) && !(await B.$('[data-t=server] .adm-dot')), '다시 배포 후 "다시 확인": 최신 버전, 빨간 점 사라짐');
  // 8) 체험 모드에서는 보내지 않음
  const C = await mk('체험'); await C.goto('https://site.test/?demo#/rank'); await C.waitForFunction(() => window.NP_OK); await C.waitForTimeout(800);
  const n0 = W.reports.length; await C.evaluate(async () => { const m = await import('/js/stats.js'); setTimeout(() => m.compute(null), 0); }); await C.waitForTimeout(600);
  ok(W.reports.length === n0, '체험 모드: 보내지 않음');
  console.log('페이지 오류(시험으로 일부러 낸 것 제외):', [B].flatMap((p) => p.errs).join(' | ') || '없음');
  await b.close();
})();
