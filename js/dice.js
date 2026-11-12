// 라인 주사위: 지원자 이름이 면마다 적힌 주사위 두 개를 굴려 블루/레드 한 명씩 뽑고 라인에 배치한다
import { S, act, esc, modal, closeModal, mh, toast, ic, burst, LANES, LANE_NAME, LANE_ICON } from './core.js';
import { assignLane, placedIds } from './today.js';
import { sysChat } from './social.js';

const DC = { lane: 0, sel: [], rolling: false };
const FACE_H = 62;
const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

function setup() {
  const st = S.st, placed = placedIds();
  const list = [...st.list].sort((a, b) => (b.p.scores?.[LANES[DC.lane]] || 0) - (a.p.scores?.[LANES[DC.lane]] || 0));
  modal(`${mh(`${ic('dice')} 라인 주사위`)}
    <p class="mut">라인을 고르고 지원자를 선택하세요. 주사위 두 개가 각각 한 명씩 뽑아 블루·레드 자리에 넣습니다.</p>
    <div class="seg full">${LANES.map((l, i) => `<button class="${i === DC.lane ? 'on' : ''}" data-a="dcLane" data-i="${i}">${LANE_ICON[l]}${LANE_NAME[l]}</button>`).join('')}</div>
    <div class="ph"><b>지원자</b><span class="tag">${DC.sel.length}명</span><span class="grow"></span><small class="mut">흐린 이름은 이미 다른 자리에 배치된 선수</small></div>
    <div class="chipsel dc">${list.map((s) => `<button class="${DC.sel.includes(s.id) ? 'on' : ''} ${placed.includes(s.id) ? 'placed' : ''}" data-a="dcPick" data-id="${s.id}">${esc(s.name)}<small class="mono">${s.p.scores?.[LANES[DC.lane]] ?? 0}</small></button>`).join('')}</div>
    <button class="btn gold block big" data-a="dcRoll" ${DC.sel.length >= 2 ? '' : 'disabled'}>${ic('dice')}${DC.sel.length >= 2 ? `${DC.sel.length}명으로 주사위 굴리기` : '지원자를 2명 이상 선택하세요'}</button>`, 'tall dice-setup');
}
act('tDice', () => { DC.sel = []; DC.rolling = false; setup(); });
act('dcLane', (d) => { DC.lane = +d.i; setup(); });
act('dcPick', (d) => { DC.sel = DC.sel.includes(d.id) ? DC.sel.filter((x) => x !== d.id) : [...DC.sel, d.id]; setup(); });

function drum(names, cls) {
  const faces = names.length < 4 ? [...names, ...names].slice(0, Math.max(4, names.length * 2)) : names; // 면이 너무 적으면 같은 이름을 반복해 입체감을 만든다
  const n = faces.length, th = 360 / n, r = Math.round(FACE_H / 2 / Math.tan(Math.PI / n));
  return { n, th, faces, html: `<div class="die ${cls}"><div class="die-glow"></div><div class="die-wob"><div class="drum" style="--r:${r}px">${faces.map((nm, i) => `<div class="face" style="transform:rotateX(${i * th}deg) translateZ(${r}px)"><span>${esc(nm)}</span></div>`).join('')}</div></div><div class="die-ptr"></div></div>` };
}
act('dcRoll', () => {
  if (DC.rolling || DC.sel.length < 2) return;
  DC.rolling = true;
  const st = S.st, ids = [...DC.sel], lane = LANES[DC.lane];
  const a = ids[rnd(ids.length)], rest = ids.filter((x) => x !== a), b = rest[rnd(rest.length)];
  const nm = (id) => st.P[id].name, names = ids.map(nm);
  const d1 = drum(names, 'blue'), d2 = drum(names, 'red');
  const el = modal(`<div class="dice-stage lock">
      <div class="ds-head"><small>LANE DRAW</small><h2>${LANE_ICON[lane]}${LANE_NAME[lane]} 라인 추첨</h2><p>지원자 ${ids.length}명 · ${names.map(esc).join(' · ')}</p></div>
      <div class="dice-row"><div class="dcol"><b class="blue">BLUE</b>${d1.html}<div class="dres" id="dres1"></div></div><div class="dvs">VS</div><div class="dcol"><b class="red">RED</b>${d2.html}<div class="dres" id="dres2"></div></div></div>
      <div class="ds-foot" id="dfoot"><span class="mut">주사위가 구르는 중…</span></div></div>`, 'wide dice-modal');
  const spin = (root, d, idx, ms, turns) => {
    const dr = root.querySelector('.drum'), face = d.faces.indexOf(names[idx]);
    dr.style.transition = `transform ${ms}ms cubic-bezier(.12,.72,.14,1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { dr.style.transform = `rotateX(${-(360 * turns + face * d.th)}deg)`; }));
    root.classList.add('rolling');
    return new Promise((res) => setTimeout(() => { root.classList.remove('rolling'); root.classList.add('done'); dr.querySelectorAll('.face')[face].classList.add('win'); res(); }, ms + 60));
  };
  const dies = el.querySelectorAll('.die');
  const reveal = (i, id, side) => {
    const box = el.querySelector('#dres' + i), rc = dies[i - 1].getBoundingClientRect();
    box.innerHTML = `<span class="${side}">${esc(nm(id))}</span>`; box.classList.add('on');
    burst(rc.left + rc.width / 2, rc.top + rc.height / 2, 90);
  };
  spin(dies[0], d1, ids.indexOf(a), 3400, 7).then(() => reveal(1, a, 'blue'));
  spin(dies[1], d2, ids.indexOf(b), 4600, 9).then(() => {
    reveal(2, b, 'red');
    setTimeout(() => {
      assignLane(DC.lane, a, b);
      sysChat(`주사위 · ${LANE_NAME[lane]} 추첨 (${names.join(', ')}) → 블루 ${nm(a)}, 레드 ${nm(b)}`);
      burst(innerWidth / 2, innerHeight / 2, 180);
      el.querySelector('.dice-stage').classList.add('fin');
      el.querySelector('#dfoot').innerHTML = `<p class="dwin">${LANE_ICON[lane]}<b>${esc(nm(a))}</b> <i>&amp;</i> <b>${esc(nm(b))}</b> — ${LANE_NAME[lane]} 확정!</p><div class="row center"><button class="btn" data-a="tDice">다른 라인 추첨</button><button class="btn pri" data-a="close">라인업 확인</button></div><small class="mut">블루·레드 자리에 배치했습니다. 진영은 라인업에서 바꿀 수 있고, 결과는 채팅에 기록됩니다.</small>`;
      DC.rolling = false;
    }, 700);
  });
});
