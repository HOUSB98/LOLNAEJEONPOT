// 오늘의 내전 연출: 팀 확정을 묻는 마스코트 "포트" + 예상 승률 공개(바퀴 회전) 이펙트
import { burst } from './core.js';

// 마스코트 "포트": 사이트 이름(NAEJEON-POT)에서 따온 꼬마 냄비. 직접 그린 SVG라 이미지 파일이 필요 없다.
export const mascot = () => `<svg class="pot" viewBox="0 0 120 120" aria-hidden="true">
  <defs><linearGradient id="pot-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".55" stop-color="#e9b44c"/><stop offset="1" stop-color="#b47a1e"/></linearGradient>
    <linearGradient id="pot-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe9f5"/><stop offset="1" stop-color="#2fa9c4"/></linearGradient></defs>
  <g class="pot-steam" fill="none" stroke="#bfefff" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M44 20c-5-6 5-9 0-15"/><path d="M60 16c-5-6 5-9 0-15"/><path d="M76 20c-5-6 5-9 0-15"/></g>
  <g class="pot-arm"><path d="M97 70c10-4 14-12 13-22" fill="none" stroke="#b47a1e" stroke-width="7" stroke-linecap="round"/><circle cx="110" cy="46" r="7" fill="#ffe9a8" stroke="#b47a1e" stroke-width="2.5"/></g>
  <path d="M22 70c-10 2-13 10-9 18" fill="none" stroke="#b47a1e" stroke-width="7" stroke-linecap="round"/><circle cx="14" cy="90" r="7" fill="#ffe9a8" stroke="#b47a1e" stroke-width="2.5"/>
  <ellipse cx="60" cy="112" rx="34" ry="5" fill="#000" opacity=".35"/>
  <path d="M24 50h72v32a28 28 0 0 1-28 28H52a28 28 0 0 1-28-28z" fill="url(#pot-g)" stroke="#7a5212" stroke-width="3" stroke-linejoin="round"/>
  <path d="M32 58v22a20 20 0 0 0 10 17" fill="none" stroke="#fff7dc" stroke-width="4" stroke-linecap="round" opacity=".55"/>
  <g class="pot-lid"><rect x="18" y="40" width="84" height="13" rx="6.500" fill="url(#pot-l)" stroke="#156a80" stroke-width="3"/><path d="M40 40c2-12 38-12 40 0z" fill="url(#pot-l)" stroke="#156a80" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="27" r="6" fill="#ffe9a8" stroke="#7a5212" stroke-width="2.5"/></g>
  <g class="pot-eyes"><ellipse cx="46" cy="74" rx="6" ry="7.500" fill="#2a1a05"/><ellipse cx="74" cy="74" rx="6" ry="7.500" fill="#2a1a05"/><circle cx="48" cy="71" r="2.300" fill="#fff"/><circle cx="76" cy="71" r="2.300" fill="#fff"/></g>
  <ellipse cx="36" cy="85" rx="6" ry="3.500" fill="#ff8a7a" opacity=".7"/><ellipse cx="84" cy="85" rx="6" ry="3.500" fill="#ff8a7a" opacity=".7"/>
  <path d="M53 86c3 6 11 6 14 0z" fill="#7a2a1a" stroke="#2a1a05" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

const W0 = 2100, T_POP = 520, T1 = 1500, T2 = 3700; // 처음 회전 속도(도/초), 튀어나오는 시간, 전속력 구간, 감속 구간(ms)
const FIRE = ['255,244,214', '255,214,120', '255,170,60', '255,110,50', '246,227,168'];

// pb: 블루 예상 승률(0~100 정수), from: 화면의 원래 승률 링(여기서 튀어나온다)
export function reveal({ pb, from, onDone, blue = [], red = [], by = '', startAt = Date.now() }) {
  if (document.querySelector('.rv')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ov = document.createElement('div');
  ov.className = 'rv';
  const names = (a) => (a.length ? `<em>${a.map((n) => String(n).replace(/[&<>"]/g, '')).join(' · ')}</em>` : '');
  ov.innerHTML = `<canvas></canvas>${by ? `<div class="rv-live"><i class="live"></i>LIVE · ${String(by).replace(/[&<>"]/g, '')} 님이 팀을 확정했습니다</div>` : ''}<div class="rv-row">
    <div class="rv-side blue"><small>BLUE TEAM</small><b class="mono"><span>?</span><i>%</i></b>${names(blue)}</div>
    <div class="rv-wheel" style="--p:${pb}"><div class="rv-glow"></div><div class="rv-spin"><div class="rv-tire"></div><div class="rv-disc"></div><div class="rv-spokes"></div></div><div class="rv-streak"></div><div class="rv-hub"><small>예상 승률</small><b>VS</b></div><div class="rv-shock"></div></div>
    <div class="rv-side red"><small>RED TEAM</small><b class="mono"><span>?</span><i>%</i></b>${names(red)}</div></div>
    <p class="rv-msg"></p><button class="btn pri rv-close">확인</button><small class="rv-skip">화면을 누르면 바로 결과를 봅니다</small>`;
  document.body.appendChild(ov);
  const wheel = ov.querySelector('.rv-wheel'), spin = ov.querySelector('.rv-spin'), cv = ov.querySelector('canvas'), g = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
  fit(); addEventListener('resize', fit);
  if (from) { // 원래 링 자리에서 화면 가운데로 튀어나온다
    const a = from.getBoundingClientRect(), b = wheel.getBoundingClientRect();
    wheel.animate([{ transform: `translate(${a.left + a.width / 2 - b.left - b.width / 2}px,${a.top + a.height / 2 - b.top - b.height / 2}px) scale(${a.width / b.width})` }, { transform: 'none' }], { duration: T_POP, easing: 'cubic-bezier(.2,1.5,.3,1)' });
  }
  const total = (W0 * T1) / 1000 + (W0 * T2) / 3000, a0 = -(total % 360); // 끝났을 때 정확히 제자리(블루가 왼쪽)로 멈추도록 시작 각도를 맞춘다
  // startAt은 모든 브라우저가 공유하는 wall-clock 시각이다.
  // Firestore snapshot 수신 시점이 서로 조금 달라도, 같은 시각에 애니메이션이 시작되도록 대기한다.
  const startDelay = Math.max(0, startAt - Date.now());
  let t0 = performance.now() + startDelay + T_POP * 0.7, raf = 0, done = false, closed = false, parts = [];
  if (reduce) t0 -= T1 + T2 + T_POP;
  const spark = (x, y, vx, vy, c, r, life) => parts.push({ x, y, vx, vy, c, r, life, max: life });
  function frame(now) {
    const t = now - t0;
    let ang = a0, k = 0;
    if (t >= T1 + T2) ang = a0 + total;
    else if (t >= T1) { const u = (t - T1) / T2; ang = a0 + (W0 * T1) / 1000 + ((W0 * T2) / 3000) * (1 - (1 - u) ** 3); k = (1 - u) ** 2; }
    else if (t >= 0) { ang = a0 + (W0 * t) / 1000; k = 1; }
    spin.style.transform = `rotate(${ang}deg)`;
    wheel.style.setProperty('--k', k.toFixed(3));
    wheel.style.translate = k > 0.05 ? `${(Math.random() - 0.5) * 7 * k}px ${(Math.random() - 0.5) * 7 * k}px` : '';
    const r = wheel.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    if (!closed) {
      for (let i = 0; i < k * 16; i++) { // 테두리 전체에서 회전 방향으로 튀는 불티
        const th = Math.random() * 6.283, v = (5 + Math.random() * 13) * (0.35 + k), out = Math.random() * 4;
        const c = Math.random() < 0.3 ? (Math.cos(th) < 0 ? '120,170,255' : '255,120,150') : FIRE[(Math.random() * FIRE.length) | 0];
        spark(cx + Math.cos(th) * R, cy + Math.sin(th) * R, -Math.sin(th) * v + Math.cos(th) * out, Math.cos(th) * v + Math.sin(th) * out, c, 1 + Math.random() * 2.200, 0.5 + Math.random() * 0.6);
      }
      for (let i = 0; i < k * 10; i++) { // 바닥에서 뒤로 쏟아지는 불꽃(바퀴가 헛도는 느낌)
        const th = 1.571 + (Math.random() - 0.5) * 0.5, v = 9 + Math.random() * 20;
        spark(cx + Math.cos(th) * R, cy + Math.sin(th) * R, -v * (0.6 + k * 0.6), -Math.random() * 7 - 1, FIRE[(Math.random() * 4) | 0], 1.500 + Math.random() * 3, 0.6 + Math.random() * 0.7);
      }
    }
    g.clearRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= 0.016;
      const al = Math.max(0, p.life / p.max);
      g.strokeStyle = `rgba(${p.c},${al})`; g.lineWidth = p.r * (0.4 + al);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2.200, p.y - p.vy * 2.200); g.stroke();
    }
    if (t >= T1 + T2 && !done) finish(cx, cy, R);
    if (!closed && (!done || parts.length)) raf = requestAnimationFrame(frame); else g.clearRect(0, 0, cv.width, cv.height);
  }
  function finish(cx, cy, R) {
    done = true; ov.classList.add('done');
    for (let i = 0; i < 160; i++) { const th = Math.random() * 6.283, v = 6 + Math.random() * 16; spark(cx + Math.cos(th) * R, cy + Math.sin(th) * R, Math.cos(th) * v, Math.sin(th) * v - 3, Math.cos(th) < 0 ? '120,170,255' : '255,120,150', 1.500 + Math.random() * 3, 0.8 + Math.random() * 0.8); }
    const [bEl, rEl] = ov.querySelectorAll('.rv-side span'), c0 = performance.now(), dur = reduce ? 1 : 1100;
    (function count(now) { const u = Math.min(1, (now - c0) / dur), e = 1 - (1 - u) ** 3; bEl.textContent = Math.round(pb * e); rEl.textContent = Math.round((100 - pb) * e); if (u < 1) requestAnimationFrame(count); })(c0);
    const gap = Math.abs(pb - 50), fav = pb >= 50 ? '블루' : '레드';
    ov.querySelector('.rv-msg').textContent = gap <= 2 ? '황금 밸런스! 누가 이겨도 이상하지 않은 승부입니다.' : gap <= 6 ? `팽팽한 승부, ${fav}가 근소하게 앞섭니다.` : gap <= 12 ? `${fav} 우세. 하지만 뒤집기에 충분한 차이입니다.` : `${fav} 쪽으로 많이 기울었습니다. 팀을 다시 맞춰 보는 건 어떨까요?`;
    if (!reduce) setTimeout(() => { if (closed) return; burst(cx - R * 1.800, cy, 90); burst(cx + R * 1.800, cy, 90); }, 250);
  }
  function close() {
    if (closed) return; closed = true;
    removeEventListener('resize', fit); removeEventListener('keydown', key);
    ov.classList.add('out'); setTimeout(() => ov.remove(), 320);
    onDone?.();
  }
  const key = (e) => { if (e.key === 'Escape' || (done && e.key === 'Enter')) close(); };
  addEventListener('keydown', key);
  ov.addEventListener('click', (e) => {
    if (!done) { t0 = performance.now() - T1 - T2; return; } // 돌아가는 중에 누르면 건너뛰기
    if (e.target.closest('.rv-close') || e.target === ov) close();
  });
  raf = requestAnimationFrame(frame);
}
