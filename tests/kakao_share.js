// 카카오톡 공유: 왼쪽 위 '내전 모집'(오늘 내전 사람 구하기, 휴대폰은 메뉴 창), 경기 상세·오늘 방금 기록한 경기·경매 결과에 노란 '카톡 공유' 버튼. 누르면 카드(제목·설명·대표 그림·사이트 버튼)로 공유.
// 링크에는 초대 코드(?k=)와 화면 주소만(경매는 관전 주소만, 팀장 토큰 없음). 카카오 SDK를 못 받으면 글 복사로 대신. 실제 카카오 서버로는 보내지 않음(시험에서 막음)
const { chromium } = require('playwright'); const { makeSeed, client, device, open, Backend } = require('./harness');
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const seed = await makeSeed(b);
  const be = new Backend(); for (const [c, d] of Object.entries(seed)) be.seed(c, d);
  const errs = [];
  const stub = () => { window.__kk = []; window.Kakao = { _i: false, isInitialized() { return this._i; }, init(k) { this._i = true; window.__kkKey = k; }, Share: { sendDefault(o) { window.__kk.push(o); } } }; };
  const A = await client(b, be, 'WORK', 'A'); await A.addInitScript(stub);
  // 1) 왼쪽 위 '내전 시작' 옆 '내전 모집'(반씩), 랭킹에는 공유 버튼 없음
  await open(A, 'rank', 800);
  ok(!(await A.$('#main [data-a=kkShare]')), '랭킹 화면에는 카톡 공유 버튼 없음');
  const side = await A.evaluate(() => { const g = document.querySelector('#side .side-cta>a.btn.gold'), k = document.querySelector('#side .side-cta .kk-side'); if (!g || !k) return null; const a = g.getBoundingClientRect(), c = k.getBoundingClientRect(); return { gw: a.width, kw: c.width, same: Math.abs(a.top - c.top) < 2, bg: getComputedStyle(k).backgroundColor, t: k.innerText.trim(), g: g.innerText.trim() }; });
  ok(side && side.same && Math.abs(side.gw - side.kw) < 4 && side.bg === 'rgb(254, 229, 0)' && side.t === '내전 모집' && side.g === '내전 시작', '왼쪽 위: 내전 시작 · 내전 모집(노란 카톡)이 한 줄에 반씩: ' + JSON.stringify(side));
  ok(!(await A.evaluate(() => [...document.scripts].some((x) => /kakao_js_sdk/.test(x.src)))), '버튼만 있을 때는 카카오 프로그램을 받지 않음');
  // 내전 모집 → 시간 정하기 창 → 저장하고 카톡으로 보내기
  await A.click('#side .kk-side'); await A.waitForTimeout(600);
  await A.click('#main [data-a=rcOpen]'); await A.waitForTimeout(400);
  await A.click('#modal.on [data-a=rcTime][data-v="22:00"]');
  await A.click('#modal.on [data-a=rcShare]'); await A.waitForTimeout(900);
  const r1 = await A.evaluate(() => ({ o: window.__kk[0], key: window.__kkKey }));
  ok(r1.key === '6316315a1de926afd006fa59bc5bcf1c' && r1.o?.objectType === 'feed' && /^(오늘|내일) 오후 10:00 내전 하실 분!$/.test(r1.o.content.title) && /\d+월 \d+일 \([일월화수목금토]\) 오후 10:00 시작/.test(r1.o.content.description) && !/지원:|명 지원|더 필요/.test(r1.o.content.description) && /사이트에서 '참가'해 주세요/.test(r1.o.content.description), '모집 카드: 시간만(지원 인원·지원자는 넣지 않음): ' + JSON.stringify(r1.o?.content));
  ok(/\/og\.png$/.test(r1.o.content.imageUrl) && /\?k=test#\/recruit\/join$/.test(r1.o.content.link.webUrl) && r1.o.buttons[0].title === '참가하러 가기' && r1.o.buttons[0].link.mobileWebUrl === r1.o.content.link.webUrl, '버튼 "참가하러 가기" → 초대 코드 + 내전 모집 화면(이름 고르기 창)');
  await A.evaluate(() => (window.__kk = []));
  // 2) 경기 상세
  await open(A, 'matches', 800);
  await A.evaluate(() => document.querySelector('[data-a=matchDetail]')?.click()); await A.waitForTimeout(600);
  ok(!!(await A.$('#modal.on .md-act [data-a=kkShare][data-t=match]')), '경기 상세에 카톡 공유 버튼');
  await A.click('#modal.on [data-a=kkShare]'); await A.waitForTimeout(400);
  const m = await A.evaluate(() => window.__kk[0]);
  ok(/^경기 #\d+ · (블루|레드) 승리/.test(m?.content.title) && /블루: .+\n레드: .+/.test(m.content.description) && /#\/matches$/.test(m.content.link.webUrl), '경기 카드: 번호·승리 팀·두 팀 라인업: ' + m?.content.title);
  // 3) 경매 결과(끝난 방): 관전 링크만
  const rid = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const r = Object.values(S.store.data.auctions || {})[0]; return r?.id; });
  await A.evaluate(async () => { const { S } = await import('/js/core.js'); await S.store.need('auctions'); });
  const anyId = await A.evaluate(async () => { const { S } = await import('/js/core.js'); const r = Object.values(S.store.data.auctions).find((x) => !x.deleted); await S.store.patch('auctions', r.id, { status: 'done' }); return r.id; });
  await A.evaluate((id) => (location.hash = '#/auction/' + id), anyId); await A.waitForTimeout(1200);
  const ab = await A.$('[data-a=kkShare][data-t=auction]');
  ok(!!ab, '끝난 경매에 "카톡으로 결과 공유" 버튼');
  if (ab) { await ab.click(); await A.waitForTimeout(600); }
  const au = await A.evaluate(() => window.__kk[window.__kk.length - 1]);
  ok(/경매 결과$/.test(au?.content.title || '') && new RegExp(`#/auction/${anyId}$`).test(au.content.link.webUrl) && !/tk\d/.test(au.content.link.webUrl + au.content.description), '경매 카드: 팀별 명단, 링크는 관전 주소(팀장 토큰 없음)');
  errs.push(...A.errs);
  // 4) 카카오 SDK를 못 받으면(막힘) 글 복사로 대신
  const B = await client(b, be, 'WORK', 'B', { ctx: await device(b, be, 'WORK', 'B', { permissions: ['clipboard-read', 'clipboard-write'] }) });
  await open(B, 'home', 800);
  await B.click('#side .kk-side'); await B.waitForTimeout(600); await B.click('#main [data-a=rcShare]'); await B.waitForTimeout(1800);
  const clip = await B.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/내전 하실 분/.test(clip) && /\?k=test#\/recruit\/join/.test(clip), '카카오를 못 열면 공유할 글을 복사(단톡방에 붙여 넣기)');
  ok(/카카오톡을 열 수 없어/.test(await B.$eval('#toast', (e) => e.textContent).catch(() => '')), '복사했다고 안내');
  errs.push(...B.errs.filter((e) => !/kakao/i.test(e)));
  // 5) 휴대폰: 메뉴(더보기) 창 아래쪽에 모집 버튼
  const M = await client(b, be, 'WORK', 'M', { ctx: await device(b, be, 'WORK', 'M', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }) });
  await M.addInitScript(stub); await open(M, 'home', 800);
  await M.tap('#tabbar [data-p=more]'); await M.waitForTimeout(600);
  ok(await M.evaluate(() => { const e = document.querySelector('#modal.on .mm-foot a.kk-btn'); return !!e && /내전 모집/.test(e.innerText); }), '휴대폰: 메뉴 창 아래에 "내전 모집 (카톡)"');
  const ft = await M.evaluate(() => { const f = document.querySelector('#modal.on .mm-foot'), k = f.querySelector('.kk-btn'), o = [...f.children].filter((e) => e !== k).map((e) => e.getBoundingClientRect()); const kr = k.getBoundingClientRect(), fr = f.getBoundingClientRect(); return { kFull: Math.abs(kr.width - fr.width) < 2, kTop: o.every((r) => r.top >= kr.bottom), sameH: new Set(o.map((r) => Math.round(r.height))).size === 1, overlap: o.some((a, i) => o.some((b, j) => i < j && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)), grad: /gradient/.test(getComputedStyle(k).backgroundImage) }; });
  ok(ft.kFull && ft.kTop && ft.sameH && !ft.overlap && ft.grad, '휴대폰 메뉴 창 아래: 모집 버튼 맨 위 한 줄 전체(고급형 그라데이션), 나머지는 같은 높이·겹침 없음: ' + JSON.stringify(ft));
  await M.tap('#modal.on .mm-foot a.kk-btn'); await M.waitForTimeout(800);
  ok(await M.evaluate(() => location.hash === '#/recruit' && !document.querySelector('#modal.on')), '누르면 메뉴가 닫히고 내전 모집 화면으로');
  await M.tap('#main [data-a=rcShare]'); await M.waitForTimeout(900);
  ok(await M.evaluate(() => /내전 하실 분!$/.test(window.__kk[0]?.content.title || '')), '휴대폰에서도 시간 정하기 → 같은 모집 카드');
  ok(await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '휴대폰 가로 넘침 없음');
  await open(M, 'matches', 800); await M.evaluate(() => document.querySelector('[data-a=matchDetail]')?.click()); await M.waitForTimeout(600);
  const md = await M.evaluate(() => { const f = document.querySelector('#modal.on .md-act'), fr = f.getBoundingClientRect(), bs = [...f.querySelectorAll(':scope>.btn')].map((e) => e.getBoundingClientRect()); return { n: bs.length, row1: Math.abs(bs[0].top - bs[1].top) < 2 && Math.abs(bs[0].width - bs[1].width) < 2 && Math.abs(bs[0].left - fr.left) < 2, last: bs.length % 2 ? Math.abs(bs.at(-1).width - fr.width) < 2 : true, gap: bs[1].left - bs[0].right }; });
  ok(md.n >= 2 && md.row1 && md.last && md.gap >= 6, '휴대폰 경기 상세: 카톡 공유·진영 바꾸기 같은 너비 두 칸(왼쪽부터, 간격 있음), 남는 버튼은 한 줄 전체: ' + JSON.stringify(md));
  errs.push(...M.errs);
  // 로딩창 아래 'Works with KakaoTalk'(작게, 가운데, 입장 안내 위)
  const Sp = await client(b, be, 'WORK', 'S'); await Sp.addInitScript(() => sessionStorage.removeItem('naejeon:welcomed'));
  await Sp.goto('https://site.test/?k=test#/home'); await Sp.waitForFunction(() => { const e = document.querySelector('#splash .sp-collab'); return e && +getComputedStyle(e).opacity > 0.95; }, null, { timeout: 15000 }).catch(() => {});
  const sp = await Sp.evaluate(() => { const e = document.querySelector('#splash .sp-collab'), k = document.querySelector('#splash .sp-skip'); if (!e) return null; const r = e.getBoundingClientRect(), q = k.getBoundingClientRect(); return { t: e.innerText.replace(/\s+/g, ' ').trim(), op: +getComputedStyle(e).opacity, h: Math.round(r.height), mid: Math.abs(r.x + r.width / 2 - innerWidth / 2) < 2, above: r.bottom <= q.top, kk: getComputedStyle(e.querySelector('.sp-kk')).backgroundColor }; });
  ok(sp && sp.t === 'WORKS WITH KakaoTalk' && sp.op > 0.95 && sp.h <= 40 && sp.mid && sp.above && sp.kk === 'rgb(254, 229, 0)', '로딩창: 작은 "Works with KakaoTalk"(카카오 노랑 아이콘)가 가운데·입장 안내 위에: ' + JSON.stringify(sp));
  errs.push(...Sp.errs);
  console.log('오류:', errs.join(' | ') || '없음'); ok(!errs.length, '페이지 오류 없음');
  await b.close();
})();
