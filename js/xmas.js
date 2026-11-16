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
  <radialGradient id="xtHalo" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".6"/><stop offset=".55" stop-color="#ffb86b" stop-opacity=".14"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  <linearGradient id="xtLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc07c"/><stop offset=".45" stop-color="#1f8a50"/><stop offset="1" stop-color="#0b4a2a"/></linearGradient>
  <linearGradient id="xtLeafHi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8f0cc" stop-opacity=".6"/><stop offset=".35" stop-color="#b8f0cc" stop-opacity="0"/></linearGradient>
  <linearGradient id="xtGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d2"/><stop offset=".35" stop-color="#f0c55a"/><stop offset=".65" stop-color="#b9821f"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
  <linearGradient id="xtSatin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7b72"/><stop offset=".5" stop-color="#c81e2b"/><stop offset="1" stop-color="#7d0c16"/></linearGradient>
  <linearGradient id="xtTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a2c15"/><stop offset=".5" stop-color="#8a5629"/><stop offset="1" stop-color="#3a210f"/></linearGradient>
  <radialGradient id="xbRed" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffb0a6"/><stop offset=".35" stop-color="#df2f35"/><stop offset="1" stop-color="#6e0d12"/></radialGradient>
  <radialGradient id="xbGold" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fffbe2"/><stop offset=".35" stop-color="#ecbd45"/><stop offset="1" stop-color="#7a5310"/></radialGradient>
  <radialGradient id="xbBlue" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#cfe1ff"/><stop offset=".35" stop-color="#3a6ae0"/><stop offset="1" stop-color="#0f2257"/></radialGradient>
  <radialGradient id="xbPearl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#efe8de"/><stop offset="1" stop-color="#a39886"/></radialGradient>
  <radialGradient id="xbPurple" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#f0d6ff"/><stop offset=".35" stop-color="#9b4fd8"/><stop offset="1" stop-color="#3b1561"/></radialGradient>
  <radialGradient id="xtStarG" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#ffe17a"/><stop offset="1" stop-color="#e09b1c"/></radialGradient>
  <linearGradient id="xtRay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient>
  <filter id="xtGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="xtSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.200"/></filter>
  <filter id="xtBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <linearGradient id="xgRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8483f"/><stop offset="1" stop-color="#8e1717"/></linearGradient>
  <linearGradient id="xgGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34a866"/><stop offset="1" stop-color="#115230"/></linearGradient>
  <linearGradient id="xgNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4466c4"/><stop offset="1" stop-color="#16285e"/></linearGradient>
  <linearGradient id="xgPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a65fe0"/><stop offset="1" stop-color="#4a1a78"/></linearGradient>
  <pattern id="xtCane" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="6" height="6" fill="#fff"/><rect width="3" height="6" fill="#e0262f"/></pattern>
</defs>`;
// 가지 한 단: 아래쪽이 물결 모양으로 늘어진 삼각형 + 왼쪽 하이라이트 + 가지 끝에 쌓인 눈
const tier = (top, bot, half) => {
  const l = 120 - half, r = 120 + half, n = 6, w = (r - l) / n;
  let wave = '', snow = '';
  for (let i = 0; i < n; i++) { const x1 = r - w * i, x2 = r - w * (i + 1), mx = (x1 + x2) / 2; wave += ` Q${mx} ${bot + 10} ${x2} ${bot}`; snow += `<path d="M${x1 - 1} ${bot - 1} Q${mx} ${bot + 7} ${x2 + 1} ${bot - 1} Q${mx} ${bot + 2} ${x1 - 1} ${bot - 1}z" fill="#f4f8ff" opacity=".85"/>`; }
  const d = `M120 ${top} L${r} ${bot}${wave} Z`;
  return `<path d="${d}" fill="url(#xtLeaf)"/><path d="${d}" fill="url(#xtLeafHi)"/><path d="M120 ${top} L${l + 6} ${bot - 2}" stroke="#c9f5d8" stroke-opacity=".3" stroke-width="1.200"/>${snow}`;
};
const bauble = (x, y, g, r = 7) => `<g><path d="M${x - 2} ${y - r - 2.500}h4v3.500h-4z" fill="url(#xtGold)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/><path d="M${x - r} ${y}q${r} ${r * 0.5} ${r * 2} 0" stroke="#fff3c4" stroke-opacity=".55" stroke-width=".9" fill="none"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.38}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity=".8" transform="rotate(-30 ${x - r * 0.35} ${y - r * 0.38})"/></g>`;
const bulbs = (pts) => `<g class="xt-lights">${pts.map(([x, y, c], i) => `<g style="--i:${i}"><circle cx="${x}" cy="${y}" r="5.500" fill="${c}" opacity=".5" filter="url(#xtGlow)"/><circle cx="${x}" cy="${y}" r="2.200" fill="#fffbe8"/><path d="M${x} ${y - 5}v10M${x - 5} ${y}h10" stroke="#fffbe8" stroke-width=".8" opacity=".7"/></g>`).join('')}</g>`;
const gift = (x, y, w, h, g, rib) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.500" fill="url(#${g})"/><rect x="${x}" y="${y}" width="${w}" height="${h * 0.22}" fill="#fff" opacity=".12"/><rect x="${x + w / 2 - 2.500}" y="${y}" width="5" height="${h}" fill="${rib}"/><rect x="${x}" y="${y + h / 2 - 2}" width="${w}" height="4" fill="${rib}" opacity=".9"/><path d="M${x + w / 2} ${y}c-10-11-19-3-10 0zM${x + w / 2} ${y}c10-11 19-3 10 0z" fill="${rib}" stroke="#00000030"/><circle cx="${x + w / 2}" cy="${y}" r="2.400" fill="${rib}"/></g>`;
const cane = (x, y, flip = 1) => `<path d="M${x} ${y + 16} V${y + 4} q0 -6 ${5 * flip} -6 q${5 * flip} 0 ${5 * flip} 5" stroke="url(#xtCane)" stroke-width="3.400" fill="none" stroke-linecap="round"/>`;
const bell = (x, y) => `<g><path d="M${x - 6} ${y + 6} q0 -11 6 -11 q6 0 6 11 l2 2 h-16z" fill="url(#xtGold)"/><circle cx="${x}" cy="${y + 9}" r="2" fill="#b9821f"/><path d="M${x - 3} ${y - 6} q3 -4 6 0" stroke="#c81e2b" stroke-width="2" fill="none"/></g>`;
const starOrn = (x, y, s = 1) => `<path d="M${x} ${y - 7 * s} ${x + 2 * s} ${y - 2 * s} ${x + 7 * s} ${y - 2 * s} ${x + 3 * s} ${y + 1.500 * s} ${x + 4.500 * s} ${y + 7 * s} ${x} ${y + 4 * s} ${x - 4.500 * s} ${y + 7 * s} ${x - 3 * s} ${y + 1.500 * s} ${x - 7 * s} ${y - 2 * s} ${x - 2 * s} ${y - 2 * s}z" fill="url(#xtGold)" stroke="#fff6d2" stroke-width=".6"/>`;
function treeParts() {
  const P = [];
  P.push(`<path d="M106 286h28l4 30h-36z" fill="url(#xtTrunk)"/><path d="M40 314 q80 -22 160 0 q-6 14 -80 14 q-74 0 -80 -14z" fill="url(#xtSatin)"/><path d="M40 314 q80 -22 160 0" stroke="url(#xtGold)" stroke-width="2.500" fill="none"/>`); // 줄기 + 트리 치마
  P.push(tier(200, 292, 104));
  P.push(tier(148, 238, 84));
  P.push(tier(100, 184, 64));
  P.push(tier(58, 128, 44));
  // 공단 리본(사선으로 감기는 금빛 띠, 아래부터)
  P.push(`<path d="M46 284 C92 302 150 302 198 268" stroke="url(#xtGold)" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M46 282 C92 300 150 300 198 266" stroke="#fff6d2" stroke-opacity=".5" stroke-width="1.400" fill="none"/>`);
  P.push(`<path d="M60 228 C100 244 152 242 184 214" stroke="url(#xtGold)" stroke-width="6.500" fill="none" stroke-linecap="round"/><path d="M60 226 C100 242 152 240 184 212" stroke="#fff6d2" stroke-opacity=".5" stroke-width="1.200" fill="none"/>`);
  P.push(`<path d="M74 174 C104 188 142 186 166 162" stroke="url(#xtGold)" stroke-width="6" fill="none" stroke-linecap="round"/>`);
  P.push(`<path d="M90 122 C110 131 134 130 150 114" stroke="url(#xtGold)" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  // 장식 공
  const B = [[70, 270, 'xbRed', 8.500], [170, 262, 'xbGold', 8.500], [118, 294, 'xbBlue', 8], [96, 252, 'xbPearl', 7.500], [146, 288, 'xbPurple', 7.500], [188, 286, 'xbPearl', 7], [52, 292, 'xbGold', 7],
    [88, 214, 'xbGold', 8], [152, 206, 'xbRed', 8], [118, 232, 'xbPurple', 7.500], [70, 232, 'xbBlue', 7], [174, 234, 'xbBlue', 7], [104, 196, 'xbRed', 6.500],
    [100, 160, 'xbBlue', 7.500], [142, 154, 'xbGold', 7.500], [122, 176, 'xbRed', 7], [84, 176, 'xbPurple', 6.500], [160, 178, 'xbPearl', 6.500],
    [112, 108, 'xbGold', 6.500], [132, 118, 'xbRed', 6], [100, 126, 'xbPearl', 6], [124, 90, 'xbPurple', 5.500]];
  B.forEach(([x, y, g, r]) => P.push(bauble(x, y, g, r)));
  // 지팡이 사탕·금종·별 장식
  P.push(cane(58, 240)); P.push(cane(176, 250, -1)); P.push(cane(132, 192));
  P.push(bell(80, 286)); P.push(bell(158, 222)); P.push(bell(112, 140));
  P.push(starOrn(136, 268)); P.push(starOrn(64, 196, 0.9)); P.push(starOrn(150, 128, 0.8)); P.push(starOrn(92, 98, 0.7));
  // 요정 전구(십자 반짝임)
  P.push(bulbs([[56, 262, '#ffcf6b'], [78, 278, '#ff8a7a'], [102, 286, '#ffcf6b'], [128, 284, '#a8d8ff'], [154, 276, '#ffcf6b'], [180, 260, '#ff8a7a'], [196, 276, '#c8a8ff']]));
  P.push(bulbs([[70, 208, '#a8d8ff'], [92, 222, '#ffcf6b'], [118, 226, '#ff8a7a'], [146, 220, '#ffcf6b'], [170, 202, '#c8a8ff']]));
  P.push(bulbs([[84, 156, '#ffcf6b'], [106, 170, '#ff8a7a'], [132, 168, '#ffcf6b'], [156, 152, '#a8d8ff'], [96, 108, '#ffcf6b'], [118, 116, '#c8a8ff'], [140, 104, '#ff8a7a'], [110, 80, '#ffcf6b']]));
  // 선물 상자
  P.push(gift(26, 300, 36, 26, 'xgRed', '#f2cf7a'));
  P.push(gift(172, 292, 42, 34, 'xgGreen', '#f4efe6'));
  P.push(gift(138, 306, 30, 20, 'xgNavy', '#f2cf7a'));
  P.push(gift(64, 308, 26, 18, 'xgPurple', '#ffd6f0'));
  P.push(gift(98, 312, 22, 14, 'xgRed', '#f4efe6'));
  // 리본 나비매듭(별 바로 아래)
  P.push(`<g><path d="M120 66 c-14 -12 -26 -4 -16 4 c-8 6 4 12 16 -4z" fill="url(#xtSatin)"/><path d="M120 66 c14 -12 26 -4 16 4 c8 6 -4 12 -16 -4z" fill="url(#xtSatin)"/><path d="M118 66 l-8 22 6 -3 2 6zM122 66 l8 22 -6 -3 -2 6z" fill="#a8121e"/><circle cx="120" cy="66" r="4" fill="#ff6b62"/></g>`);
  // 별(크리스마스 당일): 회전하는 빛살 + 큰 빛무리
  P.push(`<g class="xt-star"><g class="xt-rays">${Array.from({ length: 12 }, (_, i) => `<path d="M120 40 l-3 -46 h6z" fill="url(#xtRay)" transform="rotate(${i * 30} 120 40)"/>`).join('')}</g><circle cx="120" cy="40" r="30" fill="#ffd76a" opacity=".55" filter="url(#xtGlow)"/><path d="M120 8 128.500 30 152 31 134 45 140 68 120 55 100 68 106 45 88 31 111.500 30z" fill="url(#xtStarG)" stroke="#fff8dc" stroke-width="1.600"/><circle cx="114" cy="30" r="3" fill="#fff" opacity=".9"/></g>`);
  return P;
}
function treeSVG() {
  const parts = treeParts(), { d, total } = progress();
  const n = d >= total ? parts.length : Math.min(parts.length - 1, 1 + Math.floor((d / total) * (parts.length - 1)));
  const key = 'naejeon:xtree2', seen = +localStorage.getItem(key) || 0;
  try { localStorage.setItem(key, String(n)); } catch {}
  // 항상 보이는 배경: 은은한 빛무리, 뒤쪽 빛살, 트리를 휘감아 오르는 금빛 마법 소용돌이
  const aura = `<ellipse cx="120" cy="196" rx="124" ry="150" fill="url(#xtHalo)"/><g class="xt-bgrays" opacity=".22" filter="url(#xtBlur)">${Array.from({ length: 11 }, (_, i) => `<path d="M120 180 l-4 -200 h8z" fill="url(#xtRay)" transform="rotate(${-70 + i * 14} 120 180)"/>`).join('')}</g>`;
  const swirl = `<path id="xtSw" d="M60 300 C150 290 200 260 170 240 C120 210 50 230 78 200 C100 176 170 186 160 156 C150 132 86 150 98 120 C108 96 150 106 142 80 C136 62 118 58 120 40" fill="none"/>
    <path d="M60 300 C150 290 200 260 170 240 C120 210 50 230 78 200 C100 176 170 186 160 156 C150 132 86 150 98 120 C108 96 150 106 142 80 C136 62 118 58 120 40" fill="none" stroke="#ffe7a3" stroke-width="2.600" stroke-linecap="round" class="xt-swirl" filter="url(#xtSoft)"/>
    ${Array.from({ length: 7 }, (_, i) => `<circle r="${2.400 - i * 0.2}" fill="#fff6d2" class="xt-dot"><animateMotion dur="5s" begin="${-i * 0.18}s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#xtSw"/></animateMotion></circle>`).join('')}`;
  return `<svg viewBox="-10 -14 260 352" aria-hidden="true">${DEFS}${aura}${parts.slice(0, n).map((p, i) => `<g class="xt-p ${seen && i >= seen ? 'xt-new' : ''}">${p}</g>`).join('')}<g class="xt-magicsw">${swirl}</g></svg>`;
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
