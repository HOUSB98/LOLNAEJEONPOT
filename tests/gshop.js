// 문파 상점 점검: 관리자가 6가지 아이템을 모두 사 보고 효과가 실제로 보이는지(전서구 채팅 · 연회 등불 · 총애 칭호 · 도전장 표시 · 포고문 홈(다른 기기에서도) · 영약 경지),
// 금고가 값만큼 줄고 구매 기록이 남는지, 천하정세 '보유 아이템'에 모두 보이는지, 금고가 모자라면 못 사는지, 권한 없는 사람은 못 사는지, 휴대폰 상점 화면
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const A = await client(b, be, 'WORK', 'A'); A.on('dialog', (d) => d.accept());
  await open(A, 'rank', 900);
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); const g = await import('/js/guild.js'); await g.createGuilds(g.balance(Object.keys(S.store.data.players))); await S.store.patch('meta', 'guild', { aq: { [g.curQ()]: { j: 200000, m: 2000 } } }); localStorage.setItem('naejeon:pop:guild-open', '1'); S.admin = true; });
  await A.waitForTimeout(600);
  const bal = () => A.evaluate(async () => (await import('/js/guild.js')).treasury().j.bal);
  const b0 = await bal();
  await open(A, 'gshop', 1500);
  const buy = async (id) => { await A.evaluate((id) => document.querySelector(`[data-a=gsBuy][data-i=${id}][data-g=j]`).click(), id); await A.waitForTimeout(400); };
  // 전서구: 한 줄 입력 → 채팅 공지
  await buy('post'); await A.waitForSelector('#gsask-t'); await A.fill('#gsask-t', '오늘 밤 9시 집결'); await A.click('#gsask .btn'); await A.waitForTimeout(1200);
  ok(Object.values(be.db.chat).some((m) => /\[정파 전서구\] 오늘 밤 9시 집결/.test(m.t)), '전서구: 채팅에 정파 이름으로 공지');
  await buy('feast'); await A.waitForTimeout(900);
  await buy('favor'); await A.waitForSelector('.gs-pick button'); const fav = await A.$eval('.gs-pick button', (e) => e.dataset.id); await A.click('.gs-pick button'); await A.waitForTimeout(1200);
  await buy('chal'); await A.waitForTimeout(900);
  await buy('banner'); await A.waitForSelector('#gsask-t'); await A.fill('#gsask-t', '정파는 꺾이지 않는다'); await A.click('#gsask .btn'); await A.waitForTimeout(1200);
  await buy('pill'); await A.waitForTimeout(1200);
  const b1 = await bal(), spent = 3000 + 6000 + 10000 + 15000 + 20000 + 50000;
  ok(b0 - b1 === spent, `금고가 값만큼 줄어듦: ${b0} → ${b1}(−${spent})`);
  ok(Object.values(be.db.gshop || {}).length === 6 && (await A.$$eval('.gs-ul li', (x) => x.length)) === 6, '구매 기록 6건(상점 아래 목록)');
  // 효과 확인
  await open(A, 'jeongpa', 1500);
  const j = await A.evaluate((fav) => ({ lant: !!document.querySelector('.gd-hero.feast .gd-lant'), fav: !!document.querySelector(`.gm-c[href="#/players/${fav}"] .gd-tt.fav`), chal: (document.querySelector('.gw-chal')?.innerText || '').includes('도전장'), realm: document.querySelector('.gd-realm')?.title || '' }), fav);
  ok(j.lant, '연회: 정파 현판에 등불');
  ok(j.fav, '총애 하사: 고른 문도 카드에 맹주의 총애 칭호');
  ok(j.chal && Object.values(be.db.chat).some((m) => /정마대전 도전장/.test(m.t)), '도전장: 채팅 공지 + 대항전 칸에 표시');
  ok(/영약 10승/.test(j.realm), '영약: 경지 게이지에 +10승: ' + j.realm);
  const B = await client(b, be, 'WORK', 'B');
  await open(B, 'home', 1500); await B.evaluate(() => { document.querySelector('#modal.on [data-a=nppClose]')?.click(); });
  ok((await B.$eval('.gd-ban.g-j', (e) => e.innerText).catch(() => '')).includes('정파는 꺾이지 않는다'), '포고문: 다른 기기 홈 맨 위에도 보임');
  await open(A, 'guilds', 1500);
  const it = await A.$eval('[data-k=it] .wl-h.gd-j', (e) => e.innerText);
  ok(['연회', '포고문', '총애 하사', '도전장', '영약'].every((n) => it.includes(n)), '천하정세 보유 아이템에 정파 효과 5가지(남은 시간) 표시');
  // 금고가 모자라면 못 삼(마교 2,000냥)
  await open(A, 'gshop', 1200);
  ok(await A.evaluate(() => document.querySelector('[data-a=gsBuy][data-i=post][data-g=m]').disabled), '마교 금고(2,000냥) < 전서구(3,000냥): 버튼 잠김');
  const m0 = Object.keys(be.db.gshop).length; await A.evaluate(() => { const b = document.querySelector('[data-a=gsBuy][data-i=post][data-g=m]'); b.disabled = false; b.click(); }); await A.waitForTimeout(700);
  ok(Object.keys(be.db.gshop).length === m0 && !(await A.$('#gsask-t')), '억지로 눌러도 금고 부족이면 사지 않음');
  // 권한 없는 사람(관리자 아님, 문파장 아님)
  await B.evaluate(async () => { const { S } = await import('/js/core.js'); localStorage.setItem('naejeon:me:' + S.key, Object.keys(S.store.data.players)[3]); });
  await open(B, 'gshop', 1200);
  ok(await B.$$eval('[data-a=gsBuy]', (x) => x.every((e) => e.disabled)), '관리자·문파장이 아니면 모든 구매 버튼 잠김');
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  for (const h of ['gshop', 'guilds']) { await open(M, h, 1300); const w = await M.evaluate(() => document.documentElement.scrollWidth); ok(w <= 361, `휴대폰 ${h} 가로 넘침 없음(${w})`); }
  const errs = [...A.errs, ...B.errs, ...M.errs]; console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
