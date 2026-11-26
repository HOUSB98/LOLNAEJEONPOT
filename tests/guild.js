// 길드(정파·마교): 창설 전 대기 화면 · 관리자 자동 배정(인원 차 1 이하, 같은 길드로 묶기, MMR 평균 비슷) · 이름 옆 엠블럼 ·
// 길드 전적(창설 이후, 경기 당시 소속)·대항전(양 팀 다수 길드가 다를 때)을 따로 계산한 값과 비교 · 옮겨도 지난 경기는 예전 소속 ·
// 새로 온 사람(인원 다르면 적은 쪽만) · 스스로 옮기기(본인 PIN, 분기 1회) · 길드장 공지(본인 PIN) · 사랑방(비밀번호, 암호화 저장, 다른 기기에서 읽힘) ·
// 오늘의 내전 길드전(라인 유지하며 정파 블루·마교 레드, 저장 시 gw) · 길드 화면만 열면 사랑방 읽기 0 · 휴대폰 가로 넘침 없음 · 오류 없음
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
const crypto = require('crypto');
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const ids = seed.players.map((p) => p.id), nm = Object.fromEntries(seed.players.map((p) => [p.id, p.name]));
  const A = await client(b, be, 'WORK', 'A'); A.on('dialog', (d) => d.accept());
  await open(A, 'home', 900); await A.evaluate(() => (location.hash = '#/guild')); await A.waitForTimeout(1200);
  ok(await A.evaluate(() => !!document.querySelector('.gd-wait') && !document.querySelector('#main .gem:not(.gd-wait .gem)')), '창설 전: 길드 화면은 대기 안내, 다른 곳에 엠블럼 없음');
  // 관리자 창설: 두 사람 묶기 → 미리보기 → 창설
  await open(A, 'admin/guild', 1000);
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); S.admin = true; });
  await A.selectOption('#ga-a', ids[3]); await A.selectOption('#ga-b', ids[7]); await A.click('[data-a=gaPair]'); await A.waitForTimeout(300);
  await A.click('[data-a=gaPlan]'); await A.waitForTimeout(800);
  await A.click('[data-a=gaCreate]'); await A.waitForTimeout(1500);
  const P = () => be.db.players, G = () => be.db.meta.guild;
  const cnt = { j: 0, m: 0 }; Object.values(P()).forEach((p) => cnt[p.guild]++);
  const mmr = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const a = { j: [], m: [] }; Object.values(S.store.data.players).forEach((p) => a[p.guild]?.push(S.st.P[p.id].mmr)); const av = (x) => x.reduce((s, v) => s + v, 0) / x.length; return Math.abs(av(a.j) - av(a.m)); });
  ok(G()?.at && Math.abs(cnt.j - cnt.m) <= 1 && cnt.j + cnt.m === ids.length && P()[ids[3]].guild === P()[ids[7]].guild && mmr < 40 && P()[ids[0]].glog?.[0]?.by === 'init', `창설: 정파 ${cnt.j} · 마교 ${cnt.m}(차이 1 이하), 묶은 두 사람 같은 길드, 평균 MMR 차 ${mmr.toFixed(1)}, 소속 기록 남김`);
  // 공지 창: 창설 뒤 3일 동안 홈이 열리면 한 번(접속마다), '다시 보지 않기'면 이 기기에서는 끝
  const C = await client(b, be, 'WORK', 'C');
  await open(C, 'home', 2000);
  const pop = await C.evaluate(() => document.querySelector('#modal.on .np-pop')?.innerText || '');
  ok(/정파 · 마교, 두 문파가 열렸습니다/.test(pop) && !/선수\d/.test(pop), '창설 뒤 홈을 열면 공지 창(멤버 이름 없음)');
  await C.click('#npp-no'); await C.click('[data-a=nppClose]'); await C.waitForTimeout(300);
  await open(C, 'home', 2000);
  ok(!(await C.$('#modal.on .np-pop')), "'다시 보지 않기' 뒤에는 다시 안 뜸");
  await C.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { at: Date.now() - 4 * 864e5 }); localStorage.clear(); sessionStorage.clear(); localStorage.setItem('naejeon:nick', 'C'); sessionStorage.setItem('naejeon:welcomed', '1'); });
  await open(C, 'home', 2000);
  ok(!(await C.$('#modal.on .np-pop')), '창설 3일이 지나면 공지 창이 안 뜸');
  // 창설 시각을 경기 기록 중간으로 옮기고(창설 이전 경기는 길드 기록에서 빠져야 함), 한 명(x)을 창설 직후 옮긴 것처럼 소속 기록을 둠
  const ms = seed.matches.map((m) => m.at).sort((a, b) => a - b), t0 = ms[Math.floor(ms.length * 0.5)], t1 = ms[Math.floor(ms.length * 0.8)];
  const x = ids[5], gx = P()[x].guild, ox = gx === 'j' ? 'm' : 'j';
  await A.evaluate(async ([t0, t1, x, gx, ox]) => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { at: t0 }); for (const p of Object.values(S.store.data.players)) await S.store.patch('players', p.id, { glog: p.id === x ? [{ g: ox, at: t0, by: 'init' }, { g: gx, at: t1, by: 'admin' }] : [{ g: p.guild, at: t0, by: 'init' }] }); }, [t0, t1, x, gx, ox]);
  await A.waitForTimeout(800);
  // 따로 계산: 창설 이후, 경기 당시 소속
  const want = (() => {
    const at = (id, t) => (id === x ? (t >= t1 ? gx : ox) : P()[id].guild);
    const W = { j: { g: 0, w: 0, war: 0 }, m: { g: 0, w: 0, war: 0 } };
    for (const m of Object.values(be.db.matches)) {
      if (m.deleted || !m.winner || m.at < t0) continue;
      const gs = {}; for (const s of ['blue', 'red']) { gs[s] = m[s].map((id) => at(id, m.at)); gs[s].forEach((g) => { W[g].g++; if (m.winner === s) W[g].w++; }); }
      const maj = (a) => ['j', 'm'].find((g) => a.filter((v) => v === g).length >= 3); const bj = maj(gs.blue), rj = maj(gs.red);
      if (bj !== rj) W[m.winner === 'blue' ? bj : rj].war++;
    }
    return W;
  })();
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); localStorage.setItem('naejeon:me:' + S.key, Object.keys(S.store.data.players)[0]); });
  await open(A, 'jeongpa', 1500); await A.click('[data-a=gdMode][data-m=all]'); await A.waitForTimeout(600);
  const got = await A.evaluate(() => ({ big: [...document.querySelectorAll('.gd-big b')].map((e) => +e.innerText), war: [...document.querySelectorAll('.gw-sub b')][0]?.innerText }));
  ok(got.big[0] === want.j.w && got.big[0] + got.big[1] === want.j.g, `정파 창설 이후 전적 ${want.j.w}승 ${want.j.g - want.j.w}패 = 따로 계산(옮긴 선수는 경기 당시 소속): ` + JSON.stringify(got.big));
  ok(got.war === `${want.j.war} : ${want.m.war}`, `대항전 맞대결 ${want.j.war} : ${want.m.war}(양 팀 다수 길드가 다를 때만): ` + got.war);
  const sec = await A.evaluate(() => ['.gd-hero', '.gd-kp', '.gp-war', '.gp-ntc', '.gp-ch', '.gp-ln', '.gp-duo', '.gp-feed', '.gp-flow', '.gp-mem', '.gp-rec', '.gp-his', '.gp-lg'].filter((s) => !document.querySelector('.gd-j ' + s)));
  ok(!sec.length && await A.evaluate(() => !!document.querySelector('.gd.gd-j') && getComputedStyle(document.querySelector('.gd-hero')).borderTopColor !== ''), '길드 화면 구성(히어로·숫자·대항전·공지·순위·챔피언·라인·듀오·최근 경기·흐름·길드원·명예의 전당·연혁·사랑방) 모두 있음 ' + sec.join());
  const bg = await A.evaluate(async () => { const j = getComputedStyle(document.querySelector('.gd-hero')).backgroundImage; location.hash = '#/magyo'; await new Promise((r) => setTimeout(r, 700)); return [j, getComputedStyle(document.querySelector('.gd-hero')).backgroundImage, !!document.querySelector('.gd.gd-m')]; });
  ok(bg[0] !== bg[1] && bg[2], '정파·마교 화면 분위기(배경)가 서로 다름');
  // 정파·마교는 각각 다른 화면(메뉴 2개), 예전 주소 #/guild/m 은 마교 화면으로
  const nav = await A.$$eval('#nav a[data-p=jeongpa], #nav a[data-p=magyo]', (x) => x.map((e) => e.innerText.trim()));
  await A.evaluate(() => (location.hash = '#/guild/m')); await A.waitForTimeout(900);
  ok(nav.join() === '정파,마교' && (await A.evaluate(() => location.hash === '#/magyo' && !!document.querySelector('.gd.gd-m') && !document.querySelector('.gd-j'))), '메뉴에 정파·마교 따로, 예전 주소 #/guild/m → 마교 화면: ' + nav.join());
  // 관리자: 창설 뒤에도 인원 조정(누르면 바로 옮김)
  await open(A, 'admin/guild', 1000); await A.evaluate(async () => { const { S } = await import('/js/core.js'); S.admin = true; });
  const y = ids[9], gy = P()[y].guild, oy = gy === 'j' ? 'm' : 'j';
  await A.click(`[data-a=gaSet][data-id="${y}"][data-g="${oy}"]`); await A.waitForTimeout(800);
  ok(P()[y].guild === oy && P()[y].glog.at(-1).by === 'admin', '관리자 인원 조정: 버튼 한 번에 다른 길드로');
  await A.click(`[data-a=gaSet][data-id="${y}"][data-g="${gy}"]`); await A.waitForTimeout(800);
  await A.click('[data-a=gaPlan]'); await A.waitForTimeout(800);
  const before = { ...Object.fromEntries(Object.values(P()).map((p) => [p.id, p.guild])) };
  await A.click('[data-a=gaReApply]'); await A.waitForTimeout(1200);
  const cr = { j: 0, m: 0 }; Object.values(P()).forEach((p) => cr[p.guild]++);
  ok(Math.abs(cr.j - cr.m) <= 1 && P()[ids[3]].guild === P()[ids[7]].guild && Object.values(P()).every((p) => p.guild === before[p.id] || p.glog.at(-1).by === 'admin'), `관리자 전체 다시 나누기: 인원 차 1 이하, 묶은 짝 유지(정파 ${cr.j} · 마교 ${cr.m})`);
  // 이름 옆 엠블럼(랭킹·선수 카드)
  await open(A, 'rank', 900);
  ok(await A.evaluate(() => document.querySelectorAll('.tbl tbody .gnm .gem').length >= 10 && !!document.querySelector('.tbl tbody td.gtint .gnm.g-j, .tbl tbody td.gtint .gnm.g-m')), '랭킹 이름 옆 엠블럼 + 길드 색');
  await open(A, 'players', 900);
  ok(await A.evaluate(() => document.querySelectorAll('.pcard.gcard .gem').length >= 10), '선수 카드 이름 옆 엠블럼 + 길드 테두리');
  // 새로 온 사람: 인원이 다르면 적은 쪽만
  const c0 = { j: 0, m: 0 }; Object.values(P()).forEach((p) => c0[p.guild]++);
  if (c0.j === c0.m) await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.patch('players', id, { guild: S.store.data.players[id].guild === 'j' ? 'm' : 'j' }); }, ids[10]);
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.put('players', 'pnew', { id: 'pnew', name: '새선수', scores: { top: 5, jg: 5, mid: 5, adc: 5, sup: 5 }, mainLane: 'mid', deleted: false }); localStorage.setItem('naejeon:me:' + S.key, 'pnew'); });
  await A.waitForTimeout(500);
  const c1 = { j: 0, m: 0 }; Object.values(P()).forEach((p) => p.guild && c1[p.guild]++); const sm = c1.j < c1.m ? 'j' : 'm';
  await open(A, 'guild', 1200);
  const jb = await A.$$eval('.gd-join [data-a=gJoin]', (x) => x.map((e) => e.dataset.g));
  ok(jb.join() === sm, `새로 온 사람: 인원이 적은 쪽(${sm}) 버튼만: ` + jb.join());
  await A.click('.gd-join [data-a=gJoin]'); await A.waitForTimeout(900);
  ok(P().pnew.guild === sm && P().pnew.glog?.[0]?.by === 'new' && Object.values(be.db.chat).some((m) => /새선수님이 .+에 합류/.test(m.t)), '합류 저장 + 채팅 알림');
  // 스스로 옮기기: 본인 PIN(가챠 PIN), 분기에 한 번
  const cc = { j: 0, m: 0 }; Object.values(P()).forEach((p) => p.guild && cc[p.guild]++); const big = cc.j >= cc.m ? 'j' : 'm';
  const me = ids.find((id) => P()[id].guild === big && id !== x), pinH = crypto.createHash('sha256').update(`naejeon:gacha:${me}:2468`).digest('hex');
  be.seed('gacha', [{ id: me, pid: me, pinHash: pinH }]);
  await A.evaluate(async (me) => { const { S } = await import('/js/core.js'); localStorage.setItem('naejeon:me:' + S.key, me); }, me);
  const from = P()[me].guild;
  // 옮길 수 있게 인원 맞추기: 옮겨 갈 쪽 인원이 2명 이상 많으면 막히므로 확인만
  const allow = await A.evaluate(async (me) => (await import('/js/guild.js')).moveRule(me), me);
  await open(A, 'me', 1200);
  if (allow.ok) {
    await A.click('[data-a=gMove]'); await A.waitForSelector('#gpin-i'); await A.fill('#gpin-i', '1111'); await A.click('#gpin .btn'); await A.waitForTimeout(500);
    const still = P()[me].guild === from;
    await A.fill('#gpin-i', '2468'); await A.click('#gpin .btn'); await A.waitForTimeout(900);
    ok(still && P()[me].guild !== from && P()[me].glog.at(-1).by === 'self', '스스로 옮기기: 틀린 PIN은 거절, 맞는 PIN이면 옮김(소속 기록 self)');
    const again = await A.evaluate(async (me) => (await import('/js/guild.js')).moveRule(me), me);
    ok(!again.ok && /이번 분기/.test(again.why), '같은 분기에 두 번은 못 옮김: ' + again.why);
  } else ok(/인원/.test(allow.why), '인원 차이 때문에 못 옮김 안내: ' + allow.why);
  // 길드장 공지: 관리자가 길드장 지정 → 길드장 본인 PIN으로 공지
  const lg = P()[me].guild;
  await A.evaluate(async ([me, lg]) => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { lead: { [lg]: me } }); S.admin = false; sessionStorage.clear(); }, [me, lg]);
  await open(A, lg === 'j' ? 'jeongpa' : 'magyo', 1200);
  await A.click(`[data-a=gNotice][data-g=${lg}]`); await A.waitForSelector('#gpin-i'); await A.fill('#gpin-i', '2468'); await A.click('#gpin .btn');
  await A.waitForSelector('#gnf-t'); await A.fill('#gnf-t', '토요일 9시 길드전!'); await A.click('#gnf .btn'); await A.waitForTimeout(900);
  ok(G().notice?.[lg]?.t === '토요일 9시 길드전!' && (await A.$eval('.gn-box', (e) => e.innerText)).includes('토요일 9시 길드전!'), '길드장(본인 PIN) 공지 저장·표시');
  // 사랑방: 관리자가 비밀번호 → 길드원 입장 → 암호화 저장 → 다른 기기에서도 읽힘
  await A.evaluate(async (lg) => { const { S } = await import('/js/core.js'); S.admin = true; await (await import('/js/guild.js')).setPassword(lg, 'dragon77'); }, lg); await A.waitForTimeout(600);
  be.reset();
  await open(A, lg === 'j' ? 'jeongpa' : 'magyo', 1200);
  ok(!be.byCol['reads:gchat_' + lg] && !be.byCol['reads:gpost_' + lg], '길드 화면만 열면 사랑방 읽기 0');
  await A.fill('#lgf-p', 'wrong'); await A.click('#lgf .btn'); await A.waitForTimeout(1500);
  ok(!!(await A.$('#lgf')), '틀린 길드 비밀번호는 거절');
  await A.fill('#lgf-p', 'dragon77'); await A.click('#lgf .btn'); await A.waitForSelector('#lgc-t', { timeout: 8000 });
  await A.fill('#lgc-t', '비밀 작전 회의'); await A.press('#lgc-t', 'Enter'); await A.waitForTimeout(1200);
  const raw = JSON.stringify(be.db['gchat_' + lg] || {});
  ok(raw.length > 20 && !raw.includes('비밀 작전') && (await A.$eval('#lg-log', (e) => e.innerText)).includes('비밀 작전 회의'), '채팅은 암호화되어 저장(DB에 글자 없음), 화면에는 보임');
  const B = await client(b, be, 'WORK', 'B');
  await open(B, lg === 'j' ? 'jeongpa' : 'magyo', 1200); await B.fill('#lgf-p', 'dragon77'); await B.click('#lgf .btn'); await B.waitForSelector('#lg-log', { timeout: 8000 }); await B.waitForTimeout(800);
  ok((await B.$eval('#lg-log', (e) => e.innerText)).includes('비밀 작전 회의'), '다른 기기도 비밀번호를 넣으면 읽힘');
  await B.click('[data-a=lgTab][data-t=post]'); await B.waitForTimeout(300); await B.fill('#lgp-t', '공략'); await B.fill('#lgp-b', '바텀 위주로'); await B.click('#lgp .btn'); await B.waitForTimeout(1200);
  ok(!JSON.stringify(be.db['gpost_' + lg] || {}).includes('바텀') && (await B.$eval('.lg-plist', (e) => e.innerText)).includes('공략'), '게시판 글도 암호화 저장·목록에 보임');
  // 오늘의 내전 길드전: 라인은 그대로, 정파 블루·마교 레드
  const J = ids.filter((id) => P()[id].guild === 'j').slice(0, 5), M = ids.filter((id) => P()[id].guild === 'm').slice(0, 5);
  await open(A, 'today', 1000);
  await A.evaluate(async ([J, M]) => { const t = await import('/js/today.js'); const blue = [J[0], M[1], J[2], M[3], J[4]], red = [M[0], J[1], M[2], J[3], M[4]]; t.setDraftTeams(blue, red); }, [J, M]); await A.waitForTimeout(600);
  await A.click('[data-a=tGw]'); await A.waitForTimeout(500);
  const dr = await A.evaluate(async () => { const { S } = await import('/js/core.js'); return JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('naejeon:draft')) || 'null') || 'null') || S.store.data.meta.todayDraft; });
    ok(dr && dr.gw && dr.blue.every((id, i) => id === J[i]) && dr.red.every((id, i) => id === M[i]), '길드전: 라인마다 맞바꿔 정파 블루 · 마교 레드');
  await A.click('[data-a=tWin][data-w=blue]'); await A.click('[data-a=tSave]'); await A.waitForTimeout(1200);
  ok(Object.values(be.db.matches).some((m) => m.gw === true && m.blue.join() === J.join()), '저장한 경기에 길드전 표시(gw)');
  // 휴대폰
  const Mo = await client(b, be, 'WORK', 'Mo', { ctx: await device(b, be, 'WORK', 'Mo', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  for (const h of ['jeongpa', 'magyo', 'admin/guild', 'me']) { await open(Mo, h, 1300); const w = await Mo.evaluate(() => document.documentElement.scrollWidth); ok(w <= 361, `휴대폰(360px) ${h} 가로 넘침 없음(${w})`); }
  const errs = [...A.errs, ...B.errs, ...Mo.errs, ...C.errs]; console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
