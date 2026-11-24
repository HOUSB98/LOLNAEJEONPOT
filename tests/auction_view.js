// 경매·라인 지원 4차: 경매 화면은 최근 2주 방만 구독(오래된 방은 링크로 들어오면 그 방 하나만, '이전 경매 보기'·백업은 전체),
// 누르는 사이 화면이 다시 그려져도 클릭이 사라지지 않음(PC 마우스), 팀 카드 라인 구성·자리당 포인트, 낙찰·유찰 배너, 남은 시간 막대,
// 휴대폰 라인 추첨 장면(지금 라인 맨 위·나머지 접기)
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const now = Date.now(), ids = seed.players.map((p) => p.id);
  // 최근 방 3개 + 오래된 방 6개(30일 이상 전)
  seed.auctions = Array.from({ length: 9 }, (_, i) => ({ id: 'r' + i, name: (i < 3 ? '최근 ' : '옛날 ') + i, createdAt: now - (i < 3 ? i : 30 + i) * 864e5, status: 'done', host: 'h' + i,
    cfg: { points: 1000, unit: 10, sec: 15, ext: 5, size: 5, hide: false, mode: 'live' },
    teams: [0, 1].map((t) => ({ name: '팀' + t, captain: ids[t], token: 'tk' + t, points: 1000, members: [] })), pool: [], unsold: [], round: 1, cur: null, log: [], chat: [] }));
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const H = await client(b, be, 'WORK', 'H'); await H.setViewportSize({ width: 1280, height: 900 }); await open(H, 'home', 600);
  // 1) 최근 방만 구독
  be.reset();
  await H.evaluate(() => (location.hash = '#/auction')); await H.waitForTimeout(1200);
  const listed = await H.$$eval('.kv.link', (x) => x.map((e) => e.textContent));
  ok(be.byCol['reads:auctions'] === 3, `경매 화면 열기: 최근 2주 방만 읽음(읽기 ${be.byCol['reads:auctions']}, 전체 9개)`);
  ok(listed.length === 3 && listed.every((t) => /최근/.test(t)), '목록에는 최근 방 3개');
  ok(!!(await H.$('[data-a=auOld]')), "'이전 경매 보기' 버튼");
  // 2) 오래된 방 링크 → 그 방 하나만
  be.reset();
  await H.evaluate(() => (location.hash = '#/auction/r7/h7')); await H.waitForTimeout(1200);
  ok(be.byCol['reads:auctions'] === 1, `오래된 방 링크: 그 방 문서 하나만 읽음(읽기 ${be.byCol['reads:auctions']})`);
  ok(/옛날 7/.test(await H.$eval('#main', (e) => e.innerText)) && !/삭제되어/.test(await H.$eval('#main', (e) => e.innerText)), '오래된 방도 정상 표시');
  await H.evaluate(() => (location.hash = '#/auction/nope')); await H.waitForTimeout(1000);
  ok(/삭제되어/.test(await H.$eval('#main', (e) => e.innerText)), '없는 방은 기존처럼 안내');
  // 2-1) 완료된 지난 방: 진행자 링크가 아니어도 '관리자 삭제'(관리자 PIN 확인 후) → 목록에서 사라짐
  await H.evaluate(() => (location.hash = '#/auction/r1')); await H.waitForTimeout(900);
  ok(/관리자 삭제/.test(await H.$eval('[data-a=auDel]', (e) => e.textContent).catch(() => '')), '완료된 방에도 관리자 삭제 버튼(관전자 화면)');
  H.once('dialog', (d) => d.accept());
  await H.click('[data-a=auDel]'); await H.waitForSelector('#pin', { timeout: 3000 });
  await H.fill('#pin', '1234'); await H.press('#pin', 'Enter'); await H.waitForTimeout(1200);
  ok(be.db.auctions.r1.deleted === true && !!be.db.auctions.r1.id, '관리자 PIN 확인 후 완료된 방 삭제(지우지 않고 deleted 표시)');
  ok(!(await H.$$eval('.kv.link', (x) => x.map((e) => e.textContent))).some((t) => /최근 1/.test(t)), '삭제한 방은 목록에서 사라짐');
  // 3) 이전 경매 보기 → 전체
  await H.evaluate(() => (location.hash = '#/auction')); await H.waitForTimeout(600);
  be.reset();
  await H.click('[data-a=auOld]'); await H.waitForTimeout(1200);
  ok(await H.$$eval('.kv.link', (x) => x.length) === 8 && !(await H.$('[data-a=auOld]')), "'이전 경매 보기' → 삭제한 1개 빼고 8개 모두, 버튼 사라짐");
  // 4) 백업은 전체 경매 포함(새 탭에서 최근만 받은 상태로)
  const H2 = await client(b, be, 'WORK', 'H2'); await open(H2, 'home', 600);
  await H2.evaluate(() => (location.hash = '#/auction')); await H2.waitForTimeout(1000);
  const bk = await H2.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.need('auctions', true); return Object.keys(S.store.data.auctions).length; });
  ok(bk === 9, '백업용 전체 받기: 경매 9개 모두');
  await H2.close();

  // 5) 진행 중 경매: 팀 카드·막대·배너
  const P = await H.evaluate(async () => (await import('/js/core.js')).S.st.list.slice(0, 12).map((s) => s.id));
  const lanes = await H.evaluate(async (P) => { const { S } = await import('/js/core.js'); return P.map((id) => S.st.P[id].mainLane); }, P);
  const t = await H.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.syncServerClock(true); return S.store.serverNow(); });
  await H.evaluate(async (r) => { const { S } = await import('/js/core.js'); await S.store.put('auctions', r.id, r); }, {
    id: 'live1', name: 'live1', createdAt: t, status: 'running', host: 'hx', cfg: { points: 1000, unit: 10, sec: 8, ext: 3, delay: 5, size: 5, hide: false, mode: 'live' },
    teams: [{ name: 'A팀', captain: P[0], token: 'ta', points: 900, members: [{ pid: P[4], price: 100 }] }, { name: 'B팀', captain: P[1], token: 'tb', points: 1000, members: [] }],
    pool: [P[6], P[7]], unsold: [], round: 1, cur: { pid: P[3], bid: 0, team: -1, startsAt: t - 500, endsAt: t + 8000 }, log: [], chat: [] });
  const C1 = await client(b, be, 'WORK', 'C1'); await C1.setViewportSize({ width: 1280, height: 900 }); await open(C1, 'home', 400);
  await H.evaluate(() => (location.hash = '#/auction/live1/hx')); await C1.evaluate(() => (location.hash = '#/auction/live1/ta'));
  await H.waitForTimeout(1500);
  const tf = await H.$eval('[data-k=team0] .au-tf', (e) => ({ txt: e.innerText.replace(/\s+/g, ' '), ok: e.querySelectorAll('.au-lanes .ok,.au-lanes .dup').length, no: e.querySelectorAll('.au-lanes .no').length }));
  const want = new Set([lanes[0], lanes[4]]).size;
  ok(tf.ok === want && tf.no === 5 - want, `팀 카드 라인 구성: 있는 라인 ${tf.ok}칸 · 없는 라인 ${tf.no}칸`);
  ok(/남은 3자리 · 자리당 300P/.test(tf.txt) && /없음|다 있음/.test(tf.txt), '자리당 포인트(900P ÷ 3자리 = 300P)·없는 라인: ' + tf.txt);
  const col = await H.evaluate(() => [...document.querySelectorAll('.ateam')].map((e) => getComputedStyle(e).borderTopColor));
  ok(col.length === 2 && col[0] !== col[1] && /91, 140, 255|0\.3568/.test(col[0]) && /240, 80, 110|0\.9411/.test(col[1]), '팀 색: 팀 카드 위쪽 띠가 팀마다 다름(블루·레드): ' + col.join(' / '));
  ok(await H.$$eval('.ateam .au-tname .au-dot', (x) => x.length) === 2, '팀 이름 앞에 팀 색 점');
  const sc1 = await H.$eval('#au-tbar', (e) => +(/scaleX\(([\d.]+)\)/.exec(e.style.transform) || [0, -1])[1]);
  await H.waitForTimeout(1500);
  const sc2 = await H.$eval('#au-tbar', (e) => +(/scaleX\(([\d.]+)\)/.exec(e.style.transform) || [0, -1])[1]);
  ok(sc1 > 0 && sc1 <= 1 && sc2 < sc1, `남은 시간 막대가 줄어듦(${sc1.toFixed(2)} → ${sc2.toFixed(2)})`);
  // 연장 → 막대 다시 차오름: 마감 1초 전 입찰
  await H.evaluate(async () => { const { S } = await import('/js/core.js'); const t = S.store.serverNow(); await S.store.tx('auctions', 'live1', (r) => { r.cur.endsAt = t + 1200; return r; }); });
  await H.waitForTimeout(700);
  const lo = await H.$eval('#au-tbar', (e) => +(/scaleX\(([\d.]+)\)/.exec(e.style.transform) || [0, -1])[1]);
  ok(await H.$eval('.au-tbar', (e) => e.classList.contains('hot')), '마감 임박: 막대 빨간색');
  // 6) 누르는 사이 화면이 다시 그려져도(다른 팀 입찰 아님: 같은 버튼으로 그려짐) 클릭이 사라지지 않음 — 패스 버튼
  await C1.evaluate(() => { window.__b = document.querySelector('[data-a=auPass]'); });
  const pb = await C1.$eval('[data-a=auPass]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await C1.mouse.move(pb.x, pb.y); await C1.mouse.down();
  await H.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.tx('auctions', 'live1', (r) => { r.chat = [...(r.chat || []), { t: Date.now(), w: '진행자', s: '빨리!' }]; r.cur.endsAt += 6000; return r; }); });
  await C1.waitForTimeout(500);
  const replaced = await C1.evaluate(() => !window.__b.isConnected);
  await C1.mouse.up(); await C1.waitForTimeout(900);
  ok(replaced, '(누르는 동안 패스 버튼이 새로 그려짐)');
  ok(!!be.db.auctions.live1.cur?.pass?.[0], '누르는 사이 다시 그려져도 패스가 반영됨');
  ok(lo > 0 && lo < 0.2, `마감 1초 전 막대 ${lo.toFixed(2)}`);
  await H.waitForTimeout(400);
  const hi = await H.$eval('#au-tbar', (e) => +(/scaleX\(([\d.]+)\)/.exec(e.style.transform) || [0, -1])[1]);
  ok(hi > lo + 0.3, `연장되면 막대가 다시 차오름(${lo.toFixed(2)} → ${hi.toFixed(2)})`);
  // 금액이 바뀐 입찰 버튼은 다른 버튼으로 보고 실행하지 않음(뜻하지 않은 금액 입찰 방지)
  const bb = await C1.$eval('[data-a=auBid]:not([data-v=amt]):not([data-v=all])', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, v: e.dataset.v }; });
  await C1.mouse.move(bb.x, bb.y); await C1.mouse.down();
  await H.evaluate(async (tb) => { const { S } = await import('/js/core.js'); await S.store.tx('auctions', 'live1', (r) => { r.cur.bid = 50; r.cur.team = 1; return r; }); }, null);
  await C1.waitForTimeout(500); await C1.mouse.up(); await C1.waitForTimeout(800);
  const bn = await H.$eval('[data-k=bidnow]', (e) => ({ tc: e.style.getPropertyValue('--tc'), tn: e.querySelector('.au-tn')?.textContent }));
  ok(bn.tc === '#f0506e' && bn.tn === 'B팀', `현재 입찰: 최고 입찰 팀 이름·배경이 팀 색(${bn.tn} ${bn.tc})`);
  ok(be.db.auctions.live1.cur.bid === 50 && be.db.auctions.live1.cur.team === 1, `금액이 바뀐 버튼(${bb.v}P → 다른 금액)은 실행 안 함`);
  // 7) 낙찰 배너: B팀 50P 상태로 마감
  await H.evaluate(async () => { const { S } = await import('/js/core.js'); const t = S.store.serverNow(); await S.store.tx('auctions', 'live1', (r) => { r.cur.endsAt = t + 300; return r; }); });
  const ban = await H.waitForSelector('.au-banner', { timeout: 5000 }).then((e) => e.innerText()).catch(() => '');
  const nm3 = await H.evaluate(async (id) => (await import('/js/core.js')).S.st.P[id].name, P[3]);
  ok(/낙찰/.test(ban) && ban.includes(nm3) && /B팀/.test(ban) && /50P/.test(ban), '낙찰 순간 가운데 배너: ' + ban.replace(/\s+/g, ' '));
  ok(await H.$eval('.au-banner', (e) => e.style.getPropertyValue('--tc') === '#f0506e' && !!e.querySelector('.au-tn')), '낙찰 배너: 낙찰 팀 색 띠·이름');
  ok(await H.$eval('.au-banner', (e) => getComputedStyle(e).pointerEvents) === 'none', '배너는 누르는 것을 막지 않음');
  await H.waitForTimeout(2200);
  ok(!(await H.$('.au-banner')), '배너는 잠시 뒤 사라짐');
  // 8) 유찰 배너: 다음 매물을 아무도 안 사고 마감
  await H.evaluate(async () => { const { S } = await import('/js/core.js'); const t = S.store.serverNow(); await S.store.tx('auctions', 'live1', (r) => { r.cur.startsAt = t - 100; r.cur.endsAt = t + 300; return r; }); });
  const ub = await H.waitForSelector('.au-banner.unsold', { timeout: 5000 }).then((e) => e.innerText()).catch(() => '');
  ok(/유찰/.test(ub), '유찰 배너: ' + ub.replace(/\s+/g, ' '));
  const errs = [...H.errs, ...C1.errs];
  await C1.close();

  // 9) 라인 지원: PC 마우스로 카드를 누르는 사이 다른 사람이 골라도 내 선택 반영
  const be2 = new Backend(); const seed2 = await makeSeed(b); for (const [c, d] of Object.entries(seed2)) be2.seed(c, d);
  const A = await client(b, be2, 'WORK', 'A'), B = await client(b, be2, 'WORK', 'B');
  await open(A, 'today', 1000); await open(B, 'today', 1000);
  await A.click('[data-a=tBoard]'); await A.waitForTimeout(500); await A.click('#modal.on [data-a=bdOpen]'); await A.waitForTimeout(1200);
  const bids = be2.db.meta.board.ids;
  await B.waitForSelector('#modal.on .lp');
  await B.click(`#modal.on [data-a=bdMe][data-id="${bids[1]}"]`); await A.click(`#modal.on [data-a=bdMe][data-id="${bids[0]}"]`); await A.waitForTimeout(400);
  const cb = await A.$eval('#modal.on [data-a=bdPick][data-o="jg"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await A.mouse.move(cb.x, cb.y); await A.mouse.down();
  await B.click('#modal.on [data-a=bdPick][data-o="sup"]'); await A.waitForTimeout(700);
  await A.mouse.up(); await A.waitForTimeout(900);
  ok(JSON.stringify(be2.db.meta.board.picks?.[bids[0]]) === '["jg"]', '라인 지원: 누르는 사이 다른 사람이 골라도 내 선택 반영(한 번만)');
  await A.click('#modal.on [data-a=bdPick][data-o="mid"]'); await A.waitForTimeout(700);
  ok(JSON.stringify(be2.db.meta.board.picks?.[bids[0]]) === '["jg","mid"]', '평소 클릭은 그대로(두 번 실행 없음)');
  errs.push(...A.errs, ...B.errs);
  await A.close(); await B.close();

  // 10) 휴대폰 라인 추첨 장면: 지금 추첨하는 라인이 맨 위, 나머지는 접힘
  const be3 = new Backend(); const seed3 = await makeSeed(b); for (const [c, d] of Object.entries(seed3)) be3.seed(c, d);
  const M = await client(b, be3, 'WORK', 'M', { ctx: await device(b, be3, 'WORK', 'M', { viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }) });
  await open(M, 'today', 1000);
  await M.tap('[data-a=tBoard]'); await M.waitForTimeout(500); await M.tap('#modal.on [data-a=bdOpen]'); await M.waitForTimeout(1200);
  const mids = be3.db.meta.board.ids;
  // 10명 모두 탑·미드 1지망으로 몰리게(2라인 추첨)
  await M.evaluate(async (mids) => { const { S } = await import('/js/core.js'); await S.store.tx('meta', 'board', (d) => { d.picks = Object.fromEntries(mids.map((id, i) => [id, [i === 9 ? 'adc' : i % 2 ? 'top' : 'mid']])); return d; }); }, mids);
  M.on('dialog', (d) => d.accept());
  await M.waitForTimeout(500); await M.tap('#modal.on [data-a=bdGo]').catch((e) => console.log('   (강제 마감 못 누름)', e.message.slice(0, 80))); await M.waitForTimeout(300);
  await M.waitForSelector('.lp.drawing .ld-row.on', { timeout: 15000 }).catch(() => {});
  await M.waitForTimeout(600);
  const lay = await M.evaluate(() => { const rows = [...document.querySelectorAll('.ld-row')]; const on = document.querySelector('.ld-row.on'); const top = Math.min(...rows.map((r) => r.getBoundingClientRect().top)); const other = rows.find((r) => r !== on); return { n: rows.length, onTop: on && on.getBoundingClientRect().top === top, otherH: other?.getBoundingClientRect().height, onH: on?.getBoundingClientRect().height, hidden: other ? getComputedStyle(other.querySelector('.ld-cands')).display : '' }; });
  ok(lay.n >= 2 && lay.onTop, `휴대폰 추첨: 지금 라인이 맨 위(추첨 줄 ${lay.n}개)`);
  ok(lay.otherH < lay.onH * 0.6 && lay.hidden === 'none', `남은 라인은 한 줄로 접힘(높이 ${Math.round(lay.otherH)} vs ${Math.round(lay.onH)})`);
  errs.push(...M.errs);
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
