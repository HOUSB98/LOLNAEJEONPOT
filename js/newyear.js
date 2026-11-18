// 시즌 장식(새해): 매년 1/1 ~ 1/15 에만 자동으로 켜진다. 인사말 같은 글자는 넣지 않는다.
//  - 시작(로딩) 화면: 밤하늘에 불꽃이 터지고 금빛 풍등이 떠오르며, 아래 산 능선 너머로 새벽빛이 번진다(동화풍)
//  - 채팅창 뒤: 풍등이 천천히 떠오르는 밤하늘 + 아래쪽 해돋이 빛
//  - 사이트 전체: 가끔 화면 위쪽에서 작은 불꽃, 떠다니는 금빛 반짝임, 반짝이 색(금·장밋빛·샴페인)
// 가벼운 모드·창 비활성일 때는 움직임을 멈춘다. 끄기: '시즌 장식' 버튼(naejeon:newyear = '0').
import { act, toast, moreHooks } from './core.js';

import { nySeason, nyOn } from './season.js';
export { nySeason, nyOn };

const KEY = 'naejeon:newyear';
const quiet = () => { const b = document.body.classList; return b.contains('lite') || b.contains('idle') || document.hidden; };
const calm = () => document.body.classList.contains('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 불꽃놀이(캔버스) ----------
const PAL = [['255,214,120', '255,246,210'], ['255,120,150', '255,210,225'], ['140,200,255', '225,240,255'], ['190,140,255', '235,220,255'], ['120,240,190', '220,255,240'], ['255,170,90', '255,230,190']];
function fireworks(cv, o = {}) {
  const g = cv.getContext('2d'); let W = 0, H = 0, rockets = [], sparks = [], raf = 0, last = 0, next = 0;
  const host = o.host || null;
  const fit = () => { W = cv.width = host ? host.clientWidth : innerWidth; H = cv.height = host ? host.clientHeight : innerHeight; };
  fit(); addEventListener('resize', fit);
  const launch = () => {
    const [c1, c2] = PAL[(Math.random() * PAL.length) | 0];
    const tx = W * (0.15 + Math.random() * 0.7), ty = H * (o.top ?? 0.12) + Math.random() * H * (o.span ?? 0.3);
    rockets.push({ x: tx + (Math.random() - 0.5) * 60, y: H + 10, tx, ty, c1, c2, trail: [] });
  };
  const boom = (r) => {
    const n = o.small ? 46 : 90, ring = Math.random() < 0.35, sp = o.small ? 2.600 : 4.200;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random() * 0.1, v = ring ? sp : sp * (0.35 + Math.random() * 0.75);
      sparks.push({ x: r.tx, y: r.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: Math.random() < 0.55 ? r.c1 : r.c2, crackle: Math.random() < 0.25 });
    }
  };
  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 30) return; last = t;
    if (!o.always && quiet()) { g.clearRect(0, 0, W, H); return; }
    if (t > next) { launch(); if (Math.random() < 0.35) launch(); next = t + (o.every || 900) * (0.6 + Math.random() * 0.8); }
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H); // 잔상
    g.globalCompositeOperation = 'lighter';
    rockets = rockets.filter((r) => {
      const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy);
      r.x += dx * 0.06 + Math.sign(dx) * 0.5; r.y += dy * 0.06 - 2.500;
      g.strokeStyle = `rgba(${r.c2},.9)`; g.lineWidth = 2; g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - dx * 0.04, r.y + 12); g.stroke();
      if (d < 14 || r.y <= r.ty) { boom(r); return false; } return true;
    });
    sparks = sparks.filter((p) => (p.l -= o.small ? 0.022 : 0.014) > 0);
    for (const p of sparks) {
      p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.035; p.x += p.vx; p.y += p.vy;
      const a = p.crackle ? p.l * (Math.random() < 0.5 ? 1 : 0.2) : p.l;
      g.fillStyle = `rgba(${p.c},${a})`; g.beginPath(); g.arc(p.x, p.y, o.small ? 1.300 : 1.800, 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
}

// ---------- 풍등 ----------
const LANTERN = `<svg viewBox="0 0 40 52" aria-hidden="true"><defs><radialGradient id="nyLg" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#ffbe55"/><stop offset="1" stop-color="#d9622a"/></radialGradient></defs><path d="M8 6h24l5 34c-2 6-32 6-34 0z" fill="url(#nyLg)"/><path d="M8 6h24" stroke="#ffe7b0" stroke-width="2" stroke-linecap="round"/><path d="M14 8l-2 32M26 8l2 32" stroke="#fff3cf" stroke-opacity=".35" stroke-width="1"/><ellipse cx="20" cy="41" rx="8" ry="3" fill="#fff6d0"/></svg>`;
const lanterns = (n, cls) => Array.from({ length: n }, (_, i) => {
  const s = 0.45 + ((i * 37) % 60) / 100, x = (i * 53) % 100, d = 14 + ((i * 29) % 16), delay = -((i * 7.3) % d);
  return `<i class="${cls}" style="left:${x}%;--s:${s.toFixed(2)};--d:${d}s;--dl:${delay.toFixed(1)}s;--sw:${(i % 2 ? 1 : -1) * (8 + (i % 5) * 4)}px">${LANTERN}</i>`;
}).join('');

// ---------- 시작 화면 ----------
export function nySplash(splash) {
  if (!nyOn()) return;
  splash.classList.add('ny');
  const sc = document.createElement('div'); sc.className = 'ny-scene';
  sc.innerHTML = `<canvas class="ny-stars"></canvas><div class="ny-dawn"></div><canvas class="ny-fw"></canvas><div class="ny-lan">${lanterns(26, 'ny-l')}</div>
    <svg class="ny-hills" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="nyH1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2160"/><stop offset="1" stop-color="#120d33"/></linearGradient><linearGradient id="nyH2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1442"/><stop offset="1" stop-color="#07051a"/></linearGradient></defs>
      <path d="M0 200 L120 150 L230 190 L360 120 L470 180 L600 110 L720 175 L860 125 L980 185 L1100 140 L1200 175 V300 H0z" fill="url(#nyH1)"/>
      <path d="M0 240 C200 200 380 236 600 228 S980 196 1200 222 V300 H0z" fill="url(#nyH2)"/>
      ${[160, 420, 760, 1040].map((x, i) => `<g class="ny-win"><rect x="${x}" y="${232 - (i % 2) * 8}" width="5" height="6" fill="#ffcf6b"/><rect x="${x + 9}" y="${232 - (i % 2) * 8}" width="5" height="6" fill="#ffb24a"/></g>`).join('')}</svg>`;
  splash.prepend(sc);
  if (calm()) return;
  const stops = [];
  (() => { // 별
    const cv = sc.querySelector('.ny-stars'), g = cv.getContext('2d'); let raf; cv.width = innerWidth; cv.height = innerHeight;
    const st = Array.from({ length: Math.round(innerWidth * innerHeight / 6000) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight * 0.7, r: Math.random() * 1.2 + 0.2, p: Math.random() * 6.28 }));
    const loop = (t) => { raf = requestAnimationFrame(loop); g.clearRect(0, 0, cv.width, cv.height); for (const s of st) { g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(s.p + t / 900)); g.fillStyle = '#fff'; g.fillRect(s.x, s.y, s.r, s.r); } g.globalAlpha = 1; };
    raf = requestAnimationFrame(loop); stops.push(() => cancelAnimationFrame(raf));
  })();
  stops.push(fireworks(sc.querySelector('.ny-fw'), { always: true, every: 650, top: 0.08, span: 0.35 }));
  const gone = new MutationObserver(() => { if (!document.body.contains(splash)) { stops.forEach((f) => f()); gone.disconnect(); } });
  gone.observe(document.body, { childList: true });
}

// ---------- 사이트 전체 ----------
let fwStop = null;
function place() {
  const chat = document.getElementById('chat');
  if (chat && !chat.querySelector('#nysky')) {
    const k = document.createElement('div'); k.id = 'nysky';
    k.innerHTML = `<div class="nk-sun"></div>${Array.from({ length: 18 }, (_, i) => `<b style="left:${(i * 37) % 100}%;top:${(i * 53) % 60}%;--d:${(i % 7) * 0.45}s"></b>`).join('')}<div class="nk-lan">${lanterns(9, 'nk-l')}</div><canvas class="nk-fw"></canvas>`;
    chat.prepend(k);
    const cv = k.querySelector('.nk-fw'); requestAnimationFrame(() => { k._stop = fireworks(cv, { host: k, small: true, every: 5200, top: 0.1, span: 0.25 }); });
  }
  if (!fwStop) { const cv = document.createElement('canvas'); cv.id = 'nyfw'; document.body.appendChild(cv); const stop = fireworks(cv, { small: true, every: 14000, top: 0.04, span: 0.16 }); fwStop = () => { stop(); cv.remove(); fwStop = null; }; }
  if (!document.getElementById('nyglint')) { const d = document.createElement('div'); d.id = 'nyglint'; d.innerHTML = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 61) % 100}%;top:${(i * 37) % 100}%;--d:${(i * 0.7) % 5}s"></i>`).join(''); document.body.appendChild(d); }
  const brand = document.querySelector('#side .brand');
  if (brand && !brand.querySelector('.nyspark')) brand.insertAdjacentHTML('afterbegin', `<svg class="nyspark" viewBox="0 0 40 40" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<path d="M20 20 L20 4" stroke="${['#ffd36a', '#ff8fb0', '#9fd4ff', '#c8a8ff'][i % 4]}" stroke-width="2" stroke-linecap="round" transform="rotate(${i * 45} 20 20)"/>`).join('')}<circle cx="20" cy="20" r="3" fill="#fff6d2"/></svg>`);
}
function clear() {
  const k = document.getElementById('nysky'); k?._stop?.(); k?.remove();
  document.getElementById('nyglint')?.remove(); document.querySelector('#side .nyspark')?.remove();
  fwStop?.();
}
function apply() {
  const on = nyOn();
  document.body.classList.toggle('newyear', on);
  if (on) place(); else clear();
  document.querySelectorAll('[data-a="nyToggle"]').forEach((b) => { b.classList.toggle('on', on); const u = b.querySelector('u'); if (u) u.textContent = on ? 'ON' : 'OFF'; });
}
const nyBtn = () => (nySeason() ? `<button class="btn ghost xs xmas-btn ${nyOn() ? 'on' : ''}" data-a="nyToggle" title="불꽃·풍등 같은 시즌 장식 켜기/끄기">✨ 시즌 장식 <u>${nyOn() ? 'ON' : 'OFF'}</u></button>` : '');
act('nyToggle', () => { localStorage.setItem(KEY, nyOn() ? '0' : '1'); apply(); toast(nyOn() ? '시즌 장식을 켰어요' : '시즌 장식을 껐어요'); });
export function initNewYear() {
  if (!nySeason()) return;
  moreHooks.push(nyBtn);
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', nyBtn());
  apply();
  setInterval(() => { if (!nySeason() && document.body.classList.contains('newyear')) apply(); else if (nyOn()) place(); }, 60e3);
}
