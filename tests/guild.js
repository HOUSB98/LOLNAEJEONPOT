// 길드(정파·마교): 창설 전 대기 화면 · 관리자 자동 배정(인원 차 1 이하, 같은 길드로 묶기, MMR 평균 비슷) · 이름 옆 엠블럼 ·
// 길드 전적(창설 이후, 경기 당시 소속)·대항전(양 팀 다수 길드가 다를 때)을 따로 계산한 값과 비교 · 옮겨도 지난 경기는 예전 소속 ·
// 새로 온 사람(인원 다르면 적은 쪽만) · 스스로 옮기기(본인 PIN, 분기 1회) · 길드장 공지(본인 PIN) · 채팅창 길드 탭(비밀번호, 암호화 저장, 다른 기기에서 읽힘) · 길드 게시판(공개) · 들어갈 때 효과 ·
// 오늘의 내전 길드전(라인 유지하며 정파 블루·마교 레드, 저장 시 gw) · 길드 화면만 열면 길드 채팅 읽기 0 · 휴대폰 가로 넘침 없음 · 오류 없음
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
  await A.evaluate(async (h) => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'settings', { pinHash: h }); }, require('crypto').createHash('sha256').update('naejeon:1234').digest('hex')); await A.waitForTimeout(300);
  await A.click('[data-a=gaCreate]'); await A.waitForSelector('#gapin-i');
  await A.fill('#gapin-i', '9999'); await A.click('#gapin .btn'); await A.waitForTimeout(500);
  ok(!be.db.meta.guild?.at && !!(await A.$('#gapin')), '문파 창설: 관리자 모드여도 PIN을 다시 물음, 틀리면 창설 안 됨');
  await A.fill('#gapin-i', '1234'); await A.click('#gapin .btn'); await A.waitForTimeout(1500);
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
  const x = ids[5], wl = P()[x].guild, ox = wl === 'j' ? 'm' : 'j';
  await A.evaluate(async ([t0, t1, x, wl, ox]) => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { at: t0 }); for (const p of Object.values(S.store.data.players)) await S.store.patch('players', p.id, { glog: p.id === x ? [{ g: ox, at: t0, by: 'init' }, { g: wl, at: t1, by: 'admin' }] : [{ g: p.guild, at: t0, by: 'init' }] }); }, [t0, t1, x, wl, ox]);
  await A.waitForTimeout(800);
  // 따로 계산: 창설 이후, 경기 당시 소속
  const want = (() => {
    const at = (id, t) => (id === x ? (t >= t1 ? wl : ox) : P()[id].guild);
    const W = { j: { g: 0, w: 0, war: 0 }, m: { g: 0, w: 0, war: 0 } };
    for (const m of Object.values(be.db.matches)) {
      if (m.deleted || !m.winner || m.at < t0) continue;
      const gs = {}; for (const s of ['blue', 'red']) { gs[s] = m[s].map((id) => at(id, m.at)); gs[s].forEach((g) => { W[g].g++; if (m.winner === s) W[g].w++; }); }
      const one = (a) => (a.every((v) => v && v === a[0]) ? a[0] : ''); const bj = one(gs.blue), rj = one(gs.red);
      if (bj && rj && bj !== rj) W[m.winner === 'blue' ? bj : rj].war++;
    }
    return W;
  })();
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); localStorage.setItem('naejeon:me:' + S.key, Object.keys(S.store.data.players)[0]); });
  await open(A, 'jeongpa', 1500); await A.click('[data-a=gdMode][data-m=all]'); await A.waitForTimeout(600);
  const got = await A.evaluate(() => ({ big: [...document.querySelectorAll('.gd-big b')].map((e) => +e.innerText), war: [...document.querySelectorAll('.gw-sub b')][0]?.innerText }));
  ok(got.big[0] === want.j.w && got.big[0] + got.big[1] === want.j.g, `정파 창설 이후 전적 ${want.j.w}승 ${want.j.g - want.j.w}패 = 따로 계산(옮긴 선수는 경기 당시 소속): ` + JSON.stringify(got.big));
  ok(got.war === `${want.j.war} : ${want.m.war}`, `정마대전 ${want.j.war} : ${want.m.war}(양 팀이 각각 한 문파로만 구성된 경기만): ` + got.war);
  const sec = await A.evaluate(() => ['.gd-hero', '.gd-kp', '.gp-war', '.gp-ntc', '.gp-ch', '.gp-ln', '.gp-duo', '.gp-feed', '.gp-flow', '.gp-mem', '.gp-rec', '.gp-his', '.gp-bd'].filter((s) => !document.querySelector('.gd-j ' + s)));
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
  await A.click('[data-a=gaReApply]'); await A.waitForSelector('#gapin-i'); await A.fill('#gapin-i', '1234'); await A.click('#gapin .btn'); await A.waitForTimeout(1200);
  const cr = { j: 0, m: 0 }; Object.values(P()).forEach((p) => cr[p.guild]++);
  ok(Math.abs(cr.j - cr.m) <= 1 && P()[ids[3]].guild === P()[ids[7]].guild && Object.values(P()).every((p) => p.guild === before[p.id] || p.glog.at(-1).by === 'admin'), `관리자 전체 다시 나누기: 인원 차 1 이하, 묶은 짝 유지(정파 ${cr.j} · 마교 ${cr.m})`);
  // 이름 옆 엠블럼(랭킹·선수 카드)
  await open(A, 'rank', 900);
  ok(await A.evaluate(() => document.querySelectorAll('.tbl tbody .gnm .gem').length >= 10 && !!document.querySelector('.tbl tbody td.gtint .gnm.g-j, .tbl tbody td.gtint .gnm.g-m')), '랭킹 이름 옆 엠블럼 + 길드 색');
  await open(A, 'players', 900);
  ok(await A.evaluate(() => document.querySelectorAll('.pcard.gcard .gem').length >= 10), '선수 카드 이름 옆 엠블럼 + 길드 테두리');
  // 새로 온 사람: 자동 배정 없이 무소속, 본인이 고르거나 옮기는 버튼 없음(관리자만 배정)
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.put('players', 'pnew', { id: 'pnew', name: '새선수', scores: { top: 5, jg: 5, mid: 5, adc: 5, sup: 5 }, mainLane: 'mid', deleted: false }); localStorage.setItem('naejeon:me:' + S.key, 'pnew'); });
  await A.waitForTimeout(500);
  await open(A, 'jeongpa', 1200);
  ok(!P().pnew.guild && !(await A.$('[data-a=gJoin]')), '새로 온 사람: 무소속, 스스로 고르는 버튼 없음');
  await open(A, 'me', 1200);
  ok(!(await A.$('[data-a=gMove], [data-a=gJoin]')) && (await A.$eval('.me-gd', (e) => e.innerText).catch(() => '')).includes('관리자가 문파를 배정'), '내 페이지: 문파 옮기기·고르기 버튼 없음(관리자가 배정한다는 안내)');
  const me = ids.find((id) => P()[id].guild && id !== x), pinH = crypto.createHash('sha256').update(`naejeon:gacha:${me}:2468`).digest('hex');
  be.seed('gacha', [{ id: me, pid: me, pinHash: pinH }]);
  await A.evaluate(async (me) => { const { S } = await import('/js/core.js'); localStorage.setItem('naejeon:me:' + S.key, me); }, me);
  // 길드장 공지: 관리자가 길드장 지정 → 길드장 본인 PIN으로 공지
  const lg = P()[me].guild;
  await A.evaluate(async ([me, lg]) => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { lead: { [lg]: me } }); S.admin = false; sessionStorage.clear(); }, [me, lg]);
  await open(A, lg === 'j' ? 'jeongpa' : 'magyo', 1200);
  await A.click(`[data-a=gNotice][data-g=${lg}]`); await A.waitForSelector('#gpin-i'); await A.fill('#gpin-i', '2468'); await A.click('#gpin .btn');
  await A.waitForSelector('#gnf-t'); await A.fill('#gnf-t', '토요일 9시 길드전!'); await A.click('#gnf .btn'); await A.waitForTimeout(900);
  ok(G().notice?.[lg]?.t === '토요일 9시 길드전!' && (await A.$eval('.gn-box', (e) => e.innerText)).includes('토요일 9시 길드전!'), '길드장(본인 PIN) 공지 저장·표시');
  // 채팅창 길드 탭: 관리자가 비밀번호 → 탭에서 비밀번호 입력 → 암호화 저장 → 다른 기기에서도 읽힘
  const pg = lg === 'j' ? 'jeongpa' : 'magyo';
  await A.evaluate(async (lg) => { const { S } = await import('/js/core.js'); S.admin = true; await (await import('/js/gchat.js')).setPassword(lg, 'dragon77'); }, lg); await A.waitForTimeout(600);
  be.reset();
  await open(A, pg, 1500);
  ok(!be.byCol['reads:gchat_' + lg] && !(await A.$('.gp-lg')) && !!(await A.$('.gp-bd')), '길드 화면에는 채팅 칸 없이 게시판, 화면만 열면 길드 채팅 읽기 0');
  await A.click('#chatfab'); await A.waitForTimeout(900);
  const tabs = await A.$$eval('#ch-tabs [data-a=chTab]', (x) => x.map((e) => e.innerText.trim()));
  await A.click(`#ch-tabs [data-t=${lg}]`); await A.waitForSelector('#gchf-p', { timeout: 8000 });
  ok(tabs.join() === '로비,정파,마교' && await A.evaluate(() => getComputedStyle(document.getElementById('chatform')).display === 'none'), '채팅창 탭 로비·정파·마교, 길드 탭은 잠겨 있으면 입력칸 없이 비밀번호만: ' + tabs.join());
  await A.fill('#gchf-p', 'wrong'); await A.click('#gchf .btn'); await A.waitForTimeout(1800);
  ok(!!(await A.$('#gchf')), '틀린 길드 비밀번호는 거절');
  await A.fill('#gchf-p', 'dragon77'); await A.click('#gchf .btn'); await A.waitForSelector('.gch-bar', { timeout: 8000 });
  ok(await A.evaluate(() => getComputedStyle(document.querySelector('#chatform .cbtn2:not(.go)')).display === 'none'), '길드 탭에서는 스티커·주사위 숨김(글만)');
  await A.fill('#chatinp', '비밀 작전 회의'); await A.press('#chatinp', 'Enter'); await A.waitForTimeout(1300);
  const raw = JSON.stringify(be.db['gchat_' + lg] || {}), lobbyRaw = JSON.stringify(be.db.chat || {});
  ok(raw.length > 20 && !raw.includes('비밀 작전') && !lobbyRaw.includes('비밀 작전') && (await A.$eval('#chatlog', (e) => e.innerText)).includes('비밀 작전 회의'), '길드 채팅은 암호화 저장(DB·로비에 글자 없음), 채팅창에는 보임');
  await A.click('#ch-tabs [data-t=lobby]'); await A.waitForTimeout(500);
  ok(!(await A.$eval('#chatlog', (e) => e.innerText)).includes('비밀 작전 회의') && await A.evaluate(() => getComputedStyle(document.getElementById('chatform')).display !== 'none'), '로비 탭으로 돌아오면 로비 채팅·입력칸');
  const B = await client(b, be, 'WORK', 'B');
  await open(B, 'rank', 1200); await B.click('#chatfab'); await B.waitForTimeout(900); await B.click(`#ch-tabs [data-t=${lg}]`); await B.waitForSelector('#gchf-p', { timeout: 8000 });
  await B.fill('#gchf-p', 'dragon77'); await B.click('#gchf .btn'); await B.waitForSelector('.gch-bar', { timeout: 8000 }); await B.waitForTimeout(800);
  ok((await B.$eval('#chatlog', (e) => e.innerText)).includes('비밀 작전 회의'), '다른 기기도 비밀번호를 넣으면 길드 채팅이 읽힘');
  // 길드 게시판(공개): 글·댓글
  await A.click('.gp-bd [data-a=gbWrite]'); await A.waitForSelector('#gbf-t'); await A.fill('#gbf-t', '토요일 공략'); await A.fill('#gbf-b', '바텀 위주로 갑니다'); await A.click('#gbf .btn.pri'); await A.waitForTimeout(1200);
  ok(Object.values(be.db['gboard_' + lg] || {}).some((x) => x.t === '토요일 공략') && (await A.$eval('.gb-list', (e) => e.innerText)).includes('토요일 공략'), '길드 게시판 글 올리기 → 목록에 보임');
  await A.click('.gb-list [data-a=gbOpen]'); await A.waitForSelector('#gbk-t'); await A.fill('#gbk-t', '좋아요'); await A.press('#gbk-t', 'Enter'); await A.waitForTimeout(1200);
  ok(Object.values(be.db['gboard_' + lg]).some((x) => x.cm?.[0]?.t === '좋아요') && (await A.$eval('.gb-cm', (e) => e.innerText)).includes('좋아요'), '게시판 댓글');
  // 게시판 글쓰기는 문파 비밀번호(채팅과 같은 것)를 넣어야
  const D2 = await client(b, be, 'WORK', 'D2');
  await open(D2, pg, 1500); await D2.click('.gp-bd [data-a=gbWrite]'); await D2.waitForSelector('#gbl-p');
  ok(!(await D2.$('#gbf')) && (await D2.$eval('.gb-list, .gp-bd', (e) => e.innerText)).length > 0, '비밀번호 없는 기기: 글쓰기 대신 비밀번호 칸(읽기는 가능)');
  await D2.fill('#gbl-p', 'nope'); await D2.click('#gbl .btn.pri'); await D2.waitForTimeout(1500);
  ok(!(await D2.$('#gbf')), '틀린 비밀번호면 글쓰기 안 열림');
  await D2.fill('#gbl-p', 'dragon77'); await D2.click('#gbl .btn.pri'); await D2.waitForSelector('#gbf-t', { timeout: 8000 });
  ok(true, '맞는 비밀번호 → 글쓰기 열림');
  // 관리 > 문파: 분기 결과 보관 + 금고 분기 초기화
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); S.admin = true; });
  await open(A, 'admin/guild', 1200);
  const arc = await A.evaluate(() => ({ rows: document.querySelectorAll('.ga-arc tbody tr').length, now: !!document.querySelector('.ga-arc tr.now') }));
  const nq = await A.evaluate(async () => Object.keys((await import('/js/guild.js')).ledger()).length);
  ok(arc.rows === nq && arc.now && nq >= 1, `분기 결과 보관: 창설 이후 분기 ${nq}개 표(이번 분기 '진행 중')`);
  const reset = await A.evaluate(async () => { const g = await import('/js/guild.js'); const L = g.ledger(); return Object.values(L).reduce((a, x) => a + x.j.bal, 0) === g.treasury().j.bal; });
  ok(reset, '금고 = 창설 이후 모든 분기 합(분기마다 초기화하지 않음)');
  // 들어갈 때 효과: 정파 꽃잎 / 마교 어두운 기운, 잠깐 뒤 사라짐
  await open(A, 'rank', 800); await A.evaluate(() => { document.body.classList.remove('lite'); location.hash = '#/magyo'; }); await A.waitForTimeout(250); // 시험 도구는 가벼운 모드라 잠깐 끔(가벼운 모드에서는 효과 없음)
  const fx1 = await A.evaluate(() => document.getElementById('gd-fx')?.className || '');
  await A.waitForTimeout(2200);
  ok(fx1.includes('fx-m') && !(await A.$('#gd-fx')), '마교 화면에 들어갈 때 어두운 기운 효과(잠깐 뒤 사라짐): ' + fx1);
  await A.evaluate(() => (location.hash = '#/jeongpa')); await A.waitForTimeout(250);
  ok((await A.evaluate(() => document.getElementById('gd-fx')?.className || '')).includes('fx-j'), '정파 화면에 들어갈 때 꽃잎 효과');
  await A.waitForTimeout(2100); await A.evaluate(() => { document.body.classList.add('lite'); location.hash = '#/rank'; }); await A.waitForTimeout(400); await A.evaluate(() => (location.hash = '#/magyo')); await A.waitForTimeout(250);
  ok(!(await A.$('#gd-fx')), '가벼운 모드에서는 들어갈 때 효과 없음');
  // 팀 구성하기 정마대전 알림: 블루·레드가 각각 한 문파로만 → 빛나는 표시(누르는 버튼 없음), 한 명이라도 섞이면 표시 없음
  const J = ids.filter((id) => P()[id].guild === 'j').slice(0, 5), M = ids.filter((id) => P()[id].guild === 'm').slice(0, 5);
  await open(A, 'today', 1000);
  await A.evaluate(async ([J, M]) => { const t = await import('/js/today.js'); t.setDraftTeams([J[0], M[1], J[2], M[3], J[4]], [M[0], J[1], M[2], J[3], M[4]]); }, [J, M]); await A.waitForTimeout(600);
  ok(!(await A.$('.gwind')) && !(await A.$('[data-a=tGw]')), '섞인 팀이면 정마대전 표시 없음, 정마대전 버튼도 없음');
  await A.evaluate(async ([J, M]) => { const t = await import('/js/today.js'); t.setDraftTeams([...J.slice(0, 4), M[4]], [...M.slice(0, 4), J[4]]); }, [J, M]); await A.waitForTimeout(600);
  ok(!(await A.$('.gwind')), '4명만 같은 문파(1명 섞임)면 정마대전 아님');
  await A.evaluate(async ([J, M]) => { const t = await import('/js/today.js'); t.setDraftTeams(J, M); }, [J, M]); await A.waitForTimeout(600);
  ok(!!(await A.$('.gwind')), '양 팀이 각각 한 문파로만 → 정마대전 표시가 빛남');
  const w0 = await A.evaluate(async () => (await import('/js/guild.js')).gData('all').j.war.g);
  await A.click('[data-a=tWin][data-w=blue]'); await A.click('[data-a=tSave]'); await A.waitForTimeout(1200);
  const w1 = await A.evaluate(async () => (await import('/js/guild.js')).gData('all').j.war.g);
  ok(w1 === w0 + 1, `저장하면 정마대전으로 자동 집계(정파 정마대전 ${w0} → ${w1}판)`);
  // 문파 직위(통산 판수) · 금고(경기 기록으로 계산) · 천하정세 · 상점
  await open(A, 'jeongpa', 1200);
  const rk = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const g = await import('/js/guild.js'); const id = Object.keys(S.store.data.players).find((x) => S.store.data.players[x].guild === 'j' && g.rankOf('j', x).lv < 5); const n = S.st.P[id].g, r = g.rankOf('j', id); const want = [...g.RANKS.j].reverse().find((x) => n >= x[0])[1]; return { ok: r.n === want, chips: document.querySelectorAll('.gm-c .gd-rk').length, n, r: r.n, want }; });
  ok(rk.ok && rk.chips >= 5, `문파 직위: 통산 ${rk.n}판 → ${rk.r}(기대 ${rk.want}), 길드원 카드마다 직위 표시`);
  const tw = (() => { const e = { win: 10, lose: 5, gwWin: 100, gwLose: 50 }, t0 = G().at, T = { j: 0, m: 0 };
    const at = (id, t) => { const lg = P()[id].glog || []; let g = ''; for (const x of lg) if (x.at <= t) g = x.g; return g || (lg.length ? '' : P()[id].guild); };
    const qk = (t) => { const d = new Date(t - 6 * 3600e3); return d.getFullYear() + 'Q' + Math.ceil((d.getMonth() + 1) / 3); }, cq = qk(Date.now());
    for (const m of Object.values(be.db.matches)) { if (m.deleted || !m.winner || m.at < t0) continue; const gs = { blue: m.blue.map((id) => at(id, m.at)), red: m.red.map((id) => at(id, m.at)) }; const one = (a) => (a.every((v) => v && v === a[0]) ? a[0] : ''); const bj = one(gs.blue), rj = one(gs.red);
      if (bj && rj && bj !== rj) { const w = m.winner === 'blue' ? bj : rj; T[w] += e.gwWin; T[w === 'j' ? 'm' : 'j'] -= e.gwLose; continue; }
      for (const sd of ['blue', 'red']) gs[sd].forEach((g) => { if (g) T[g] += m.winner === sd ? e.win : -e.lose; }); }
    return T; })();
  const tg = await A.evaluate(async () => { const t = (await import('/js/guild.js')).treasury(); return { j: t.j.bal, m: t.m.bal }; });
  ok(tg.j === tw.j && tg.m === tw.m, `금고: 일반 내전 승 +10·패 −5(1인당), 정마대전 승 +100·패 −50 = 따로 계산: 정파 ${tg.j} · 마교 ${tg.m}`);
  await open(A, 'guilds', 1500);
  const gxv = await A.evaluate(() => ({ rows: document.querySelectorAll('.wl-row').length, halves: [...document.querySelectorAll('.wl-row')].every((r) => r.querySelector('.wl-h.gd-j .gem, .wl-h.gd-j .wl-seal') && r.querySelector('.wl-h.gd-m .gem, .wl-h.gd-m .wl-seal')), gold: document.querySelector('[data-k=gold]')?.innerText || '', nav: [...document.querySelectorAll('#nav a')].map((a) => a.dataset.p).join() }));
  ok(gxv.rows >= 8 && gxv.halves && gxv.gold.includes('냥') && /guilds,jeongpa,magyo,gshop/.test(gxv.nav), `천하정세: 구역 ${gxv.rows}개 모두 왼쪽 정파·오른쪽 마교(엠블럼), 금고(냥) 공개, 메뉴 순서 천하정세·정파·마교·상점`);
  ok(await A.evaluate(() => !!document.querySelector('#nav a[data-p=jeongpa] .gem.nvg') && !!document.querySelector('#nav a[data-p=magyo] .gem.nvg')), '왼쪽 메뉴 정파·마교에 문파 엠블럼');
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { aq: { [(await import('/js/guild.js')).curQ()]: { j: 100000, m: 0 } } }); S.admin = true; }); await A.waitForTimeout(500);
  await open(A, 'gshop', 1500);
  const b0 = await A.evaluate(async () => (await import('/js/guild.js')).treasury().j.bal);
  await A.click('[data-a=gsBuy][data-i=feast][data-g=j]'); await A.waitForTimeout(1500);
  const b1 = await A.evaluate(async () => { const g = await import('/js/guild.js'); return { bal: g.treasury().j.bal, feast: g.fxOn('j', 'feast') }; });
  ok(b1.bal === b0 - 6000 && b1.feast && Object.values(be.db.gshop || {}).some((x) => x.item === 'feast' && x.g === 'j'), `상점: 관리자가 연회(6,000냥) 구매 → 금고 ${b0} → ${b1.bal}, 효과 켜짐, 구매 기록`);
  await open(A, 'jeongpa', 1200);
  ok(!!(await A.$('.gd-hero.feast .gd-lant')), '연회 효과: 정파 현판에 등불');
  const buyer = Object.keys(P()).find((id) => P()[id].guild === 'm');
  const bh = require('crypto').createHash('sha256').update(`naejeon:gacha:${buyer}:7777`).digest('hex'); be.seed('gacha', [{ id: buyer, pid: buyer, pinHash: bh }]);
  await A.evaluate(async (id) => { const { S } = await import('/js/core.js'); await S.store.patch('meta', 'guild', { lead: { m: id }, aq: { [(await import('/js/guild.js')).curQ()]: { j: 100000, m: 100000 } } }); S.admin = false; sessionStorage.clear(); localStorage.setItem('naejeon:me:' + S.key, id); }, buyer); await A.waitForTimeout(500);
  await open(A, 'gshop', 1500);
  ok(await A.evaluate(() => document.querySelector('[data-a=gsBuy][data-i=pill][data-g=j]').disabled && !document.querySelector('[data-a=gsBuy][data-i=pill][data-g=m]').disabled), '천마는 마교 금고만 쓸 수 있음(정파 버튼 잠김)');
  // 1280px에서는 열린 채팅창이 오른쪽을 덮어서 버튼을 직접 누름
  await A.evaluate(() => document.querySelector('[data-a=gsBuy][data-i=pill][data-g=m]').click()); await A.waitForSelector('#gpin-i');  await A.fill('#gpin-i', '7777'); await A.click('#gpin .btn'); await A.waitForTimeout(1500);
  ok(await A.evaluate(async () => (await import('/js/guild.js')).pill('m') === 1), '천마가 본인 PIN으로 영약 구매 → 마교 경지 보너스');
  // 채팅 길드 탭 테마(크리스마스 장식 대신 문파 테마)
  if (await A.evaluate(() => document.body.classList.contains('chat-closed'))) { await A.click('#chatfab'); await A.waitForTimeout(900); }
  await A.evaluate(() => document.querySelector('#ch-tabs [data-t=m]').click()); await A.waitForTimeout(500);
  ok(await A.evaluate(() => document.getElementById('chat').classList.contains('gt-m')), '채팅창 마교 탭: 마교 테마(gt-m)');
  // 대장만 남기기: 무림맹주·천마만 남고 나머지 무소속, 문파 기록은 다시 3명이 된 순간부터
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); S.admin = true; });
  await open(A, 'admin/guild', 1200);
  const leads = await A.evaluate(async () => { const { S } = await import('/js/core.js'); return S.store.data.meta.guild.lead; });
  await A.evaluate(() => document.querySelector('[data-a=gaReset]').click()); await A.waitForSelector('#gapin-i'); await A.fill('#gapin-i', '1234'); await A.click('#gapin .btn'); await A.waitForFunction(() => /무소속으로 바꿨어요/.test(document.getElementById('toast').innerText), null, { timeout: 20000 });
  const left = Object.values(P()).filter((p) => p.guild).map((p) => p.id).sort();
  ok(left.join() === Object.values(leads).filter(Boolean).sort().join(), '대장만 남기기: 무림맹주·천마만 소속, 나머지 무소속');
  const af0 = await A.evaluate(async () => { const { gActiveFrom } = await import('/js/core.js'); return [gActiveFrom('j'), gActiveFrom('m')]; });
  ok(af0.every((v) => v === null || v === Infinity), '소속 1~2명인 문파는 기록이 쌓이지 않음(시작 전)');
  const two = Object.keys(P()).filter((id) => !P()[id].guild && !P()[id].deleted).slice(0, 2);
  for (const id of two) { await A.evaluate((id) => document.querySelector(`[data-a=gaSet][data-id="${id}"][data-g=j]`).click(), id); await A.waitForTimeout(700); }
  const af1 = await A.waitForFunction(async () => { const { gActiveFrom } = await import('/js/core.js'); const v = gActiveFrom('j'); return v !== Infinity && v; }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => Infinity);
  ok(af1 > 0 && af1 !== Infinity, '관리자가 2명을 더 배정해 3명이 되면 그 순간부터 기록 시작');
  // 휴대폰
  const Mo = await client(b, be, 'WORK', 'Mo', { ctx: await device(b, be, 'WORK', 'Mo', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  for (const h of ['guilds', 'jeongpa', 'magyo', 'gshop', 'admin/guild', 'me']) { await open(Mo, h, 1300); const w = await Mo.evaluate(() => document.documentElement.scrollWidth); ok(w <= 361, `휴대폰(360px) ${h} 가로 넘침 없음(${w})`); }
  const errs = [...A.errs, ...B.errs, ...Mo.errs, ...C.errs, ...D2.errs]; console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
