// 여러 기기 동시 접속 시험 도구: tree('WORK' 또는 git 커밋)의 사이트를 Firebase 모드(?k=test)로 띄우고 가짜 Firestore(backend)에 붙인다.
const { chromium } = require('playwright'); const { execSync } = require('child_process'); const fs = require('fs'), path = require('path');
const { Backend } = require('./backend');
const REPO = process.env.REPO || path.join(__dirname, '..'); // 기본: 이 저장소(REPO=다른 폴더 로 옛 버전과 비교 가능)
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PNG = fs.readFileSync(path.join(REPO, 'og.png'));
const gitCache = {};
const file = (tree, f) => { if (tree === 'WORK') { const p = path.join(REPO, f); return fs.existsSync(p) ? fs.readFileSync(p) : null; } const k = tree + ':' + f; if (!(k in gitCache)) { try { gitCache[k] = execSync(`git -C ${REPO} show ${tree}:${f}`, { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { gitCache[k] = null; } } return gitCache[k]; };
async function makeSeed(browser) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  await ctx.route('https://site.test/**', (r) => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  const p = await ctx.newPage(); await p.goto('https://site.test/'); await p.evaluate(require('./seed.js'));
  const out = await p.evaluate(() => Object.fromEntries(['players', 'matches', 'chat', 'posts'].map((c) => [c, Object.values(JSON.parse(localStorage.getItem('naejeon:local:' + c) || '{}'))])));
  await ctx.close();
  const now = Date.now();
  out.matches.forEach((m) => (m.upd = { __ts: m.at }));
  out.meta = [{ id: 'settings', leagueName: '시험 리그' }, { id: 'luck', miss: {} }, { id: 'scorelog', items: [] }, { id: 'kicks' }];
  out.presence = Array.from({ length: 30 }, (_, i) => ({ id: 'dev' + i, nick: '예전기기' + i, at: now - (i < 3 ? i * 60e3 : 20 * 60e3 + i * 40 * 60e3) }));
  const ids = out.players.map((p) => p.id);
  out.auctions = Array.from({ length: 12 }, (_, i) => ({ id: 'au' + i, name: '경매 ' + i, createdAt: now - i * 864e5, status: 'lobby', host: 'h' + i, deleted: i % 5 === 4,
    cfg: { points: 1000, unit: 10, sec: 15, ext: 5, size: 5, hide: false, mode: 'live' },
    teams: [0, 1].map((t) => ({ name: '팀' + t, captain: ids[t], token: 'tk' + t, points: 1000, members: [] })), pool: ids.slice(2, 10), unsold: [], round: 1, cur: null, log: [], chat: [] }));
  return out;
}
async function device(browser, be, tree, name) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 } });
  await ctx.route(/workers\.dev|ddragon|fonts\.|jsdelivr|communitydragon/, (r) => r.fulfill({ status: 404, body: '' })); // 진짜 연동 서버로는 절대 보내지 않는다
  await be.attach(ctx, () => name);
  await ctx.route('https://site.test/**', (r) => { const u = new URL(r.request().url()); let f = decodeURIComponent(u.pathname).replace(/^\//, '') || 'index.html'; const b = file(tree, f); if (!b) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: b, headers: { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' } }); });
  ctx.devName = name; return ctx;
}
async function client(browser, be, tree, name, opts = {}) {
  const ctx = opts.ctx || await device(browser, be, tree, name);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message.slice(0, 160)));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) p.errs.push('console: ' + m.text().slice(0, 160)); });
  if (opts.clock) await p.clock.install(opts.clock === true ? {} : opts.clock);
  await p.addInitScript((n) => { if (location.origin !== 'https://site.test') return; localStorage.setItem('naejeon:nick', n); localStorage.setItem('naejeon:lite', '1'); sessionStorage.setItem('naejeon:welcomed', '1'); localStorage.setItem('naejeon:welcomed', '1'); localStorage.setItem('naejeon:chatclosed', '1'); }, name);
  p.ctx = ctx; p.name = name;
  return p;
}
// 화면 열기: 가짜 Firestore 의 첫 전달이 가끔 늦어 화면이 안 열릴 때가 있어, 15초 안에 안 열리면 한 번 새로 연다(새로 열었으면 기록에 남김)
const ready = (p, ms) => p.waitForFunction(() => window.NP_OK && document.querySelector('#presence .prh') && (document.getElementById('main').innerText || '').length > 50, null, { timeout: ms });
const open = async (p, hash = 'home', wait = 800) => {
  await p.goto('https://site.test/?k=test#/' + hash);
  if (!(await ready(p, 15000).then(() => true).catch(() => false))) { console.log(`   (${p.name || ''} 화면이 15초 안에 안 열려 새로 엶)`); await p.goto('https://site.test/?k=test#/' + hash); await ready(p, 30000); }
  if (wait) await p.waitForTimeout(wait);
};
module.exports = { makeSeed, device, client, open, Backend, REPO };
