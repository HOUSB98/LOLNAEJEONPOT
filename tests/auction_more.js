// 경매 보완 2차: 진행 중 매물 스카우팅(순위·최근·주라인·모스트·팀 궁합), 입찰 경쟁 기록, 패스(모두 패스하면 바로 낙찰/유찰),
// 대기 중 일시정지→재개 시 남은 대기 유지, 입찰 중 표시·두 번 누르기 방지, 마감 3·2·1 소리, 시계 미리 맞추기, 연결 끊김 띠,
// 바뀐 구역만 다시 그리기(입찰해도 선수 정보·타이머 요소는 그대로), 결과 요약(최고가·가성비·평균 OVR)
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  seed.auctions = [];
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const spy = () => { window.__snd = 0; const C = window.AudioContext || window.webkitAudioContext; if (C) { const o = C.prototype.createOscillator; C.prototype.createOscillator = function () { window.__snd++; return o.call(this); }; } navigator.vibrate = () => true; };
  const mk = async (n) => { const p = await client(b, be, 'WORK', n); await p.addInitScript(spy); await p.setViewportSize({ width: 1280, height: 900 }); await open(p, 'home', 600); return p; };
  const H = await mk('H'), C1 = await mk('C1'), C2 = await mk('C2');
  const P = await H.evaluate(async () => (await import('/js/core.js')).S.st.list.slice(0, 12).map((s) => s.id));
  const now = () => H.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.syncServerClock(true); return S.store.serverNow(); });
  const put = (r) => H.evaluate(async (r) => { const { S } = await import('/js/core.js'); await S.store.put('auctions', r.id, r); }, r);
  const R = (id) => be.db.auctions[id];
  const base = (id, t, cur, extra = {}) => ({ id, name: id, createdAt: t, status: 'running', host: 'hx', cfg: { points: 1000, unit: 10, sec: 30, ext: 5, delay: 10, size: 5, hide: true, mode: 'live' },
    teams: [{ name: 'A팀', captain: P[0], token: 'ta', points: 1000, members: [{ pid: P[4], price: 50 }] }, { name: 'B팀', captain: P[1], token: 'tb', points: 1000, members: [] }],
    pool: P.slice(6, 9), unsold: [], round: 1, cur, log: [], chat: [], ...extra });
  let t = await now();
  await put(base('m1', t, { pid: P[3], bid: 0, team: -1, startsAt: t - 1000, endsAt: t + 30000 }));
  await H.evaluate(() => (location.hash = '#/auction/m1/hx')); await C1.evaluate(() => (location.hash = '#/auction/m1/ta')); await C2.evaluate(() => (location.hash = '#/auction/m1/tb'));
  await H.waitForTimeout(1500);
  // 스카우팅
  const sc = await C1.evaluate(() => { const e = document.querySelector('.au-scout'); return e ? { txt: e.innerText, chem: e.querySelectorAll('.as-chem span').length } : null; });
  ok(sc && /OVR \d+위/.test(sc.txt) && /MMR/.test(sc.txt) && /주라인/.test(sc.txt) && sc.chem === 2, '진행 중 매물: 순위·MMR·최근·주라인 + 팀별 궁합 2개');
  // 바뀐 구역만: 입찰 전후 같은 요소인지
  await C2.evaluate(() => { window.__info = document.querySelector('[data-k=info]'); window.__timer = document.getElementById('au-timer'); window.__q = document.querySelector('[data-k=queue]'); window.__bn = document.querySelector('[data-k=bidnow]'); });
  // 입찰 중 표시 + 두 번 누르기 방지
  await C1.evaluate(() => { const b = document.querySelector('[data-a=auBid]:not([data-v=amt])'); b.click(); window.__pend = !!document.querySelector('.bidbar.pending .sending'); b.click(); });
  await C1.waitForTimeout(1200);
  ok(await C1.evaluate(() => window.__pend), '누르는 순간 "입찰 중…" 표시');
  ok(R('m1').cur.bid === 10 && R('m1').log.filter((l) => /A팀 10P/.test(l.s)).length === 1, '빠르게 두 번 눌러도 입찰 한 번');
  ok(!(await C1.$('.bidbar.pending')), '응답 뒤 입찰 중 표시 해제');
  const same = await C2.evaluate(() => ({ info: window.__info === document.querySelector('[data-k=info]'), timer: window.__timer === document.getElementById('au-timer'), q: window.__q === document.querySelector('[data-k=queue]'), bn: window.__bn !== document.querySelector('[data-k=bidnow]'), amt: document.querySelector('[data-k=bidnow] b').textContent }));
  ok(same.info && same.timer && same.q, '입찰해도 선수 정보·타이머·대기 매물 구역은 그대로(다시 그리지 않음)');
  ok(same.bn && same.amt === '10P', '현재 입찰 구역만 새로: ' + same.amt);
  // 입찰 경쟁 기록
  await C2.click('[data-a=auBid]:not([data-v=amt])'); await C2.waitForTimeout(900);
  ok(/A팀 10P/.test(await H.$eval('[data-k=ladder]', (e) => e.innerText)), '입찰 경쟁: 직전 입찰(A팀 10P)이 아래에 보임');
  // 패스: 최고 입찰 B팀 외 남은 팀(A)이 패스 → 바로 낙찰
  const pid = R('m1').cur.pid;
  ok(!!(await C1.$('[data-a=auPass]')) && !(await C2.$('[data-a=auPass]')), '패스 버튼: 최고 입찰 팀이 아닐 때만');
  await C1.click('[data-a=auPass]'); await C1.waitForTimeout(1200);
  ok(R('m1').teams[1].members.some((m) => m.pid === pid) && R('m1').cur?.pid !== pid, '나머지 팀이 모두 패스 → 시간 전에 바로 낙찰');
  ok(R('m1').log.some((l) => /모두 패스 · 바로 낙찰/.test(l.s)), '기록: 모두 패스 · 바로 낙찰');
  // 다음 매물(대기 10초): 아무도 입찰 안 했는데 둘 다 패스 → 유찰
  await H.click('[data-a=auNow]'); await H.waitForTimeout(900);
  const p2 = R('m1').cur.pid;
  await C1.click('[data-a=auPass]'); await C1.waitForTimeout(700);
  ok(R('m1').cur.pid === p2 && R('m1').cur.pass?.[0], '한 팀만 패스하면 계속 진행(팀 카드에 패스 표시)');
  ok(!!(await H.$('[data-k=team0] .au-ps')), '팀 카드에 패스 표시');
  await C2.click('[data-a=auPass]'); await C2.waitForTimeout(1200);
  ok(R('m1').unsold.includes(p2), '입찰 없이 모두 패스 → 바로 유찰');
  // 패스 후 누가 더 부르면 패스 풀림
  await H.click('[data-a=auNow]'); await H.waitForTimeout(900);
  await C1.click('[data-a=auPass]'); await C1.waitForTimeout(600); await C1.click('[data-a=auBid]:not([data-v=amt])').catch(() => {}); await C1.waitForTimeout(800);
  ok(Object.keys(R('m1').cur.pass || {}).length === 0 && R('m1').cur.team === 0, '패스했던 팀도 입찰 가능, 입찰하면 패스 초기화');
  // 마감 3·2·1 소리(팀장만)
  t = await now();
  await H.evaluate(async (t) => { const { S } = await import('/js/core.js'); await S.store.tx('auctions', 'm1', (r) => { r.cur.endsAt = t + 3600; return r; }); }, t);
  const s1 = await C2.evaluate(() => window.__snd), sh = await H.evaluate(() => window.__snd);
  await C2.waitForTimeout(3300);
  ok((await C2.evaluate(() => window.__snd)) - s1 >= 3, '마감 3·2·1 짧은 소리(팀장): ' + ((await C2.evaluate(() => window.__snd)) - s1));
  ok((await H.evaluate(() => window.__snd)) - sh <= 2, '진행자는 3·2·1 소리 없음(낙찰음만)');
  await H.waitForTimeout(1500);
  // 대기 중 일시정지 → 재개: 남은 대기 유지
  t = await now();
  await put(base('m2', t, { pid: P[3], bid: 0, team: -1, startsAt: t + 9000, endsAt: t + 39000 }));
  await H.evaluate(() => (location.hash = '#/auction/m2/hx')); await H.waitForTimeout(1200);
  await H.click('[data-a=auPause]'); await H.waitForTimeout(2500); await H.click('[data-a=auPause]'); await H.waitForTimeout(600);
  t = await now(); const c2 = R('m2').cur;
  ok(R('m2').status === 'running' && c2.startsAt - t > 5000 && c2.endsAt - c2.startsAt > 29000 && c2.endsAt - c2.startsAt < 31000 && c2.wait === undefined, `대기 중 일시정지 → 재개: 남은 대기 ${((c2.startsAt - t) / 1000).toFixed(1)}초부터 이어서(경매 30초 그대로)`);
  // 시계 미리 맞추기: 경매 화면에 있으면 4분마다(시계 쓰기 1번)
  const w0 = be.byCol['writes:clock'] || 0;
  const syncs = await H.evaluate(async () => { const { S } = await import('/js/core.js'); let n = 0; const o = S.store.syncServerClock; S.store.syncServerClock = (f) => { if (f) n++; return o(f); }; const t0 = Date.now(); Date.now = ((d) => () => d() + 5 * 60e3)(Date.now); await new Promise((r) => setTimeout(r, 700)); return n; });
  ok(syncs >= 1, '경매 화면에서 4분이 지나면 뒤에서 시계 미리 맞춤(입찰이 기다리지 않게)');
  // 연결 끊김 띠
  await C1.evaluate(() => (location.hash = '#/auction/m2/ta')); await C1.waitForTimeout(1000);
  await C1.context().setOffline(true); await C1.waitForTimeout(700);
  ok(await C1.evaluate(() => { const e = document.querySelector('.au-off'); return e && !e.hidden && document.querySelector('.bidbar.offline'); }), '연결 끊기면 "연결이 끊겼어요" 띠 + 입찰 버튼 막힘');
  await C1.context().setOffline(false); await C1.waitForTimeout(700);
  ok(await C1.evaluate(() => document.querySelector('.au-off').hidden && !document.querySelector('.bidbar.offline')), '다시 연결되면 띠 사라짐');
  // 결과 요약
  await put({ ...base('m3', t, null), status: 'done', teams: [{ name: 'A팀', captain: P[0], token: 'ta', points: 600, members: [{ pid: P[2], price: 300 }, { pid: P[3], price: 20 }, { pid: P[4], price: 80 }] }, { name: 'B팀', captain: P[1], token: 'tb', points: 900, members: [{ pid: P[5], price: 100 }, { pid: P[6], price: 0 }] }] });
  await H.evaluate(() => (location.hash = '#/auction/m3/hx')); await H.waitForTimeout(1000);
  const st = await H.$eval('.au-stats', (e) => e.innerText).catch(() => '');
  ok(/최고가/.test(st) && /300P/.test(st) && /평균 OVR/.test(st), '완료 화면 요약: 최고가 300P·팀별 평균 OVR');
  const txt = await H.evaluate(async () => (await import('/js/auction.js')).resultText((await import('/js/core.js')).S.store.data.auctions.m3));
  ok(/💰 최고가: .+ 300P/.test(txt) && /평균 OVR/.test(txt), '결과 복사 글에도 최고가·가성비·평균 OVR');
  const errs = [...H.errs, ...C1.errs, ...C2.errs].filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to fetch|offline/i.test(e));
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
