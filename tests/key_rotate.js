// 초대 링크 새로 만들기(관리 > 설정): 확인 창 취소 = 아무것도 안 함, 확인 = 모든 컬렉션 문서를 새 코드(20자) 아래로 복사(접속 표시 제외) 후
// 옛 리그에 meta/closed → 다른 기기(옛 링크)는 "더 이상 쓰지 않아요" 안내(새 링크는 안 보여 줌), 관리자 화면엔 새 링크·Worker·규칙 안내
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'), B = await client(b, be, 'WORK', 'B');
  await open(B, 'rank', 800);
  await open(A, 'admin', 900); await A.evaluate(async () => { const { S } = await import('/js/core.js'); S.admin = true; document.querySelector('[data-a=admTab][data-t=config]')?.click(); }); await A.waitForTimeout(500);
  ok(!!(await A.$('.panel.rot [data-a=keyRotate]')), '관리 > 설정에 "새 초대 링크 만들기"');
  A.once('dialog', (d) => d.dismiss()); await A.click('[data-a=keyRotate]'); await A.waitForTimeout(500);
  ok(!(await A.evaluate(() => window.__batch?.length)) && !be.db.meta.closed, '확인 창에서 취소하면 아무것도 안 바뀜');
  A.once('dialog', (d) => d.accept()); await A.click('[data-a=keyRotate]'); await A.waitForTimeout(2500);
  const r = await A.evaluate(() => { const bt = window.__batch || [], lg = [...new Set(bt.map((x) => x[0]))], by = {}; bt.forEach((x) => (by[x[1]] = (by[x[1]] || 0) + 1)); return { lg, by, url: document.getElementById('rot-url')?.value, todo: document.querySelector('.rot-todo')?.innerText || '', rule: document.querySelector('.rot-rule')?.innerText || '' }; });
  const want = Object.fromEntries(['players', 'matches', 'meta', 'chat', 'posts'].map((c) => [c, Object.keys(be.db[c] || {}).filter((id) => id !== 'closed').length]));
  ok(r.lg.length === 1 && /^[a-z2-9]{20}$/.test(r.lg[0]), '새 코드 하나(20자)로 복사: ' + r.lg.join());
  ok(Object.entries(want).every(([c, n]) => !n || r.by[c] === n) && !r.by.presence, '선수·경기·설정·채팅·게시판 문서 수가 그대로 복사됨(접속 표시는 제외): ' + JSON.stringify(r.by));
  ok(r.url === `https://site.test/?k=${r.lg[0]}` && /LEAGUE_KEY/.test(r.todo) && r.todo.includes(r.lg[0]) && /key != 'test'/.test(r.rule), '결과 창: 새 링크·Worker LEAGUE_KEY 안내·옛 코드 차단 규칙');
  ok(!!be.db.meta.closed?.at && !JSON.stringify(be.db.meta.closed).includes(r.lg[0]), '옛 리그에 닫힘 표시(새 코드는 넣지 않음)');
  ok(!(await A.$('#np-closed')), '링크를 바꾼 관리자 화면에는 닫힘 안내를 띄우지 않음');
  await B.waitForTimeout(800);
  const bc = await B.evaluate(() => ({ on: !!document.getElementById('np-closed'), t: document.getElementById('np-closed')?.innerText || '' }));
  ok(bc.on && /더 이상 쓰지 않아요/.test(bc.t) && !bc.t.includes('?k='), '옛 링크로 켜 둔 다른 기기: 안내 화면(새 링크는 안 보임)');
  const C = await client(b, be, 'WORK', 'C'); await C.goto('https://site.test/?k=test#/home'); await C.waitForTimeout(3000);
  ok(await C.evaluate(() => !!document.getElementById('np-closed')), '옛 링크로 새로 들어와도 안내 화면');
  const errs = [...A.errs, ...B.errs, ...C.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
