// 실시간 경매를 처음부터 끝까지 직접 돌려 본다: 진행자가 방을 만들고(대기 5초·경매 5초), 팀장 2명이 각자 기기에서 번갈아 입찰,
// 관전자 1명. 확인: 바로 시작, 입찰 실패 이유, 밀림 소리·진동, 낙찰 연출, 직전 낙찰 취소(포인트 환불·재경매), 기록창 스크롤 유지, 완료·라인업
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const NOTE = (m) => console.log('  · ' + m);
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  seed.auctions = [];
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const spy = () => { window.__snd = 0; window.__vib = 0; const C = window.AudioContext || window.webkitAudioContext; if (C) { const o = C.prototype.createOscillator; C.prototype.createOscillator = function () { window.__snd++; return o.call(this); }; } navigator.vibrate = () => { window.__vib++; return true; }; };
  const mk = async (n) => { const p = await client(b, be, 'WORK', n); await p.addInitScript(spy); await p.addInitScript(() => localStorage.setItem('naejeon:lite', '0')); await p.setViewportSize({ width: 1280, height: 900 }); await open(p, 'home', 600); return p; };
  const H = await mk('H');
  const toasts = (p) => p.evaluate(() => [...document.querySelectorAll('.toast, #toast, .toasts > *')].map((e) => e.textContent).join(' | '));
  // 방 만들기(진행자 화면에서 직접)
  await H.evaluate(() => (location.hash = '#/auction')); await H.waitForTimeout(800);
  const ids = await H.evaluate(async () => { const { S } = await import('/js/core.js'); return S.st.list.slice(0, 10).map((s) => s.id); });
  for (const id of ids.slice(0, 2)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="2"]`);
  for (const id of ids.slice(2, 10)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="1"]`);
  await H.waitForTimeout(400); // 이름을 누른 뒤 화면이 다시 그려지는 동안 입력하지 않게(사람은 이렇게 빠르지 않음)
  await H.fill('#auS', '5'); await H.fill('#auE', '3'); await H.selectOption('#auD', '5');
  ok(await H.$('#auD') !== null, '방 만들기: 매물 사이 대기 선택(5/10/15초)');
  await H.click('[data-a=auCreate]'); await H.waitForTimeout(1200);
  const rid = await H.evaluate(() => location.hash.split('/')[2]);
  const R = () => be.db.auctions[rid];
  ok(R()?.cfg.delay === 5 && R().cfg.sec === 5, `방 생성: 대기 ${R()?.cfg.delay}초 · 경매 ${R()?.cfg.sec}초`);
  const base = `#/auction/${rid}`, [t0, t1] = R().teams.map((t) => t.token);
  const C1 = await mk('C1'), C2 = await mk('C2'), V = await mk('V');
  await C1.evaluate((h) => (location.hash = h), `${base}/${t0}`); await C2.evaluate((h) => (location.hash = h), `${base}/${t1}`); await V.evaluate((h) => (location.hash = h), base);
  await H.waitForTimeout(2500);
  await H.click('[data-a=auStart]'); await H.waitForTimeout(1500);
  ok(R().status === 'running' && R().cur, '경매 시작');
  // 바로 시작
  const s0 = R().cur.startsAt;
  ok(!!(await H.$('[data-a=auNow]')), '대기 중 진행자에게 ⏩ 바로 시작 버튼');
  await H.click('[data-a=auNow]'); await H.waitForTimeout(800);
  ok(R().cur.startsAt < s0 - 2000, '바로 시작: 대기 건너뜀');
  // 입찰 실패 이유: C2가 화면 갱신 전 같은 금액을 누르는 상황 재현(C1이 먼저 +10, C2 화면은 아직 0P 기준)
  await C2.evaluate(() => { window.__hold = document.querySelector('[data-a=auBid]:not([data-v=amt])')?.dataset.v; });
  await C1.click('[data-a=auBid]:not([data-v=amt])'); await C1.waitForTimeout(150);
  const stale = await C2.evaluate(async (v) => { const { S } = await import('/js/core.js'); return v; }, null);
  await C2.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'auBid'; b.dataset.id = location.hash.split('/')[2]; b.dataset.v = window.__hold; document.body.appendChild(b); b.click(); b.remove(); });
  await C2.waitForTimeout(900);
  const tmsg = await toasts(C2);
  ok(/먼저/.test(tmsg) && /다음 최소/.test(tmsg), '늦은 입찰은 이유와 다음 최소 금액 안내: ' + tmsg.slice(0, 80));
  // C2 정상 입찰 → C1은 밀림 소리·진동
  const snd0 = await C1.evaluate(() => [window.__snd, window.__vib]);
  await C2.click('[data-a=auBid]:not([data-v=amt])'); await C2.waitForTimeout(900);
  const snd1 = await C1.evaluate(() => [window.__snd, window.__vib]);
  ok(snd1[1] > snd0[1] && snd1[0] > snd0[0], `C1: 내 입찰이 밀리면 소리(${snd1[0] - snd0[0]})·진동(${snd1[1] - snd0[1]})`);
  ok((await V.evaluate(() => window.__vib)) === 0, '관전자는 진동 없음');
  // 기록창을 위로 올려 둔 관전자 화면이 새 기록에 튀지 않는지
  await V.evaluate(() => { const c = document.getElementById('au-chat'); c.scrollTop = 0; c.dispatchEvent(new Event('scroll')); });
  // 낙찰까지 기다림
  const pid1 = R().cur.pid; const tEnd = Date.now() + 20000;
  while (Date.now() < tEnd && R().cur?.pid === pid1) await H.waitForTimeout(150);
  await H.waitForTimeout(400);
  const won = R().teams.findIndex((t) => t.members.some((m) => m.pid === pid1));
  ok(won === 1, '첫 매물 낙찰 → C2 팀');
  const vTop = await V.evaluate(() => document.getElementById('au-chat').scrollTop);
  ok(vTop < 5, '관전자가 위로 올려 둔 기록창은 새 기록이 와도 그 자리 유지: ' + vTop);
  const fx = await C2.evaluate(() => ({ sold: !!document.querySelector('.ateam .kv.au-sold'), win: !!document.querySelector('.ateam.au-win'), snd: window.__snd, vib: window.__vib }));
  ok(fx.sold && fx.win, '낙찰 연출: 낙찰 팀 카드 빛 + 들어온 선수 줄');
  ok(fx.vib >= 1, 'C2: 내 팀 낙찰 진동');
  // 직전 낙찰 취소
  const pts = R().teams[1].points;
  ok(!!(await H.$('[data-a=auUndo]')), '진행자에게 ↩ 직전 낙찰 취소 버튼');
  H.once('dialog', (d) => d.accept()); await H.click('[data-a=auUndo]'); await H.waitForTimeout(1200);
  ok(R().cur?.pid === pid1 && R().teams[1].points > pts && !R().teams[1].members.some((m) => m.pid === pid1), `되돌리기: ${pid1} 다시 경매, 포인트 환불(${pts} → ${R().teams[1].points})`);
  ok(R().log.some((l) => /직전 낙찰을 취소/.test(l.s)), '기록에 취소 남음');
  const all = () => [R().cur?.pid, ...R().pool, ...R().unsold, ...R().teams.flatMap((t) => t.members.map((m) => m.pid))].filter(Boolean);
  ok(all().length === 8 && new Set(all()).size === 8, `되돌린 뒤 선수 중복·누락 없음(${all().length}명)`);
  ok(!(await C1.$('[data-a=auUndo]')) && !(await V.$('[data-a=auUndo]')), '팀장·관전자에게는 취소 버튼 없음');
  // 나머지는 자동으로 진행(바로 시작 + 번갈아 입찰)하며 끝까지
  let lots = 0, guard = Date.now() + 150000, lastPid = '';
  while (Date.now() < guard && R().status !== 'done') {
    const c = R().cur; if (!c) { await H.waitForTimeout(200); continue; }
    if (c.pid !== lastPid) { lastPid = c.pid; lots++; await H.click('[data-a=auNow]').catch(() => {}); await H.waitForTimeout(500);
      const who = lots % 3 === 0 ? null : lots % 2 ? C1 : C2; // 세 번째마다는 아무도 입찰 안 함(유찰)
      if (who) await who.click('[data-a=auBid]:not([data-v=amt]):not([disabled])').catch(() => {});
    }
    await H.waitForTimeout(300);
  }
  ok(R().status === 'done', `경매 완료 (매물 ${lots}번 진행)`); await H.waitForTimeout(600);
  const final = R().teams.map((t) => `${t.name} ${t.members.length}명 ${t.points}P`);
  NOTE('결과: ' + final.join(' / ') + (R().unsold.length ? ` · 예비 ${R().unsold.length}` : ''));
  ok(R().teams.every((t) => t.members.length === 4) && !R().unsold.length, '두 팀 모두 4명, 예비 없음(유찰은 재경매·자동 배정)');
  const fin = R().teams.flatMap((t) => t.members.map((m) => m.pid)); ok(new Set(fin).size === 8, '최종 선수 중복 없음');
  // 끝난 뒤에도 마지막 낙찰 취소 → 다시 진행 → 다시 완료
  const lastLog = R().undo?.pid;
  if (lastLog) {
    H.once('dialog', (d) => d.accept()); await H.click('[data-a=auUndo]'); await H.waitForTimeout(1200);
    ok(R().status === 'running' && R().cur?.pid === lastLog && R().teams.reduce((a, t) => a + t.members.length, 0) < 8, '완료 후 마지막 낙찰 취소 → 경매 다시 진행');
    await H.click('[data-a=auNow]').catch(() => {}); const g2 = Date.now() + 20000;
    while (Date.now() < g2 && R().status !== 'done') await H.waitForTimeout(200);
    ok(R().status === 'done' && R().teams.every((t) => t.members.length === 4), '다시 완료(유찰된 선수는 자리 남은 팀에 자동 배정)');
  } else ok(false, '완료 후 취소할 기록이 없음');
  ok(!!(await H.waitForSelector('[data-a=auToDraft]', { timeout: 5000 }).catch(() => null)), '완료 화면: 라인업 채우기');
  await H.click('[data-a=auToDraft]'); await H.waitForTimeout(800);
  ok((await H.evaluate(() => location.hash)) === '#/today', '라인업으로 이동');
  // 팀이 3개인 경매: 블루·레드로 넣을 두 팀을 골라 라인업 채우기
  const P = await H.evaluate(async () => (await import('/js/core.js')).S.st.list.slice(0, 15).map((s) => s.id));
  const team = (k) => ({ name: '팀' + k, captain: P[k * 5], token: 'x' + k, points: 100, members: P.slice(k * 5 + 1, k * 5 + 5).map((pid) => ({ pid, price: 10 })) });
  await H.evaluate(async (r) => { const { S } = await import('/js/core.js'); await S.store.put('auctions', r.id, r); }, { id: 'tri', name: '3팀', createdAt: Date.now(), status: 'done', host: 'hx', cfg: { points: 100, unit: 10, sec: 5, ext: 3, size: 5, hide: false, mode: 'live' }, teams: [0, 1, 2].map(team), pool: [], unsold: [], round: 1, cur: null, log: [], chat: [] });
  await H.evaluate(() => (location.hash = '#/auction/tri/hx')); await H.waitForTimeout(900);
  ok((await H.$$('.au-dl select')).length === 2, '3팀 경매 완료: 블루·레드 팀 고르기');
  await H.selectOption('.au-dl select[data-i="1"]', '2'); await H.click('[data-a=auToDraft]'); await H.waitForTimeout(900);
  const dr = await H.evaluate(async () => { const { S } = await import('/js/core.js'); return S.store.data.meta.todayDraft || JSON.parse(localStorage.getItem('naejeon:draft:' + S.key) || '{}'); });
  ok([P[0], ...P.slice(1, 5)].every((id) => dr.blue?.includes(id)) && [P[10], ...P.slice(11, 15)].every((id) => dr.red?.includes(id)), '고른 팀(1팀 블루·3팀 레드)으로 라인업');
  const errs = [...H.errs, ...C1.errs, ...C2.errs, ...V.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  NOTE('쓰기 ' + be.writes + '회 · 읽기 ' + be.reads + '회 (4기기, 매물 ' + lots + '번)');
  await b.close();
})();
