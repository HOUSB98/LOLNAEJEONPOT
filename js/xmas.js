// 시즌 장식(크리스마스): 11/16 ~ 12/26 에만 자동으로 켜진다. 글자(인사말)는 넣지 않는다.
//  - 눈 내림(가벼운 모드·창 비활성일 때는 멈춤), 화면 위쪽 전구 줄, 로고 산타 모자, 반짝이 색
//  - 채팅창 뒤 반투명 트리: 시작일부터 하루가 지날 때마다 장식이 하나씩 늘고 12/25에 별이 달려 완성된다
// 장식이 싫으면 사이드바(모바일은 더보기)의 '시즌 장식' 버튼으로 끈다(naejeon:xmas = '0').
import { act, toast, moreHooks } from './core.js';

const START = [11, 16], STAR_DAY = [12, 25], END = [12, 26];
const KEY = 'naejeon:xmas';
const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
export const inSeason = (d = new Date()) => md(d) >= START[0] * 100 + START[1] && md(d) <= END[0] * 100 + END[1];
const enabled = () => inSeason() && localStorage.getItem(KEY) !== '0';

// 트리 진행: 시작일 0일차 → 크리스마스 당일 완성
function progress(now = new Date()) {
  const y = now.getFullYear(), day = 864e5;
  const s = new Date(y, START[0] - 1, START[1]), x = new Date(y, STAR_DAY[0] - 1, STAR_DAY[1]);
  const t = new Date(y, now.getMonth(), now.getDate());
  return { d: Math.max(0, Math.round((t - s) / day)), total: Math.round((x - s) / day) };
}

// ---------- 트리(SVG): 그리는 순서 = 하루에 하나씩 나타나는 순서 ----------
function treeParts() {
  const parts = [];
  parts.push('<rect x="88" y="252" width="24" height="30" rx="3" fill="#6b4524"/>'); // 줄기
  parts.push('<path d="M100 150 30 258h140z" fill="url(#xg1)"/>'); // 아래 단
  parts.push('<path d="M100 98 44 196h112z" fill="url(#xg2)"/>'); // 가운데 단
  parts.push('<path d="M100 48 58 136h84z" fill="url(#xg3)"/>'); // 위 단
  parts.push('<path d="M40 238q60 22 120-6" stroke="#f2cf7a" stroke-width="3" fill="none" stroke-linecap="round"/>'); // 장식 줄
  parts.push('<path d="M54 182q46 18 94-4" stroke="#f2cf7a" stroke-width="3" fill="none" stroke-linecap="round"/>');
  parts.push('<path d="M68 126q32 12 64-2" stroke="#f2cf7a" stroke-width="3" fill="none" stroke-linecap="round"/>');
  const balls = [[60, 232, '#e2463c'], [140, 228, '#3fd0e0'], [100, 245, '#f2cf7a'], [78, 250, '#5b8cff'], [124, 248, '#e2463c'], [48, 252, '#f2cf7a'], [152, 252, '#9b8cff'],
    [72, 176, '#f2cf7a'], [128, 172, '#e2463c'], [100, 190, '#3fd0e0'], [58, 192, '#9b8cff'], [142, 190, '#5b8cff'], [88, 160, '#e2463c'], [114, 158, '#f2cf7a'],
    [84, 122, '#5b8cff'], [118, 120, '#e2463c'], [100, 132, '#f2cf7a'], [72, 134, '#3fd0e0'], [128, 134, '#9b8cff'], [100, 92, '#e2463c'], [92, 108, '#f2cf7a'], [110, 106, '#3fd0e0']];
  balls.forEach(([x, y, c]) => parts.push(`<circle cx="${x}" cy="${y}" r="5.500" fill="${c}"/><circle cx="${x - 1.800}" cy="${y - 1.800}" r="1.600" fill="#fff" opacity=".7"/>`));
  parts.push('<g><rect x="34" y="262" width="26" height="20" rx="2" fill="#c0392b"/><rect x="45" y="262" width="4" height="20" fill="#f2cf7a"/><path d="M47 262q-8-8-10 0M47 262q8-8 10 0" stroke="#f2cf7a" stroke-width="2" fill="none"/></g>'); // 선물
  parts.push('<g><rect x="138" y="258" width="30" height="24" rx="2" fill="#2e8b57"/><rect x="151" y="258" width="4" height="24" fill="#e8e8e8"/><path d="M153 258q-9-9-11 0M153 258q9-9 11 0" stroke="#e8e8e8" stroke-width="2" fill="none"/></g>');
  parts.push('<g><rect x="112" y="268" width="22" height="14" rx="2" fill="#5b8cff"/><rect x="121" y="268" width="4" height="14" fill="#f2cf7a"/></g>');
  parts.push('<path d="M100 22 106.500 37.500 123 38.500 110 48.500 114.500 64.500 100 55.500 85.500 64.500 90 48.500 77 38.500 93.500 37.500z" fill="#ffd96a" stroke="#fff3c4" stroke-width="1.500" class="xt-star"/>'); // 별(크리스마스)
  return parts;
}
function treeSVG() {
  const parts = treeParts(), { d, total } = progress();
  // 별은 크리스마스 당일에만. 나머지는 날짜에 비례해 하나씩 나타난다
  const n = d >= total ? parts.length : Math.min(parts.length - 1, 1 + Math.floor((d / total) * (parts.length - 1)));
  const seenKey = 'naejeon:xtree', seen = +localStorage.getItem(seenKey) || 0;
  try { localStorage.setItem(seenKey, String(n)); } catch {}
  return `<svg viewBox="0 0 200 290" aria-hidden="true"><defs>
      <linearGradient id="xg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8f55"/><stop offset="1" stop-color="#17542f"/></linearGradient>
      <linearGradient id="xg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#37a062"/><stop offset="1" stop-color="#1c6038"/></linearGradient>
      <linearGradient id="xg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#40b06c"/><stop offset="1" stop-color="#226b40"/></linearGradient></defs>
    ${parts.slice(0, n).map((p, i) => `<g class="xt-p ${i >= seen && seen ? 'xt-new' : ''}">${p}</g>`).join('')}</svg>`;
}

// ---------- 눈 ----------
let snowStop = null;
function snow() {
  if (snowStop) return;
  const cv = document.createElement('canvas'); cv.id = 'xsnow'; document.body.appendChild(cv);
  const g = cv.getContext('2d'); let W = 0, H = 0, flakes = [], last = 0, raf = 0;
  const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; flakes = Array.from({ length: Math.round(Math.min(70, W / 22)) }, () => mk(true)); };
  const mk = (any) => ({ x: Math.random() * W, y: any ? Math.random() * H : -8, r: 0.8 + Math.random() * 2.2, v: 0.25 + Math.random() * 0.7, w: Math.random() * 6.28, a: 0.35 + Math.random() * 0.5 });
  fit(); addEventListener('resize', fit);
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; last = t; // 약 30fps면 충분하다
    const b = document.body.classList;
    if (b.contains('lite') || b.contains('idle') || document.hidden) { g.clearRect(0, 0, W, H); return; }
    g.clearRect(0, 0, W, H); g.fillStyle = '#fff';
    for (const f of flakes) {
      f.y += f.v; f.w += 0.02; f.x += Math.sin(f.w) * 0.35;
      if (f.y > H + 6) Object.assign(f, mk(false));
      g.globalAlpha = f.a; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
  };
  raf = requestAnimationFrame(loop);
  snowStop = () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); cv.remove(); snowStop = null; };
}

// ---------- 켜기·끄기 ----------
function place() {
  const chat = document.getElementById('chat');
  if (chat && !chat.querySelector('#xtree')) { const t = document.createElement('div'); t.id = 'xtree'; t.innerHTML = treeSVG(); chat.prepend(t); }
  if (!document.getElementById('xlights')) {
    const l = document.createElement('div'); l.id = 'xlights';
    l.innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="--d:${(i * 0.37) % 2.4}s"></i>`).join('');
    document.body.appendChild(l);
  }
  const brand = document.querySelector('#side .brand');
  if (brand && !brand.querySelector('.xhat')) brand.insertAdjacentHTML('afterbegin', '<svg class="xhat" viewBox="0 0 40 30" aria-hidden="true"><path d="M4 24q10-20 26-20 4 0 6 6-8-2-12 6l-4 8z" fill="#d6322b"/><rect x="2" y="21" width="26" height="7" rx="3.500" fill="#f4f4f4"/><circle cx="36" cy="10" r="4" fill="#f4f4f4"/></svg>');
}
function clear() {
  document.getElementById('xtree')?.remove(); document.getElementById('xlights')?.remove(); document.querySelector('#side .xhat')?.remove();
  snowStop?.();
}
function apply() {
  const on = enabled();
  document.body.classList.toggle('xmas', on);
  if (on) { place(); snow(); } else clear();
  document.querySelectorAll('[data-a="xmasToggle"]').forEach((b) => { b.classList.toggle('on', on); const u = b.querySelector('u'); if (u) u.textContent = on ? 'ON' : 'OFF'; });
}
export const xmasBtn = () => (inSeason() ? `<button class="btn ghost xs xmas-btn ${enabled() ? 'on' : ''}" data-a="xmasToggle" title="눈·전구·트리 같은 시즌 장식 켜기/끄기">❄ 시즌 장식 <u>${enabled() ? 'ON' : 'OFF'}</u></button>` : '');
act('xmasToggle', () => { localStorage.setItem(KEY, enabled() ? '0' : '1'); apply(); toast(enabled() ? '시즌 장식을 켰어요' : '시즌 장식을 껐어요'); });
export function initXmas() {
  if (!inSeason()) return;
  moreHooks.push(xmasBtn);
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', xmasBtn());
  apply();
  // 채팅창을 다시 그리거나 날짜가 바뀌면 트리를 다시 붙인다
  let day = new Date().getDate();
  setInterval(() => {
    if (!enabled()) return;
    const now = new Date().getDate();
    if (now !== day) { day = now; document.getElementById('xtree')?.remove(); }
    if (!inSeason()) return apply();
    place();
  }, 60e3);
}
