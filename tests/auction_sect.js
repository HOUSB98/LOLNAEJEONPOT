// 인재 쟁탈전(문파원 경매): 익명 경매와 같고 팀 인원 제한만 없음 · 팀 이름 = 대장 문파 · 빈 자리 줄 없음 · 한 팀이 4명 넘게 영입 가능
const { chromium } = require('playwright'); const { makeSeed, client, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  seed.auctions = [];
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const H = await client(b, be, 'WORK', 'H'); H.on('dialog', (d) => d.accept()); await H.setViewportSize({ width: 1280, height: 900 }); await open(H, 'home', 500);
  // 문파 창설 + 대장 둘을 정파·마교로
  const ids = await H.evaluate(async () => { const { S } = await import('/js/core.js'); const g = await import('/js/guild.js'); S.admin = true; const ids = S.st.list.slice(0, 12).map((s) => s.id); await g.createGuilds(g.balance(Object.keys(S.store.data.players))); await S.store.patch('players', ids[0], { guild: 'j' }); await S.store.patch('players', ids[1], { guild: 'm' }); localStorage.setItem('naejeon:pop:guild-open2', '1'); return ids; });
  await H.evaluate(() => (location.hash = '#/auction')); await H.waitForTimeout(900);
  for (const id of ids.slice(0, 2)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="2"]`);
  for (const id of ids.slice(2, 12)) await H.click(`[data-a=auRole][data-id="${id}"][data-r="1"]`);
  ok(!!(await H.$('.au-mode.m-sect')) && /인재 쟁탈전/.test(await H.$eval('.au-mode.m-sect', (e) => e.innerText)), "경매 방식에 '인재 쟁탈전' 카드");
  await H.click('.au-mode.m-sect'); await H.waitForTimeout(300);
  ok(await H.evaluate(() => document.querySelector('.au-mode.m-sect').classList.contains('on') && !document.querySelector('.au-mode.m-blind').classList.contains('on') && /제한 없음/.test(document.querySelector('.au-sum').innerText)), '선택하면 익명 경매와 구분돼 켜지고 필요 인원 = 제한 없음');
  await H.click('[data-a=auCreate]'); await H.waitForTimeout(1200);
  const rid = await H.evaluate(() => location.hash.split('/')[2]), R = () => be.db.auctions[rid];
  ok(R().cfg.blind === true && R().cfg.sect === true && R().cfg.size === 99 && Object.keys(R().alias).length === 10, '방 설정: 익명(별칭 10명) + 인재 쟁탈전 + 인원 제한 없음');
  ok(R().teams.map((t) => t.name).join() === '정파,마교', '팀 이름 = 대장 문파(정파·마교)');
  ok(/인재 쟁탈전/.test(await H.$eval('#main', (e) => e.innerText)), '대기실에 인재 쟁탈전 안내');
  // 한 팀이 5명 이상 영입한 상태를 만들어 화면 확인(빈 자리 줄 없음·영입 인원 표시)
  await H.evaluate(async (rid) => { const { S } = await import('/js/core.js'); const r = S.store.data.auctions[rid]; const t0 = { ...r.teams[0], members: r.pool.slice(0, 6).map((pid) => ({ pid, price: 10 })), points: 940 }; await S.store.patch('auctions', rid, { teams: [t0, r.teams[1]], pool: r.pool.slice(6), status: 'running' }); }, rid);
  await H.waitForTimeout(900);
  const v = await H.evaluate(() => ({ emp: document.querySelectorAll('.kv.emp').length, foot: [...document.querySelectorAll('.au-tf')].map((e) => e.innerText.replace(/\s+/g, ' ')), note: '' }));
  ok(v.emp === 0 && /영입 6명/.test(v.foot.join('|')), '진행 화면: 빈 자리 줄 없음 · 한 팀 6명 영입(제한 없음): ' + JSON.stringify(v.foot));
  console.log('오류:', H.errs.join(' | ') || '없음'); ok(!H.errs.length, '페이지 오류 없음');
  await b.close();
})();
