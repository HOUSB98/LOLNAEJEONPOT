// 연말 결산(#/recap): 그해 경기만 모아 계산(새벽 6시 전 경기는 전날 = 1/1 새벽은 지난해), 숫자를 따로 계산한 값과 비교(경기 수·내전 날·MVP·개근상·최다 승),
// 해 고르기, 카톡 카드(제목·요약·링크), 메뉴·홈 띠는 11/20 ~ 1/31에만(1월엔 지난해), 휴대폰 가로 넘침 없음, 페이지 오류 없음
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  // 지난해 경계 경기 2판: 12/31 23시(지난해), 1/1 새벽 3시(새벽 6시 전이라 지난해 12/31 내전으로 셈). 1/1 오전 10시는 올해
  const Y = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
  const ids = seed.players.map((p) => p.id), mk = (id, at, w) => ({ id, at, seq: 0, blue: ids.slice(0, 5), red: ids.slice(5, 10), winner: w, kda: {}, champs: { blue: [], red: [] }, bans: { blue: [], red: [] }, deleted: false });
  seed.matches.push(mk('y1', new Date(Y - 1, 11, 31, 23).getTime(), 'blue'), mk('y2', new Date(Y, 0, 1, 3).getTime(), 'blue'));
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const stub = () => { window.__kk = []; window.Kakao = { _i: false, isInitialized() { return this._i; }, init() { this._i = true; }, Share: { sendDefault(o) { window.__kk.push(o); } } }; };
  const A = await client(b, be, 'WORK', seed.players[0].name); await A.addInitScript(stub);
  await open(A, 'home', 900);
  // 기간 함수
  const sea = await A.evaluate(async () => { const { recapSeason, recapYear } = await import('/js/core.js'); const d = (m, x) => new Date(2026, m - 1, x); return { s: [d(11, 19), d(11, 20), d(12, 31), d(1, 31), d(2, 1), d(7, 1)].map((x) => recapSeason(x)), y: [recapYear(new Date(2027, 0, 5)), recapYear(new Date(2026, 11, 5))] }; });
  ok(JSON.stringify(sea.s) === '[false,true,true,true,false,false]' && sea.y.join() === '2026,2026', '메뉴·홈 띠 기간 11/20 ~ 1/31, 1월에는 지난해 결산: ' + JSON.stringify(sea));
  const inSeason = await A.evaluate(async () => (await import('/js/core.js')).recapSeason());
  const nav = !!(await A.$('#nav a[data-p=recap], #side a[href="#/recap"]')), bar = !!(await A.$('#main .rcp-home'));
  ok(inSeason ? nav && bar : !nav && !bar, `오늘(${inSeason ? '기간 안' : '기간 밖'}): 왼쪽 메뉴 '연말 결산'·홈 결산 띠 ${inSeason ? '보임' : '안 보임'}`);
  await open(A, 'recap', 1500);
  ok(await A.evaluate(() => document.title === '연말 결산 · NAEJEONPOT' && !!document.querySelector('#main .rcp-hero')), '연말 결산 화면 열림(탭 제목)');
  // 따로 계산한 값과 비교: 그해 경기(내전 날짜 기준)
  const want = await A.evaluate(async (Y) => {
    const { S } = await import('/js/core.js');
    const dk = (at) => { const d = new Date(at - 6 * 3600e3); return d.getFullYear(); }, dd = (at) => { const d = new Date(at - 6 * 3600e3); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const ms = Object.values(S.store.data.matches).filter((m) => !m.deleted && m.winner && dk(m.at) === Y);
    const g = {}, w = {}; ms.forEach((m) => ['blue', 'red'].forEach((s) => m[s].forEach((id) => { g[id] = (g[id] || 0) + 1; if (m.winner === s) w[id] = (w[id] || 0) + 1; })));
    const live = Object.keys(g).filter((id) => S.store.data.players[id] && !S.store.data.players[id].deleted);
    const maxG = Math.max(...live.map((id) => g[id])), minG = Math.max(10, Math.ceil(maxG * 0.5));
    const adj = (id) => ((w[id] || 0) + 5) / (g[id] + 10);
    const mvp = live.filter((id) => g[id] >= minG).sort((a, b) => adj(b) - adj(a) || g[b] - g[a])[0];
    const most = live.sort((a, b) => g[b] - g[a] || (w[b] || 0) - (w[a] || 0))[0];
    const nm = (id) => S.store.data.players[id].name;
    return { n: ms.length, days: new Set(ms.map((m) => dd(m.at))).size, ppl: live.length, mvp: nm(mvp), mvpG: g[mvp], minG, most: nm(most), mostG: g[most] };
  }, Y);
  const got = await A.evaluate(() => ({ kp: [...document.querySelectorAll('.rcp-kp b')].map((e) => e.innerText), aw: [...document.querySelectorAll('.rcp-aw')].map((e) => [e.querySelector('small').innerText, e.querySelector('b').innerText, e.querySelector('em').innerText, e.querySelector('i')?.innerText || '']) }));
  ok(got.kp[0] === String(want.n) && got.kp[1] === String(want.days) && got.kp[2] === String(want.ppl), `경기 ${want.n} · 내전한 날 ${want.days} · 참가 ${want.ppl}명이 따로 계산한 값과 같음: ` + JSON.stringify(got.kp));
  const mv = got.aw.find((x) => x[0] === '올해의 MVP'), mo = got.aw.find((x) => /개근상/.test(x[0]));
  ok(mv && mv[1] === want.mvp && new RegExp(`${want.minG}판 이상`).test(mv[3]), `MVP = 보정 승률 1위(${want.minG}판 이상) ${want.mvp}: ` + JSON.stringify(mv));
  const lowest = await A.evaluate(async (Y) => { const r = (await import('/js/recap.js')).recapData(Y); return { mvpMin: Math.min(...r.mvp.map((x) => x.g)), minG: r.minG, streakOk: r.streak.findIndex((x) => x.g < r.minG) === -1 || r.streak.slice(r.streak.findIndex((x) => x.g < r.minG)).every((x) => x.g < r.minG), growOk: r.grow.findIndex((x) => x.s.g < r.minG) === -1 || r.grow.slice(r.grow.findIndex((x) => x.s.g < r.minG)).every((x) => x.s.g < r.minG), duoMin: Math.min(...r.duo.map((x) => x.g)), minDuo: r.minDuo }; }, Y);
  ok(lowest.mvpMin >= lowest.minG && lowest.streakOk && lowest.growOk && lowest.duoMin >= lowest.minDuo, '판수 적은 사람: MVP 후보에서 빠지고, 연승·성장 순위는 자격 판수를 채운 사람 뒤로, 듀오는 자격 판수 이상만: ' + JSON.stringify(lowest));
  ok(mo && mo[1] === want.most && mo[2] === `${want.mostG}판 출전`, `개근상 = 최다 출전 ${want.most} ${want.mostG}판`);
  const months = await A.$$eval('.rcp-bars em', (x) => x.reduce((a, e) => a + (+e.innerText || 0), 0));
  ok(months === want.n, '월별 막대 합 = 그해 경기 수');
  // 지난해: 경계 경기 2판만(1/1 새벽 3시 경기는 지난해 12/31 내전)
  ok(!!(await A.$(`[data-a=rcpYear][data-v="${Y - 1}"]`)), `해 고르기에 ${Y - 1}년이 생김`);
  await A.click(`[data-a=rcpYear][data-v="${Y - 1}"]`); await A.waitForTimeout(500);
  const ly = await A.evaluate(() => [...document.querySelectorAll('.rcp-kp b')].map((e) => e.innerText));
  ok(ly[0] === '2' && ly[1] === '1', `${Y - 1}년: 12/31 밤·1/1 새벽 경기 2판 = 내전 1일(새벽 6시 전은 전날): ` + JSON.stringify(ly));
  await A.click(`[data-a=rcpYear][data-v="${Y}"]`); await A.waitForTimeout(500);
  // 내 결산: 닉네임과 같은 선수가 자동 선택
  ok(await A.$eval('[data-c=rcpMe]', (e) => e.value) === ids[0] && !!(await A.$('.rcp-mg')), '내 결산: 닉네임과 같은 선수가 자동으로 골라짐');
  await A.selectOption('[data-c=rcpMe]', ids[1]); await A.waitForTimeout(400);
  const me = await A.$$eval('.rcp-mg>div', (x) => x.map((e) => e.innerText.replace(/\s+/g, ' ')));
  const g1 = await A.evaluate(async ([Y, id]) => { const { S } = await import('/js/core.js'); return Object.values(S.store.data.matches).filter((m) => !m.deleted && m.winner && new Date(m.at - 6 * 3600e3).getFullYear() === Y && (m.blue.includes(id) || m.red.includes(id))).length; }, [Y, ids[1]]);
  ok(me[0].includes(`${g1}판`), `다른 선수를 고르면 그 선수 결산(출전 ${g1}판): ` + me[0]);
  // 카톡 카드
  await A.click('[data-a=kkShare][data-t=recap]'); await A.waitForTimeout(700);
  const kk = await A.evaluate(() => window.__kk[0]);
  ok(kk?.content.title === `${Y} NAEJEONPOT 연말 결산` && kk.content.description.includes(`총 ${want.n}경기`) && kk.content.description.includes(`MVP ${want.mvp}`) && new RegExp(`#/recap/${Y}$`).test(kk.content.link.webUrl) && kk.buttons[0].title === '결산 보러 가기', '카톡 카드: 제목·경기 수·MVP, 링크는 그해 결산: ' + JSON.stringify(kk?.content));
  // 카톡 링크(#/recap/지난해)로 열면 그해가 바로 보임
  await open(A, `recap/${Y - 1}`, 1200);
  ok(await A.evaluate((y) => document.querySelector('.rcp-hero h2')?.innerText === `${y} 연말 결산` && location.hash === '#/recap', Y - 1), '링크 #/recap/해 → 그해 결산(주소는 #/recap으로)');
  // 휴대폰
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  await open(M, 'recap', 1500);
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && !!document.querySelector('.rcp-aws')), '휴대폰(360px) 가로 넘침 없음');
  const errs = [...A.errs, ...M.errs];
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
