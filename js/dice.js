// 라인 주사위: 지원자 이름이 면마다 적힌 주사위 두 개를 굴려 블루/레드 한 명씩 뽑고 라인에 배치한다.
// 결과를 meta/dice 문서에 쓰면 접속한 모든 사람의 화면에서 같은 주사위가 같은 결과로 굴러간다(실시간 중계).
import { S, act, esc, modal, mh, toast, ic, burst, LANES, LANE_NAME, LANE_ICON } from './core.js';
import { assignLane, placedIds } from './today.js';
import { sysChat, nick } from './social.js';

const DC = { lane: 0, sel: [], rolling: false };
const FACE_H = 62;
const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
let seen = null;

function setup() {
  const st = S.st, placed = placedIds();
  const list = [...st.list].sort((a, b) => (b.p.scores?.[LANES[DC.lane]] || 0) - (a.p.scores?.[LANES[DC.lane]] || 0));
  const html = `${mh(`${ic('dice')} 라인 주사위`)}
    <p class="mut">라인을 고르고 지원자를 선택하세요. 주사위 두 개가 각각 한 명씩 뽑아 블루·레드 자리에 넣습니다. <b class="good">접속한 모든 사람의 화면에서 함께 굴러갑니다.</b></p>
    <div class="seg full still">${LANES.map((l, i) => `<button class="${i === DC.lane ? 'on' : ''}" data-a="dcLane" data-i="${i}">${LANE_ICON[l]}${LANE_NAME[l]}</button>`).join('')}</div>
    <div class="ph"><b>지원자</b><span class="tag">${DC.sel.length}명</span><span class="grow"></span><small class="mut">흐린 이름은 이미 다른 자리에 배치된 선수</small></div>
    <div class="chipsel dc">${list.map((s) => `<button class="${DC.sel.includes(s.id) ? 'on' : ''} ${placed.includes(s.id) ? 'placed' : ''}" data-a="dcPick" data-id="${s.id}">${esc(s.name)}<small class="mono">${s.p.scores?.[LANES[DC.lane]] ?? 0}</small></button>`).join('')}</div>
    <button class="btn gold block big" data-a="dcRoll" ${DC.sel.length >= 2 ? '' : 'disabled'}>${ic('dice')}${DC.sel.length >= 2 ? `${DC.sel.length}명으로 주사위 굴리기` : '지원자를 2명 이상 선택하세요'}</button>`;
  const open = document.querySelector('#modal.on .sheet.dice-setup');
  if (open) { const y = open.querySelector('.chipsel')?.scrollTop || 0; open.innerHTML = html; open.querySelector('.chipsel').scrollTop = y; } // 다시 그려도 창이 튀지 않게 내용만 바꾼다
  else modal(html, 'tall dice-setup');
}
act('tDice', () => { if (DC.rolling) return; DC.sel = []; setup(); });
act('dcLane', (d) => { DC.lane = +d.i; setup(); });
act('dcPick', (d) => { DC.sel = DC.sel.includes(d.id) ? DC.sel.filter((x) => x !== d.id) : [...DC.sel, d.id]; setup(); });

function drum(names, cls) {
  const faces = names.length < 4 ? [...names, ...names].slice(0, Math.max(4, names.length * 2)) : names; // 면이 너무 적으면 같은 이름을 반복해 입체감을 만든다
  const n = faces.length, th = 360 / n, r = Math.round(FACE_H / 2 / Math.tan(Math.PI / n));
  return { th, faces, html: `<div class="die ${cls}"><div class="die-glow"></div><div class="die-wob"><div class="drum">${faces.map((nm, i) => `<div class="dface" style="transform:rotateX(${i * th}deg) translateZ(${r}px)"><span>${esc(nm)}</span></div>`).join('')}</div></div><div class="die-ptr"></div></div>` };
}

act('dcRoll', async () => {
  if (DC.rolling || DC.sel.length < 2) return;
  const ids = [...DC.sel], a = ids[rnd(ids.length)], rest = ids.filter((x) => x !== a), b = rest[rnd(rest.length)];
  const d = { id: Date.now().toString(36) + rnd(1e6).toString(36), at: Date.now(), lane: DC.lane, ids, names: ids.map((x) => S.st.P[x].name), a, b, by: nick() || '익명' };
  seen = d.id;
  S.store.put('meta', 'dice', d).catch((e) => toast('중계 전송 실패: ' + (e.code || e.message)));
  play(d, true);
});

// meta 문서가 바뀔 때마다 호출된다. 처음 접속했을 때의 기존 결과는 다시 재생하지 않는다.
export function watchDice(initial) {
  const d = S.store.data.meta?.dice;
  if (initial || seen === null) { seen = d?.id || ''; return; }
  if (!d || d.id === seen) return;
  seen = d.id;
  if (Date.now() - d.at > 30000 || DC.rolling) return;
  play(d, false);
}

// 주사위 이펙트: 구르는 동안 주사위 위아래로 불티가 튀고, 멈추는 순간 사방으로 터진다
function diceFx(stage, dies) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { stop() {}, boom() {} };
  const cv = document.createElement('canvas'); cv.className = 'dice-fx'; stage.prepend(cv);
  const g = cv.getContext('2d'), on = [true, true], TONE = [['120,170,255', '205,225,255'], ['255,120,150', '255,205,215']];
  let parts = [];
  const center = (i) => { const s = stage.getBoundingClientRect(), r = dies[i].getBoundingClientRect(); return [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2]; };
  const add = (x, y, vx, vy, c, r, life) => parts.push({ x, y, vx, vy, c, r, life, max: life });
  (function loop() {
    if (!document.body.contains(cv)) return;
    if (cv.width !== stage.clientWidth || cv.height !== stage.clientHeight) { cv.width = stage.clientWidth; cv.height = stage.clientHeight; }
    dies.forEach((_, i) => {
      if (!on[i]) return;
      const [cx, cy] = center(i);
      for (let k = 0; k < 6; k++) { const up = Math.random() < 0.5 ? -1 : 1; add(cx + (Math.random() - 0.5) * 200, cy + up * 30, (Math.random() - 0.5) * 6, up * (2 + Math.random() * 8), Math.random() < 0.35 ? '255,232,160' : TONE[i][(Math.random() * 2) | 0], 1 + Math.random() * 2.200, 0.45 + Math.random() * 0.5); }
    });
    g.clearRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vy += 0.14; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= 0.017;
      const al = Math.max(0, p.life / p.max);
      g.strokeStyle = `rgba(${p.c},${al})`; g.lineWidth = p.r * (0.4 + al);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2.400, p.y - p.vy * 2.400); g.stroke();
    }
    requestAnimationFrame(loop);
  })();
  return {
    stop(i) { on[i] = false; },
    boom(i) { const [cx, cy] = center(i); for (let k = 0; k < 150; k++) { const th = Math.random() * 6.283, v = 4 + Math.random() * 17; add(cx + Math.cos(th) * 60, cy + Math.sin(th) * 20, Math.cos(th) * v, Math.sin(th) * v * 0.8 - 2, Math.random() < 0.4 ? '255,240,190' : TONE[i][(Math.random() * 2) | 0], 1.500 + Math.random() * 3, 0.8 + Math.random() * 0.8); } },
  };
}

function play(d, mine) {
  DC.rolling = true;
  const lane = LANES[d.lane], names = d.names, ia = d.ids.indexOf(d.a), ib = d.ids.indexOf(d.b);
  const d1 = drum(names, 'blue'), d2 = drum(names, 'red');
  const el = modal(`<div class="dice-stage lock">
      <div class="ds-head"><small>${mine ? 'LANE DRAW' : `LIVE · ${esc(d.by)} 님이 굴리는 중`}</small><h2>${LANE_ICON[lane]}${LANE_NAME[lane]} 라인 추첨</h2><p>지원자 ${names.length}명 · ${names.map(esc).join(' · ')}</p></div>
      <div class="dice-row"><div class="dcol"><b class="blue">BLUE</b>${d1.html}<div class="dres" id="dres1"></div></div><div class="dvs">VS</div><div class="dcol"><b class="red">RED</b>${d2.html}<div class="dres" id="dres2"></div></div></div>
      <div class="ds-foot" id="dfoot"><span class="mut">주사위가 구르는 중…</span></div></div>`, 'wide dice-modal');
  const spin = (root, dd, idx, ms, turns) => {
    const dr = root.querySelector('.drum'), face = dd.faces.indexOf(names[idx]);
    dr.style.transition = `transform ${ms}ms cubic-bezier(.12,.72,.14,1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { dr.style.transform = `rotateX(${-(360 * turns + face * dd.th)}deg)`; }));
    root.classList.add('rolling');
    return new Promise((res) => setTimeout(() => { root.classList.remove('rolling'); root.classList.add('done'); dr.querySelectorAll('.dface')[face].classList.add('win'); res(); }, ms + 60));
  };
  const dies = el.querySelectorAll('.die');
  const fx = diceFx(el.querySelector('.dice-stage'), [...dies]);
  const reveal = (i, name, side) => {
    const box = el.querySelector('#dres' + i), rc = dies[i - 1].getBoundingClientRect();
    box.innerHTML = `<span class="${side}">${esc(name)}</span>`; box.classList.add('on');
    fx.stop(i - 1); fx.boom(i - 1);
    burst(rc.left + rc.width / 2, rc.top + rc.height / 2, 90);
  };
  spin(dies[0], d1, ia, 3400, 7).then(() => reveal(1, names[ia], 'blue'));
  spin(dies[1], d2, ib, 4600, 9).then(() => {
    reveal(2, names[ib], 'red');
    setTimeout(() => {
      if (S.st.P[d.a] && S.st.P[d.b]) assignLane(d.lane, d.a, d.b);
      if (mine) sysChat(`주사위 · ${LANE_NAME[lane]} 추첨 (${names.join(', ')}) → 블루 ${names[ia]}, 레드 ${names[ib]}`);
      burst(innerWidth / 2, innerHeight / 2, 180);
      el.querySelector('.dice-stage').classList.add('fin');
      el.querySelector('#dfoot').innerHTML = `<p class="dwin">${LANE_ICON[lane]}<b>${esc(names[ia])}</b> <i>&amp;</i> <b>${esc(names[ib])}</b> — ${LANE_NAME[lane]} 확정!</p><div class="row center">${mine ? '<button class="btn" data-a="tDice">다른 라인 추첨</button>' : ''}<button class="btn pri" data-a="close">라인업 확인</button></div><small class="mut">오늘의 내전 라인업에 배치했습니다. 진영은 라인업에서 바꿀 수 있습니다.</small>`;
      DC.rolling = false;
    }, 700);
  });
}
