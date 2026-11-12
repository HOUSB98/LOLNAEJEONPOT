// 공통: 상태, 라우터, 이벤트 위임, 아이콘·로고, 모달, 챔피언/선수 선택창, 관리자 PIN, 이펙트
import { compute, LANES, LANE_NAME, pct } from './stats.js';

export const S = { store: null, key: 'local', st: null, dirty: true, page: 'home', arg: [], admin: false, champs: [], champBy: {}, ver: '' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const col = (name) => Object.values(S.store.data[name] || {});
export const settings = () => S.store.data.meta?.settings || {};
export const pname = (id) => esc(S.st?.P[id]?.name || S.store.data.players?.[id]?.name || '?');

// ---------- 아이콘 (선형 SVG) ----------
const I = {
  home: '<path d="M3 10.5 12 3l9 7.500V21h-6v-6H9v6H3z"/>',
  rank: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  today: '<path d="M14.500 17.500 3 6V3h3l11.500 11.500M13 19l6-6M16 16l4 4M14.500 6.500 18 3h3v3l-3.500 3.500M5 14l4 4M7 17l-3 3"/>',
  matches: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  players: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.500 1.700-2 3-2s2.400.5 3 2M15 10h3M15 14h3"/>',
  chem: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  champs: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  fearless: '<circle cx="12" cy="12" r="9"/><path d="m5.600 5.600 12.800 12.800"/>',
  auction: '<circle cx="12" cy="8.500" r="6.500"/><path d="M10.800 15v5.500a1.200 1.200 0 0 0 2.400 0V15M10.600 7l1.700-1.300v5.800M10.600 11.500h3.200"/>',
  maker: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.500 4l-3 16"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900 7 7M17 17l2.100 2.100M4.900 19.100 7 17M17 7l2.100-2.100"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.500 7.200L4 20l1-4.500A8 8 0 1 1 21 12z"/>',
  send: '<path d="m3 11 18-8-8 18-2-8z"/>',
  users: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.5-3.500 3-5.500 6.500-5.500s6 2 6.500 5.500M16 5a3.500 3.500 0 0 1 0 6.500M18 14.800c2 .7 3.200 2.400 3.500 5.200"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-9 0 4-4 6-4 12 0 5 3 8 7 8z"/>',
  crown: '<path d="m3 7 4.500 4L12 4l4.500 7L21 7l-2 12H5z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.500 3.500 0 0 0 6 0zM19 7l-3 7a3.500 3.500 0 0 0 6 0z"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.500 8 8 9 4.500-1 8-4 8-9V6z"/>',
  down: '<path d="M12 4v12M6 12l6 6 6-6M5 21h14"/>',
  edit: '<path d="m4 20 1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.700 5.800 6.300.8-4.600 4.400 1.200 6.300L12 17.200 6.400 20.300l1.200-6.300L3 9.600l6.300-.8z"/>',
  mega: '<path d="M4 10v4h3l8 5V5L7 10zM18 9a4 4 0 0 1 0 6"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.500 4l-3 16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  kick: '<circle cx="10" cy="8" r="3.500"/><path d="M3.500 20c.5-3.500 3-5.500 6.500-5.500 1.200 0 2.300.2 3.200.7M16 14l5 5M21 14l-5 5"/>',
  replay: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 4l2 4M12 4l2 4M17 4l2 4M10 11.500v5l4.500-2.500z"/>',
};
export const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
const L = {
  top: '<path d="M3 3h15l-3.500 3.500H6.500v8L3 18z"/><path d="M21 6v15H6l3.500-3.500h8v-8z" opacity=".28"/><rect x="10" y="10" width="4" height="4" opacity=".28"/>',
  adc: '<path d="M21 21H6l3.500-3.500h8v-8L21 6z"/><path d="M3 18V3h15l-3.500 3.500h-8v8z" opacity=".28"/><rect x="10" y="10" width="4" height="4" opacity=".28"/>',
  mid: '<path d="M17 3h4v4L7 21H3v-4z"/><path d="M3 13V3h10L9.500 6.500h-3v3zM21 11v10H11l3.500-3.500h3v-3z" opacity=".28"/>',
  jg: '<path d="M12 22c-.8-3.200-2.600-5.800-6.500-8.500.9 2.600 1.300 4.300 3.300 7zM12 22c.8-3.200 2.600-5.800 6.500-8.500-.9 2.600-1.300 4.300-3.300 7zM12 17.500C11.200 12.500 10 8 7.500 2.500c3 2.700 4.500 6 4.500 9 0-3 1.500-6.300 4.500-9C14 8 12.800 12.500 12 17.500z"/>',
  sup: '<path d="M12 9.500 14 12l-2 10-2-10zM9 4.500h6l1 2-4 2.500-4-2.500zM1.500 6.500h6L10 10l-3.500 2.500L4 9.500H2.500zM22.500 6.500h-6L14 10l3.500 2.500L20 9.500h1.500z"/>',
};
export const LANE_ICON = Object.fromEntries(LANES.map((l) => [l, `<svg class="lic l-${l}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${L[l]}</svg>`]));
export const LANE_COLOR = { top: '#f08a4b', jg: '#4fd08b', mid: '#9b8cff', adc: '#ff6b81', sup: '#3fd0e0' };
export function logo(anim = false, size = 44) {
  return `<svg class="logo ${anim ? 'draw' : ''}" width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" aria-label="NAEJEONPOT">
    <defs><linearGradient id="lg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a8"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#8a5a16"/></linearGradient></defs>
    <path class="lg-hex" pathLength="1" d="M60 5 108 32v56L60 115 12 88V32z" stroke="url(#lg-g)" stroke-width="4" stroke-linejoin="round"/>
    <path class="lg-in" pathLength="1" d="M60 15 99 37v46L60 105 21 83V37z" stroke="#d9a441" stroke-opacity=".35" stroke-width="1.500"/>
    <path class="lg-n" pathLength="1" d="M41 86V36l38 46V34" stroke="url(#lg-g)" stroke-width="9" stroke-linejoin="miter" stroke-linecap="square"/>
    <path class="lg-gem" d="M60 20l6 8-6 8-6-8z" fill="#3fd0e0"/><path class="lg-gem" d="M79 30l4-6 4 6-4 6zM41 90l-4 6-4-6 4-6z" fill="#f6e3a8"/>
  </svg>`;
}

const pages = {}, acts = {};
export const page = (id, def) => (pages[id] = def);
export const act = (name, fn) => (acts[name] = fn);
export const NAV = [
  ['', 'LEAGUE'], ['home', '홈'], ['rank', '랭킹'], ['matches', '경기 기록'], ['players', '선수 카드'],
  ['', 'ANALYSIS'], ['champs', '챔피언'], ['chem', '케미'],
  ['', 'PLAY'], ['today', '오늘의 내전'], ['auction', '팀 경매'], ['replay', '리플레이 분석', '예정'], ['admin', '관리'],
  ['', 'CREDITS'], ['maker', '제작자'],
];
export function go(hash) { location.hash = hash; }
function parseHash() {
  const [p, ...arg] = location.hash.replace(/^#\/?/, '').split('/');
  S.page = pages[p] ? p : 'home'; S.arg = arg.map(decodeURIComponent);
}
let raf = 0, lastRoute = '';
export function refresh(dataChanged) {
  if (dataChanged) S.dirty = true;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
}
export function render() {
  if (S.dirty) { S.st = compute(col('players'), col('matches'), settings()); S.dirty = false; }
  const main = document.getElementById('main');
  const f = document.activeElement, fid = f && main.contains(f) ? f.id : '', sel = fid && f.selectionStart;
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.p === S.page));
  document.getElementById('league').textContent = settings().leagueName || '친구 내전 리그';
  const route = S.page + '/' + S.arg.join('/'), entering = route !== lastRoute;
  lastRoute = route;
  main.innerHTML = pages[S.page].render(...S.arg);
  if (entering) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); clearTimeout(render.t); render.t = setTimeout(() => main.classList.remove('enter'), 900); }
  lazyArt(main);
  pages[S.page].after?.(entering);
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(sel, sel); } catch {} } }
}
export function initShell() {
  document.getElementById('brandlogo').innerHTML = logo(false, 40);
  document.getElementById('nav').innerHTML = NAV.map(([p, t, soon]) => (p ? `<a href="#/${p}" data-p="${p}">${ic(p)}<span>${t}</span>${soon ? `<em>${soon}</em>` : ''}</a>` : `<h6>${t}</h6>`)).join('');
  document.getElementById('mode').innerHTML = S.store.mode === 'local' ? '<span class="tag warn" title="이 브라우저에만 저장됩니다">체험 모드</span>' : '<span class="tag ok"><i class="live"></i>LIVE 동기화</span>';
  const on = (type, attr) => document.addEventListener(type, (e) => {
    const el = e.target.closest?.(`[${attr}]`);
    if (el && acts[el.getAttribute(attr)]) acts[el.getAttribute(attr)](el.dataset, el, e);
  });
  on('click', 'data-a'); on('change', 'data-c'); on('input', 'data-i');
  window.addEventListener('hashchange', () => { parseHash(); window.scrollTo(0, 0); document.getElementById('main').scrollTop = 0; render(); });
  parseHash(); render();
}

// ---------- 표시 도우미 ----------
export const fmtDT = (at) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const fmtDay = (k) => { const [y, m, d] = k.split('-'); return `${y}.${m}.${d}`; };
export const wr = (o) => (o && o.g ? `${pct(o.w, o.g)}% <small>(${o.g})</small>` : '<span class="mut">-</span>');
export const wrClass = (v) => (v === null || v === undefined ? '' : v >= 60 ? 'good' : v <= 40 ? 'bad' : '');
export const wrBar = (w, g) => { const v = pct(w, g); return g ? `<span class="wrb"><i style="width:${v}%" class="${v >= 60 ? 'hi' : v >= 45 ? 'mid' : 'lo'}"></i></span><b class="mono ${wrClass(v)}">${v}%</b>` : '<span class="mut">-</span>'; };
export const dots = (arr) => `<span class="dots">${[...Array(5 - arr.length).fill(null), ...arr].map((r) => `<i class="${r === null ? '' : r ? 'w' : 'l'}">${r === null ? '' : r ? 'W' : 'L'}</i>`).join('')}</span>`;
export const streak = (n) => (n >= 2 ? `<span class="stk w">${ic('flame')}${n}연승</span>` : n <= -2 ? `<span class="stk l">${-n}연패</span>` : '');
export const laneTag = (l) => `<span class="lane">${LANE_ICON[l]}${LANE_NAME[l]}</span>`;
export const titleChips = (s, max = 99) => s.titles.slice(0, max).map((t) => `<span class="chip" title="${esc(t.d)}">${t.e} ${t.n}</span>`).join('') + (s.titles.length > max ? `<span class="chip mut">+${s.titles.length - max}</span>` : '');
export function champIcon(name, cls = '') {
  if (!name) return `<span class="ci empty ${cls}"></span>`;
  const c = S.champBy[name];
  return c ? `<img class="ci ${cls}" src="${c.img}" alt="${esc(name)}" title="${esc(name)}" loading="lazy">` : `<span class="ci txt ${cls}" title="${esc(name)}">${esc(name.slice(0, 2))}</span>`;
}
// 챔피언 이미지 3종. 파일 이름이 목록의 id와 다른 챔피언은 IMG_ID에서 바로잡는다.
//   artUrl   : 챔피언이 한가운데 오도록 맞춘 가로 일러스트(1280x720). 얼굴이 항상 가로 중앙·위에서 22% 근처라서
//              가로로 긴 칸(랭킹 행, 라인업 칸, 듀오, 배너)에 쓴다. CSS도 `center 22%` 기준으로 맞춰 둔다.
//   tileUrl  : 얼굴 중심 정사각. 세로로 길거나 정사각에 가까운 카드에 쓴다.
//   splashUrl: 원본 일러스트(구도가 제각각이라 큰 배경에만).
const IMG_ID = { Fiddlesticks: 'FiddleSticks' };
const imgId = (name) => { const id = S.champBy[name]?.id; return id ? IMG_ID[id] || id : ''; };
const cimg = (kind) => (name) => (imgId(name) ? `https://ddragon.leagueoflegends.com/cdn/img/champion/${kind}/${imgId(name)}_0.jpg` : '');
export const splashUrl = cimg('splash');
export const tileUrl = cimg('tiles');
export const artUrl = cimg('centered');
// 화면에 보일 때만 배경 이미지를 받는다: <i data-art="주소"> → 보이면 style="--img:url(주소)"
let artIO = null;
export function lazyArt(root = document) {
  const els = root.querySelectorAll('[data-art]');
  if (!els.length) return;
  const show = (el) => { if (el.dataset.art) el.style.setProperty('--img', `url('${el.dataset.art}')`); el.removeAttribute('data-art'); };
  if (!('IntersectionObserver' in window)) return els.forEach(show);
  artIO ||= new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { artIO.unobserve(e.target); show(e.target); } }), { rootMargin: '300px' });
  els.forEach((el) => artIO.observe(el));
}
// 선수의 대표 챔피언(랭킹·선수 카드·케미 등 모든 화면 공통):
// 주라인에서 가장 많이 쓴 챔피언 → (기록이 없으면) 솔랭 모스트 → 내전 모스트
const sigCache = new WeakMap();
export function sigChamp(s) {
  const st = S.st; let cnt = sigCache.get(st);
  if (!cnt) {
    cnt = {};
    st.matches.forEach((m) => ['blue', 'red'].forEach((side) => m[side].forEach((id, i) => {
      const c = m.champs?.[side]?.[i]; if (!c || st.P[id]?.mainLane !== LANES[i]) return;
      ((cnt[id] ||= {})[c] ||= { g: 0, w: 0 }).g++; if (m.winner === side) cnt[id][c].w++;
    })));
    sigCache.set(st, cnt);
  }
  const top = Object.entries(cnt[s.id] || {}).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w)[0];
  if (top) return top[0];
  const most = s.p.solo?.most || '';
  const solo = S.champs.map((c) => c.name).filter((n) => most.includes(n)).sort((a, b) => most.indexOf(a) - most.indexOf(b))[0];
  if (solo) return solo;
  const own = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w)[0];
  return own ? own[0] : '';
}
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400);
}
export function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: type + ';charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
// 숫자 카운트업: <b data-count="17">
export function countUp(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString() + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
// 축포 이펙트 (화면 전체 캔버스)
export function burst(x = innerWidth / 2, y = innerHeight / 2, n = 140) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'fx'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), colors = ['#f6e3a8', '#d9a441', '#3fd0e0', '#ffffff', '#5b8cff', '#ff6b81'];
  const ps = Array.from({ length: n }, () => { const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 11; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: 2 + Math.random() * 4, c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6, life: 1 }; });
  const t0 = performance.now();
  (function loop(t) {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += 0.2; p.life -= 0.011; g.save(); g.globalAlpha = Math.max(0, p.life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
    if (t - t0 < 2200) requestAnimationFrame(loop); else c.remove();
  })(t0);
}

// ---------- 모달 ----------
export function modal(html, cls = '') {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="sheet ${cls}">${html}</div>`; m.classList.add('on');
  return m.firstElementChild;
}
export function closeModal() { const m = document.getElementById('modal'); m.classList.remove('on'); m.innerHTML = ''; }
act('close', closeModal);
document.addEventListener('click', (e) => { if (e.target.id === 'modal' && !e.target.querySelector('.lock')) closeModal(); });
const mh = (title) => `<div class="mh"><b>${title}</b><button class="btn ghost xs" data-a="close">${ic('x')}</button></div>`;
export { mh };

// ---------- 챔피언 ----------
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const cho = (s) => [...s].map((c) => { const n = c.charCodeAt(0) - 0xac00; return n >= 0 && n < 11172 ? CHO[Math.floor(n / 588)] : c; }).join('');
export async function loadChamps() {
  const KEY = 'naejeon:champs2';
  const set = (o) => { S.ver = o.ver; S.champs = o.list; S.champBy = Object.fromEntries(o.list.map((c) => [c.name, c])); };
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (cached) { set(cached); refresh(); } // 저장해 둔 목록을 적용한 뒤 화면을 다시 그려야 첫 화면의 이미지가 비지 않는다
    if (cached && Date.now() - cached.at < 12 * 3600e3) return; // 패치 버전은 반나절마다 다시 확인
    const ver = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
    const data = (await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ver}/data/ko_KR/champion.json`)).json()).data;
    const list = Object.values(data).map((c) => ({ id: c.id, name: c.name, img: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c.image.full}` })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const o = { ver, list, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(o)); set(o); refresh();
  } catch (e) { console.warn('챔피언 목록을 불러오지 못했습니다', e); }
}
let pickCb = null;
export function pickChamp({ title, used = {}, current = '', onPick }) {
  pickCb = onPick;
  const grid = S.champs.map((c) => `<button class="cp ${used[c.name] ? 'used' : ''} ${c.name === current ? 'cur' : ''}" data-a="cp" data-n="${esc(c.name)}" data-k="${esc(c.name.replace(/\s/g, '') + ' ' + cho(c.name.replace(/\s/g, '')))}" ${used[c.name] ? `disabled title="${esc(used[c.name])}"` : ''}><img src="${c.img}" loading="lazy" alt=""><span>${esc(c.name)}</span></button>`).join('');
  const el = modal(`${mh(esc(title))}
    <div class="row"><input id="cpq" class="inp grow" placeholder="챔피언 검색 (초성 가능: ㅇㄹ)" data-i="cpq" autocomplete="off">
    <button class="btn" data-a="cp" data-n="">비우기</button></div>
    ${S.champs.length ? `<div class="cpgrid">${grid}</div>` : `<p class="mut">챔피언 목록을 불러오지 못했습니다. 이름을 직접 입력하고 Enter를 누르세요.</p>`}`, 'tall');
  const q = el.querySelector('#cpq');
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = el.querySelector('.cp:not([hidden]):not([disabled])');
    if (first) first.click(); else if (!S.champs.length && q.value.trim()) { closeModal(); pickCb(q.value.trim()); }
  });
  if (matchMedia('(min-width: 800px)').matches) q.focus();
}
act('cpq', (d, el) => {
  const q = el.value.replace(/\s/g, '');
  document.querySelectorAll('.cp').forEach((b) => (b.hidden = !!q && !b.dataset.k.includes(q)));
});
act('cp', (d) => { closeModal(); pickCb?.(d.n); });

// ---------- 선수 선택 ----------
let pickPCb = null;
export function pickPlayer({ title, exclude = [], lane, onPick, allowClear }) {
  pickPCb = onPick;
  const list = S.st.list.filter((s) => !exclude.includes(s.id)).sort((a, b) => (lane ? (b.p.scores?.[lane] || 0) - (a.p.scores?.[lane] || 0) : a.name.localeCompare(b.name, 'ko')));
  modal(`${mh(title)}
    ${allowClear ? '<button class="btn block" data-a="pp" data-id="">자리 비우기</button>' : ''}
    <div class="pplist">${list.map((s) => `<button class="pp" data-a="pp" data-id="${s.id}"><b>${esc(s.name)}</b><small>${LANE_ICON[s.mainLane]} ${lane ? `${LANE_NAME[lane]} ${s.p.scores?.[lane] ?? 0}점` : `평균 ${s.avg.toFixed(1)}`}</small></button>`).join('') || '<p class="mut">선택할 선수가 없습니다.</p>'}</div>`, 'tall');
}
act('pp', (d) => { closeModal(); pickPCb?.(d.id); });

// ---------- 관리자 PIN (가벼운 잠금: 실수·장난 방지용) ----------
async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('naejeon:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const isAdmin = () => S.admin || (!!settings().pinHash && sessionStorage.getItem('naejeon:admin:' + S.key) === settings().pinHash);
export function needAdmin(fn) {
  if (isAdmin()) { S.admin = true; return fn(); }
  const has = !!settings().pinHash;
  const el = modal(`${mh('관리자 확인')}
    <p class="mut">${has ? '점수 수정·경기 삭제 같은 작업은 관리자 PIN이 필요합니다.' : '아직 관리자 PIN이 없습니다. 지금 정하는 PIN이 관리자 PIN이 됩니다. (4자리 이상)'}</p>
    <form class="row" id="pinf"><input class="inp grow" id="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN"><button class="btn pri">확인</button></form>`);
  el.querySelector('#pin').focus();
  el.querySelector('#pinf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = el.querySelector('#pin').value.trim();
    if (v.length < 4) return toast('4자리 이상 입력하세요');
    const hsh = await sha(v);
    if (!has) await S.store.patch('meta', 'settings', { pinHash: hsh });
    else if (hsh !== settings().pinHash) return toast('PIN이 맞지 않습니다');
    S.admin = true; sessionStorage.setItem('naejeon:admin:' + S.key, hsh);
    closeModal(); fn();
  });
}
export const history = (type, before) => S.store.put('history', uid(), { type, at: Date.now(), before });
export { LANES, LANE_NAME, pct };
