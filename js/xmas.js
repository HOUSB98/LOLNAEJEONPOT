// 시즌 장식(크리스마스): 매년 11/16 ~ 12/26 에만 자동으로 켜진다. 인사말 같은 글자는 넣지 않는다.
//  - 화면 위 금빛 갈랜드(늘어진 전선 + 유리 전구), 눈송이(작은 눈 + 흐린 큰 눈), 모서리 서리, 로고 산타 모자, 반짝이 색
//  - 채팅창 뒤 고급 트리: 11/16부터 하루마다 장식이 하나씩 늘고 12/25에 별이 달려 완성된다(새 장식은 반짝임)
//  - 시작(로딩) 화면: 달이 뜬 눈 내리는 밤하늘을 루돌프와 산타 썰매가 금빛 가루를 흩뿌리며 가로지른다(동화풍 벡터 그림)
// 장식이 싫으면 사이드바(모바일은 더보기)의 '시즌 장식' 버튼으로 끈다(naejeon:xmas = '0').
import { act, toast, moreHooks } from './core.js';

const START = [11, 16], STAR_DAY = [12, 25], END = [12, 26];
const KEY = 'naejeon:xmas';
const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
export const inSeason = (d = new Date()) => md(d) >= START[0] * 100 + START[1] && md(d) <= END[0] * 100 + END[1];
export const xmasOn = () => inSeason() && localStorage.getItem(KEY) !== '0';
const calm = () => document.body.classList.contains('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;

function progress(now = new Date()) {
  const y = now.getFullYear(), day = 864e5;
  const s = new Date(y, START[0] - 1, START[1]), x = new Date(y, STAR_DAY[0] - 1, STAR_DAY[1]);
  const t = new Date(y, now.getMonth(), now.getDate());
  return { d: Math.max(0, Math.round((t - s) / day)), total: Math.round((x - s) / day) };
}

// ---------- 트리 (그리는 순서 = 하루에 하나씩 나타나는 순서) ----------
const DEFS = `<defs>
  <radialGradient id="xtHalo" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset=".6" stop-color="#ffb347" stop-opacity=".12"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  <linearGradient id="xtLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fa86a"/><stop offset=".45" stop-color="#1f7a48"/><stop offset="1" stop-color="#0d4227"/></linearGradient>
  <linearGradient id="xtLeafHi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9be3b4" stop-opacity=".55"/><stop offset=".35" stop-color="#9be3b4" stop-opacity="0"/></linearGradient>
  <linearGradient id="xtGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c2"/><stop offset=".4" stop-color="#e9b949"/><stop offset=".7" stop-color="#b57d1f"/><stop offset="1" stop-color="#f7d778"/></linearGradient>
  <linearGradient id="xtTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a2c15"/><stop offset=".5" stop-color="#7a4a24"/><stop offset="1" stop-color="#3a210f"/></linearGradient>
  <radialGradient id="xbRed" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ff9a8f"/><stop offset=".35" stop-color="#d42a2a"/><stop offset="1" stop-color="#6e0d12"/></radialGradient>
  <radialGradient id="xbGold" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff6cf"/><stop offset=".35" stop-color="#e3b23c"/><stop offset="1" stop-color="#7a5310"/></radialGradient>
  <radialGradient id="xbBlue" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#b9d4ff"/><stop offset=".35" stop-color="#2f5fd0"/><stop offset="1" stop-color="#0f2257"/></radialGradient>
  <radialGradient id="xbPearl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e8e2d8"/><stop offset="1" stop-color="#9c9284"/></radialGradient>
  <radialGradient id="xtStarG" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#fffbe6"/><stop offset=".5" stop-color="#ffd76a"/><stop offset="1" stop-color="#d99a1e"/></radialGradient>
  <filter id="xtGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <linearGradient id="xgRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0413a"/><stop offset="1" stop-color="#8e1717"/></linearGradient>
  <linearGradient id="xgGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f9a5e"/><stop offset="1" stop-color="#115230"/></linearGradient>
  <linearGradient id="xgNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b5bb5"/><stop offset="1" stop-color="#16285e"/></linearGradient>
</defs>`;
// 가지 한 단: 아래쪽이 물결 모양으로 늘어진 삼각형 + 왼쪽 하이라이트
const tier = (top, bot, half) => {
  const l = 120 - half, r = 120 + half, n = 5, w = (r - l) / n;
  let wave = ''; for (let i = 0; i < n; i++) wave += ` Q${r - w * i - w / 2} ${bot + 9} ${r - w * (i + 1)} ${bot}`;
  const d = `M120 ${top} L${r} ${bot}${wave} Z`;
  return `<path d="${d}" fill="url(#xtLeaf)"/><path d="${d}" fill="url(#xtLeafHi)"/><path d="M120 ${top} L${l + 6} ${bot - 2}" stroke="#a6e8c0" stroke-opacity=".25" stroke-width="1.200"/>`;
};
const bauble = (x, y, g, r = 7) => `<g><path d="M${x - 2} ${y - r - 2}h4v3h-4z" fill="#d8b25a"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.38}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity=".75" transform="rotate(-30 ${x - r * 0.35} ${y - r * 0.38})"/></g>`;
const bulbs = (pts) => `<g class="xt-lights">${pts.map(([x, y, c], i) => `<g style="--i:${i}"><circle cx="${x}" cy="${y}" r="5" fill="${c}" opacity=".45" filter="url(#xtGlow)"/><circle cx="${x}" cy="${y}" r="2.200" fill="#fffbe8"/></g>`).join('')}</g>`;
const gift = (x, y, w, h, g, rib) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.500" fill="url(#${g})"/><rect x="${x}" y="${y}" width="${w}" height="${h * 0.22}" fill="#fff" opacity=".1"/><rect x="${x + w / 2 - 2.500}" y="${y}" width="5" height="${h}" fill="${rib}"/><path d="M${x + w / 2} ${y}c-9-10-17-3-9 0zM${x + w / 2} ${y}c9-10 17-3 9 0z" fill="${rib}" stroke="#00000033"/></g>`;
function treeParts() {
  const P = [];
  P.push(`<ellipse cx="120" cy="190" rx="120" ry="150" fill="url(#xtHalo)"/>`); // 0 은은한 빛
  P.push(`<path d="M106 286h28l4 30h-36z" fill="url(#xtTrunk)"/><ellipse cx="120" cy="318" rx="70" ry="9" fill="#e9f1ff" opacity=".55"/>`); // 줄기 + 눈 쌓인 바닥
  P.push(tier(196, 292, 100));
  P.push(tier(140, 236, 80));
  P.push(tier(92, 180, 60));
  P.push(tier(52, 124, 40));
  // 금빛 리본(사선으로 감기는 띠)
  P.push(`<path d="M48 284 C90 300 150 300 196 268" stroke="url(#xtGold)" stroke-width="6" fill="none" stroke-linecap="round"/>`);
  P.push(`<path d="M62 226 C100 240 150 238 182 212" stroke="url(#xtGold)" stroke-width="5.500" fill="none" stroke-linecap="round"/>`);
  P.push(`<path d="M76 172 C104 184 140 182 164 160" stroke="url(#xtGold)" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  P.push(`<path d="M92 120 C110 128 132 127 148 112" stroke="url(#xtGold)" stroke-width="4.500" fill="none" stroke-linecap="round"/>`);
  // 장식 공(빨강·금·파랑·진주)
  const B = [[70, 270, 'xbRed', 8], [168, 262, 'xbGold', 8], [118, 292, 'xbBlue', 8], [96, 252, 'xbPearl', 7], [146, 286, 'xbRed', 7], [186, 286, 'xbPearl', 6.5], [52, 292, 'xbGold', 6.5],
    [88, 214, 'xbGold', 7.500], [150, 206, 'xbRed', 7.500], [118, 230, 'xbPearl', 7], [70, 230, 'xbBlue', 6.500], [172, 232, 'xbBlue', 6.500], [104, 196, 'xbRed', 6],
    [100, 158, 'xbBlue', 7], [142, 152, 'xbGold', 7], [122, 174, 'xbRed', 6.500], [84, 174, 'xbPearl', 6], [158, 176, 'xbPearl', 6],
    [112, 106, 'xbGold', 6], [132, 116, 'xbRed', 5.500], [100, 124, 'xbPearl', 5.500], [122, 86, 'xbBlue', 5]];
  B.forEach(([x, y, g, r]) => P.push(bauble(x, y, g, r)));
  // 전구 줄(따뜻한 빛, 반짝임)
  P.push(bulbs([[58, 262, '#ffcf6b'], [80, 278, '#ff8a7a'], [104, 284, '#ffcf6b'], [130, 280, '#9fd4ff'], [156, 272, '#ffcf6b'], [180, 256, '#ff8a7a']]));
  P.push(bulbs([[72, 206, '#9fd4ff'], [94, 220, '#ffcf6b'], [120, 222, '#ff8a7a'], [146, 216, '#ffcf6b'], [168, 200, '#9fd4ff']]));
  P.push(bulbs([[86, 152, '#ffcf6b'], [108, 166, '#ff8a7a'], [132, 164, '#ffcf6b'], [154, 150, '#9fd4ff'], [98, 104, '#ffcf6b'], [118, 112, '#9fd4ff'], [140, 102, '#ff8a7a']]));
  // 선물 상자
  P.push(gift(30, 296, 34, 26, 'xgRed', '#f2cf7a'));
  P.push(gift(170, 290, 40, 32, 'xgGreen', '#f4efe6'));
  P.push(gift(136, 302, 28, 20, 'xgNavy', '#f2cf7a'));
  P.push(gift(66, 304, 24, 18, 'xgGreen', '#e04a3f'));
  // 별(크리스마스 당일)
  P.push(`<g class="xt-star"><circle cx="120" cy="40" r="26" fill="#ffd76a" opacity=".55" filter="url(#xtGlow)"/><path d="M120 12 127.500 31 148 32 132 44.500 137.500 64 120 53 102.500 64 108 44.500 92 32 112.500 31z" fill="url(#xtStarG)" stroke="#fff6cf" stroke-width="1.500"/><path d="M120 2v8M120 70v8M86 40h8M146 40h8" stroke="#fff3c4" stroke-width="1.500" stroke-linecap="round" opacity=".8"/></g>`);
  return P;
}
function treeSVG() {
  const parts = treeParts(), { d, total } = progress();
  const n = d >= total ? parts.length : Math.min(parts.length - 1, 2 + Math.floor((d / total) * (parts.length - 2)));
  const key = 'naejeon:xtree', seen = +localStorage.getItem(key) || 0;
  try { localStorage.setItem(key, String(n)); } catch {}
  return `<svg viewBox="0 0 240 330" aria-hidden="true">${DEFS}${parts.slice(0, n).map((p, i) => `<g class="xt-p ${seen && i >= seen ? 'xt-new' : ''}">${p}</g>`).join('')}</svg>`;
}

// ---------- 눈(작은 눈 + 가끔 흐린 큰 눈) ----------
let snowStop = null;
function snowCanvas(cv, opts = {}) {
  const g = cv.getContext('2d'); let W = 0, H = 0, flakes = [], last = 0, raf = 0;
  const host = opts.host || window, count = opts.count || 80; let glints = [];
  const size = () => (host === window ? [innerWidth, innerHeight] : [host.clientWidth, host.clientHeight]);
  const mk = (any) => { const big = Math.random() < 0.08; return { x: Math.random() * W, y: any ? Math.random() * H : -10, r: big ? 3 + Math.random() * 3 : 0.7 + Math.random() * 1.8, v: big ? 0.6 + Math.random() * 0.6 : 0.25 + Math.random() * 0.7, w: Math.random() * 6.28, a: big ? 0.25 : 0.4 + Math.random() * 0.5, big }; };
  const mkG = () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6.28, s: 0.6 + Math.random() * 0.9, r: 2 + Math.random() * 3.500, vy: 0.1 + Math.random() * 0.25, c: Math.random() < 0.6 ? '255,226,140' : '255,255,255' });
  const fit = () => { [W, H] = size(); cv.width = W; cv.height = H; flakes = Array.from({ length: Math.round(Math.min(count, W / 18)) }, () => mk(true)); glints = opts.glint ? Array.from({ length: Math.round(Math.min(opts.glint, W / 60)) }, mkG) : []; };
  fit(); addEventListener('resize', fit);
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; last = t;
    if (!opts.always && (document.body.classList.contains('lite') || document.body.classList.contains('idle') || document.hidden)) { g.clearRect(0, 0, W, H); return; }
    g.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.v; f.w += 0.02; f.x += Math.sin(f.w) * 0.4;
      if (f.y > H + 8) Object.assign(f, mk(false));
      g.globalAlpha = f.a; g.fillStyle = '#fff';
      if (f.big) { g.shadowColor = '#fff'; g.shadowBlur = 8; } else g.shadowBlur = 0;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.283); g.fill();
    }
    // 요정 가루: 네 갈래 반짝임이 천천히 떠다니며 깜빡인다
    for (const k of glints) {
      k.y -= k.vy; k.p += 0.05 * k.s; if (k.y < -10) Object.assign(k, mkG(), { y: H + 10 });
      const a = Math.max(0, Math.sin(k.p)); if (a < 0.05) continue;
      const r = k.r * (0.6 + 0.4 * a); g.globalAlpha = a; g.fillStyle = `rgb(${k.c})`; g.shadowColor = `rgb(${k.c})`; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(k.x, k.y - r * 2); g.quadraticCurveTo(k.x, k.y, k.x + r * 2, k.y); g.quadraticCurveTo(k.x, k.y, k.x, k.y + r * 2); g.quadraticCurveTo(k.x, k.y, k.x - r * 2, k.y); g.quadraticCurveTo(k.x, k.y, k.x, k.y - r * 2); g.fill();
    }
    g.globalAlpha = 1; g.shadowBlur = 0;
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
}

// ---------- 갈랜드(늘어진 전선 + 유리 전구) ----------
const BULB = ['#ff5a4e', '#ffd36a', '#4fd08b', '#7fb2ff', '#ff9ad5'];
function garland() {
  let el = document.getElementById('xlights');
  if (!el) { el = document.createElement('div'); el.id = 'xlights'; document.body.appendChild(el); }
  const seg = innerWidth < 600 ? 46 : 64, n = Math.ceil(innerWidth / seg) + 1;
  el.innerHTML = `<svg width="${n * seg}" height="22" viewBox="0 0 ${n * seg} 22" aria-hidden="true"><defs><radialGradient id="xlG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="#fff" stop-opacity=".1"/></radialGradient></defs>
    <path d="${Array.from({ length: n }, (_, i) => `${i ? '' : 'M0 2 '}Q${i * seg + seg / 2} 12 ${(i + 1) * seg} 2`).join(' ')}" stroke="#1d2a1f" stroke-width="2.200" fill="none"/>
    ${Array.from({ length: n }, (_, i) => { const x = i * seg + seg / 2, c = BULB[i % BULB.length]; return `<g class="xl-b" style="--c:${c};--d:${((i * 0.53) % 2.6).toFixed(2)}s"><rect x="${x - 2}" y="6" width="4" height="3" rx="1" fill="#c9a24a"/><ellipse cx="${x}" cy="13.500" rx="7" ry="7.500" fill="${c}" opacity=".35" class="xl-glow"/><ellipse cx="${x}" cy="13" rx="3.200" ry="4.500" fill="${c}"/><ellipse cx="${x}" cy="13" rx="3.200" ry="4.500" fill="url(#xlG)"/></g>`; }).join('')}</svg>`;
}

// ---------- 시작(로딩) 화면: 동화풍 밤하늘 ----------
const REINDEER = `<symbol id="xsRd" viewBox="0 0 64 44"><path d="M8 24c2-7 20-9 30-6l6-7c2-4 6-5 9-3l4 1-2 3h-4l-3 8c-1 5-5 8-11 8H20c-5 0-10-1-12-4z"/><path d="M38 27l11 7 2-2-10-6zM33 28l9 9 2-2-8-8zM12 27 2 33l-1-2 9-6zM17 28l-8 9-2-1 7-9z"/><path d="M8 23l-6-3 1-2 6 3z"/><path d="M52 9l-3-7M52 6l-5-2M55 9l3-7M57 5l4-1" stroke="currentColor" stroke-width="1.600" stroke-linecap="round" fill="none"/></symbol>`;
const SLEIGH = `<symbol id="xsSl" viewBox="0 0 110 60"><path d="M6 50c10 6 70 6 92-2l4-6c-2 7-6 10-14 12-24 4-62 4-84-2z"/><path d="M14 48l2-6M40 50v-6M66 50v-6M88 47l-1-5" stroke="currentColor" stroke-width="2"/><path d="M10 42c0-12 6-20 18-20h40c10 0 16-6 22-12l4 3c-5 9-10 16-14 23-3 4-8 6-14 6z"/><circle cx="52" cy="14" r="7"/><path d="M45 12c2-10 12-12 18-6l6 6-3 1c-3-4-8-5-12-2z"/><circle cx="71" cy="13" r="2.400"/><path d="M42 32c-2-10 2-16 10-16s12 6 10 16z"/><path d="M58 20l12-8 2 2-11 9z"/><path d="M20 26c-6-10 2-20 12-18 4 1 6 4 6 8l-2 10z"/></symbol>`;
function sleighSVG() {
  return `<svg class="xs-sleigh" viewBox="0 0 420 110" aria-hidden="true"><defs>${REINDEER}${SLEIGH}<radialGradient id="xsNose"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ff4b3e"/><stop offset="1" stop-color="#ff4b3e" stop-opacity="0"/></radialGradient></defs>
    <g fill="#16203a" color="#16203a">
      <path d="M104 62 C170 50 250 44 372 34" stroke="#2a3552" stroke-width="1.200" fill="none"/><path d="M104 66 C180 58 250 52 372 40" stroke="#2a3552" stroke-width="1.200" fill="none"/>
      <use href="#xsSl" x="0" y="34" width="120" height="66"/>
      <g class="xs-rd a"><use href="#xsRd" x="150" y="38" width="56" height="38"/><use href="#xsRd" x="164" y="50" width="56" height="38"/></g>
      <g class="xs-rd b"><use href="#xsRd" x="222" y="30" width="56" height="38"/><use href="#xsRd" x="236" y="42" width="56" height="38"/></g>
      <g class="xs-rd c"><use href="#xsRd" x="294" y="22" width="56" height="38"/><use href="#xsRd" x="308" y="34" width="56" height="38"/></g>
      <g class="xs-rd d"><use href="#xsRd" x="352" y="12" width="60" height="40"/></g>
    </g>
    <circle class="xs-nose" cx="408" cy="21" r="9" fill="url(#xsNose)"/></svg>`;
}
function hillsSVG() {
  const tree = (x, y, s) => `<path d="M${x} ${y - 46 * s}l${-14 * s} ${22 * s}h${6 * s}l${-10 * s} ${14 * s}h${7 * s}l${-11 * s} ${12 * s}h${44 * s}l${-11 * s} ${-12 * s}h${7 * s}l${-10 * s} ${-14 * s}h${6 * s}z" fill="#0b1830"/><path d="M${x} ${y - 46 * s}l${-6 * s} ${10 * s}h${12 * s}z" fill="#e8f0ff" opacity=".85"/>`;
  const house = (x, y) => `<g><path d="M${x} ${y}v-18l12-10 12 10v18z" fill="#101d36"/><path d="M${x - 3} ${y - 17}l15-13 15 13" stroke="#e8f0ff" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="${x + 5}" y="${y - 12}" width="6" height="6" fill="#ffcf6b" class="xs-win"/><rect x="${x + 14}" y="${y - 12}" width="5" height="6" fill="#ffb84a" class="xs-win"/></g>`;
  return `<svg class="xs-hills" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
      <linearGradient id="xsH1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfdcf5"/><stop offset="1" stop-color="#7f93c4"/></linearGradient>
      <linearGradient id="xsH2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f8ff"/><stop offset="1" stop-color="#a9bbe2"/></linearGradient></defs>
    <path d="M0 190 C180 140 330 160 480 176 S820 130 1000 160 1200 150 1200 150V300H0z" fill="url(#xsH1)" opacity=".75"/>
    ${[90, 140, 420, 470, 760, 1080, 1130].map((x, i) => tree(x, 186 - (i % 2) * 6, 0.9)).join('')}
    ${house(560, 186)}${house(600, 180)}${house(880, 166)}
    <path d="M0 236 C220 200 420 226 640 230 S1000 196 1200 214V300H0z" fill="url(#xsH2)"/>
    ${[40, 300, 980, 1160].map((x) => tree(x, 238, 1.3)).join('')}</svg>`;
}
export function splashScene(splash) {
  if (!xmasOn()) return;
  splash.classList.add('xs');
  const sc = document.createElement('div'); sc.className = 'xs-scene';
  sc.innerHTML = `<canvas class="xs-stars"></canvas><div class="xs-moon"><i></i><i></i><i></i><i></i></div>
    <div class="xs-fly">${sleighSVG()}</div>${hillsSVG()}<canvas class="xs-dust"></canvas><canvas class="xs-snow"></canvas>`;
  splash.prepend(sc);
  if (calm()) return;
  const stops = [];
  // 반짝이는 별 + 가끔 별똥별
  (() => {
    const cv = sc.querySelector('.xs-stars'), g = cv.getContext('2d'); let W, H, stars = [], raf, shoot = null;
    const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; stars = Array.from({ length: Math.round(W * H / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.72, r: Math.random() * 1.3 + 0.2, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.6 })); };
    fit();
    const loop = (t) => {
      raf = requestAnimationFrame(loop); g.clearRect(0, 0, W, H);
      for (const s of stars) { g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t / 1000 * s.s)); g.fillStyle = '#fff'; g.fillRect(s.x, s.y, s.r, s.r); }
      if (!shoot && Math.random() < 0.006) shoot = { x: Math.random() * W * 0.6, y: Math.random() * H * 0.3, l: 1 };
      if (shoot) { g.globalAlpha = shoot.l; const gr = g.createLinearGradient(shoot.x, shoot.y, shoot.x - 120, shoot.y - 40); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = gr; g.lineWidth = 2; g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - 120, shoot.y - 40); g.stroke(); shoot.x += 14; shoot.y += 4.6; shoot.l -= 0.03; if (shoot.l <= 0) shoot = null; }
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop); stops.push(() => cancelAnimationFrame(raf));
  })();
  // 썰매 뒤로 흩날리는 금빛 가루
  (() => {
    const cv = sc.querySelector('.xs-dust'), g = cv.getContext('2d'), fly = sc.querySelector('.xs-sleigh'); let raf, ps = [];
    cv.width = innerWidth; cv.height = innerHeight;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const r = fly.getBoundingClientRect();
      if (r.right > 0 && r.left < innerWidth) for (let k = 0; k < 4; k++) ps.push({ x: r.left + r.width * (0.05 + Math.random() * 0.25), y: r.top + r.height * (0.55 + Math.random() * 0.35), vx: -0.6 - Math.random(), vy: 0.3 + Math.random() * 0.8, l: 1, s: 0.8 + Math.random() * 2.2, c: Math.random() < 0.7 ? '255,226,140' : '255,255,255' });
      g.clearRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'lighter';
      ps = ps.filter((p) => (p.l -= 0.012) > 0);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.004; g.globalAlpha = p.l; g.fillStyle = `rgb(${p.c})`; g.beginPath(); g.arc(p.x, p.y, p.s * (0.6 + 0.4 * Math.sin(p.l * 20)), 0, 6.283); g.fill(); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop); stops.push(() => cancelAnimationFrame(raf));
  })();
  stops.push(snowCanvas(sc.querySelector('.xs-snow'), { always: true, count: 120, glint: 24 }));
  const gone = new MutationObserver(() => { if (!document.body.contains(splash)) { stops.forEach((f) => f()); gone.disconnect(); } });
  gone.observe(document.body, { childList: true });
}

// ---------- 가끔 화면 위쪽을 지나가는 산타 썰매(금빛 가루와 함께) ----------
function flyBy() {
  const b = document.body.classList;
  if (!xmasOn() || b.contains('lite') || b.contains('idle') || document.hidden || document.getElementById('xflyby') || document.querySelector('#modal.on')) return;
  const el = document.createElement('div'); el.id = 'xflyby';
  el.innerHTML = `<div class="xf-fly">${sleighSVG()}</div><canvas></canvas>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), fly = el.querySelector('.xs-sleigh'); cv.width = innerWidth; cv.height = 220;
  let ps = [], raf; const t0 = performance.now();
  const loop = (t) => {
    const r = fly.getBoundingClientRect();
    if (r.right > 0 && r.left < innerWidth) for (let k = 0; k < 3; k++) ps.push({ x: r.left + r.width * (0.05 + Math.random() * 0.2), y: r.top + r.height * (0.55 + Math.random() * 0.3), vx: -0.5 - Math.random(), vy: 0.2 + Math.random() * 0.6, l: 1, s: 0.7 + Math.random() * 1.8 });
    g.clearRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'lighter';
    ps = ps.filter((p) => (p.l -= 0.014) > 0);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; g.globalAlpha = p.l; g.fillStyle = Math.random() < 0.8 ? '#ffe28c' : '#fff'; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.283); g.fill(); }
    if (t - t0 < 9500) raf = requestAnimationFrame(loop); else el.remove();
  };
  raf = requestAnimationFrame(loop);
}

// ---------- 켜기·끄기 ----------
function place() {
  const chat = document.getElementById('chat');
  if (chat && !chat.querySelector('#xsky')) {
    const k = document.createElement('div'); k.id = 'xsky';
    k.innerHTML = `<i class="xk-moon"></i>${Array.from({ length: 22 }, (_, i) => `<b style="left:${(i * 37) % 100}%;top:${(i * 53) % 62}%;--d:${(i % 7) * 0.45}s;--s:${1 + (i % 3)}px"></b>`).join('')}`;
    chat.prepend(k);
  }
  if (chat && !chat.querySelector('#xtree')) {
    const t = document.createElement('div'); t.id = 'xtree';
    t.innerHTML = treeSVG() + `<div class="xt-magic">${Array.from({ length: 12 }, (_, i) => `<i style="left:${12 + ((i * 29) % 76)}%;top:${6 + ((i * 41) % 80)}%;--d:${(i * 0.53) % 3.200}s"></i>`).join('')}</div>`;
    chat.querySelector('#xsky').after(t);
  }
  if (!document.getElementById('xlights')) garland();
  if (!document.getElementById('xfrost')) { const f = document.createElement('div'); f.id = 'xfrost'; document.body.appendChild(f); }
  const brand = document.querySelector('#side .brand');
  if (brand && !brand.querySelector('.xhat')) brand.insertAdjacentHTML('afterbegin', `<svg class="xhat" viewBox="0 0 44 34" aria-hidden="true"><defs><linearGradient id="xhR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5b4f"/><stop offset="1" stop-color="#9e1414"/></linearGradient></defs><path d="M5 26C10 12 18 4 30 4c5 0 8 3 9 9-7-3-12 1-14 7l-4 8z" fill="url(#xhR)"/><path d="M12 20c4-6 9-10 15-11" stroke="#fff" stroke-opacity=".25" stroke-width="2" fill="none"/><rect x="2" y="22" width="28" height="9" rx="4.500" fill="#fbfbfb"/><rect x="2" y="22" width="28" height="3" rx="1.500" fill="#fff"/><circle cx="39" cy="13" r="4.500" fill="#fff"/></svg>`);
  if (!snowStop) { const cv = document.createElement('canvas'); cv.id = 'xsnow'; document.body.appendChild(cv); const stop = snowCanvas(cv, { glint: 18 }); snowStop = () => { stop(); cv.remove(); snowStop = null; }; }
}
function clear() {
  ['xtree', 'xsky', 'xlights', 'xfrost', 'xflyby'].forEach((id) => document.getElementById(id)?.remove());
  document.querySelector('#side .xhat')?.remove();
  snowStop?.();
}
function apply() {
  const on = xmasOn();
  document.body.classList.toggle('xmas', on);
  if (on) place(); else clear();
  document.querySelectorAll('[data-a="xmasToggle"]').forEach((b) => { b.classList.toggle('on', on); const u = b.querySelector('u'); if (u) u.textContent = on ? 'ON' : 'OFF'; });
}
export const xmasBtn = () => (inSeason() ? `<button class="btn ghost xs xmas-btn ${xmasOn() ? 'on' : ''}" data-a="xmasToggle" title="눈·갈랜드·트리 같은 시즌 장식 켜기/끄기">❄ 시즌 장식 <u>${xmasOn() ? 'ON' : 'OFF'}</u></button>` : '');
act('xmasToggle', () => { localStorage.setItem(KEY, xmasOn() ? '0' : '1'); apply(); toast(xmasOn() ? '시즌 장식을 켰어요' : '시즌 장식을 껐어요'); });
export function initXmas() {
  if (!inSeason()) return;
  moreHooks.push(xmasBtn);
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', xmasBtn());
  apply();
  let w = innerWidth; addEventListener('resize', () => { if (Math.abs(innerWidth - w) > 40 && document.getElementById('xlights')) { w = innerWidth; garland(); } });
  setTimeout(flyBy, 12e3); setInterval(flyBy, 90e3); // 접속 12초 뒤 한 번, 그 뒤 1분 30초마다
  let day = new Date().getDate();
  setInterval(() => {
    if (!xmasOn()) return;
    const now = new Date().getDate();
    if (now !== day) { day = now; document.getElementById('xtree')?.remove(); }
    if (!inSeason()) return apply();
    place();
  }, 60e3);
}
