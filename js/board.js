// 라인 지원: 참가자가 원하는 라인(탑~서폿·상관없음)을 고르고, 마감하면 몰린 라인은 추첨해 바로 라인업에 넣는다.
// meta/board 문서 하나로 모든 접속자가 같은 게시판, 같은 추첨, 같은 총격 연출을 같은 시각에 본다(시작 시각은 서버 시계 기준).
import { S, act, esc, modal, closeModal, mh, toast, burst, refresh, calm, ic, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
import { setDraftTeams, placedIds } from './today.js';
import { sysChat, nick } from './social.js';

const OPTS = [...LANES, 'any'];
const NAME = { ...LANE_NAME, any: '상관없음' };
const QUEST = { top: '고독한 섬의 수문장', jg: '협곡 숲의 사냥꾼', mid: '중앙 협곡의 마도사', adc: '원거리 저격수', sup: '동료를 지키는 수호자', any: '어디든 가는 떠돌이 용병' };
const RANK = { top: 'A', jg: 'S', mid: 'S', adc: 'A', sup: 'B', any: '?' };
const ANY_ICON = '<svg class="lic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 14.6 8.6 21.5 9.2 16.2 13.700 17.900 20.500 12 16.800 6.100 20.500 7.800 13.700 2.500 9.200 9.400 8.600z"/></svg>';
const icon = (o) => (o === 'any' ? ANY_ICON : LANE_ICON[o]);

const BD = { me: localStorage.getItem('naejeon:bdme:' + S.key) || '', sel: [], playing: '', timers: [], muted: localStorage.getItem('naejeon:bdmute') === '1', prev: {} };
const cur = () => { const d = S.store?.data?.meta?.board; return d && d.rid ? d : null; };
const nm = (id) => S.st.P[id]?.name || '?';
const live = (d) => d && (d.status === 'open' || d.status === 'play') && S.store.serverNow() - (+d.at || 0) < 6 * 3600e3;
const view = () => document.querySelector('#modal.on .gb');
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const tilt = (o) => ((hash(o + 'tilt') % 70) - 35) / 10; // 의뢰서마다 고정된 기울기(다시 그려도 흔들리지 않게)
export const boardLive = () => live(cur());

// ---------- 효과음(파일 없이 Web Audio로 만든다) ----------
let AC = null;
const ac = () => { try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch { return null; } };
document.addEventListener('pointerdown', () => { if (AC?.state === 'suspended') AC.resume(); }, { passive: true });
function sfx(kind) {
  if (BD.muted) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime, out = a.createGain(); out.connect(a.destination);
  const noise = (dur, pow, freq, vol, type = 'lowpass') => {
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, pow);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(out); s.start(t);
  };
  const tone = (f0, f1, dur, vol, type = 'sine') => {
    const o = a.createOscillator(), g = a.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  };
  if (kind === 'bang') { noise(0.9, 5, 2400, 0.55); noise(0.25, 2, 6000, 0.25, 'highpass'); tone(140, 38, 0.35, 0.7); }
  else if (kind === 'tick') tone(1500, 900, 0.05, 0.12, 'square');
  else if (kind === 'stamp') { tone(220, 60, 0.18, 0.5); noise(0.12, 3, 900, 0.3); }
  else if (kind === 'pin') { tone(2400, 1800, 0.08, 0.12, 'triangle'); noise(0.06, 3, 3000, 0.12); }
  else if (kind === 'horn') { tone(220, 330, 0.5, 0.18, 'sawtooth'); tone(330, 440, 0.7, 0.12, 'triangle'); }
  else if (kind === 'cock') { noise(0.05, 2, 4000, 0.3, 'highpass'); setTimeout(() => sfx('tick'), 90); }
  else if (kind === 'step') { tone(95, 55, 0.09, 0.35); noise(0.06, 3, 500, 0.25); }
  else if (kind === 'spur') { tone(3200, 2700, 0.18, 0.06, 'triangle'); setTimeout(() => tone(3400, 2900, 0.2, 0.05, 'triangle'), 110); }
  else if (kind === 'heart') { tone(70, 45, 0.13, 0.55); setTimeout(() => sfx('heart2'), 170); }
  else if (kind === 'heart2') tone(60, 40, 0.12, 0.4);
  else if (kind === 'wind') noise(3.5, 0.6, 420, 0.07);
}

// ---------- 그리기 ----------
const hole = (seed, cls = '') => {
  const h = hash(seed), x = 26 + (h % 48), y = 15 + ((h >> 8) % 18), r = (h >> 16) % 360; // 이름표를 가리지 않게 위쪽(문양 부근)에 쏜다
  const cracks = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * 6.283 + ((h >> i) % 10) / 10, l = 22 + ((h >> (i + 3)) % 18); return `M${50 + Math.cos(a) * 9} ${50 + Math.sin(a) * 9}L${50 + Math.cos(a) * l} ${50 + Math.sin(a) * l}`; }).join('');
  return `<svg class="hole ${cls}" style="left:${x}%;top:${y}%;--r:${r}deg" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="30" fill="#2a1505" opacity=".28"/><circle cx="50" cy="50" r="19" fill="#3a1d07" opacity=".55"/>
    <path d="${cracks}" stroke="#2a1606" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".8"/>
    <path d="M50 38 57 41 62 48 60 57 53 62 45 61 39 55 38 47 43 41z" fill="#e6d2a0" opacity=".7" transform="translate(1.5 1.5)"/>
    <path d="M50 38 57 41 62 48 60 57 53 62 45 61 39 55 38 47 43 41z" fill="#080402"/>
    <circle cx="50" cy="50" r="12.5" fill="none" stroke="#1a0c03" stroke-width="2.5" opacity=".7"/></svg>`;
};
const laneOf = (d, id, lanes) => lanes.find((l) => d.result?.[l]?.includes(id));
function anyTags(d, lanes) { // 상관없음 종이: 이미 배치된 용병은 어느 라인으로 갔는지 표시
  return d.ids.filter((id) => d.picks?.[id] === 'any').map((id) => { const l = laneOf(d, id, lanes); return `<span class="gb-tag ${l ? 'sent' : ''}">${esc(nm(id))}${l ? `<i>→${LANE_NAME[l]}</i>` : ''}</span>`; }).join('');
}
function paper(d, o, st) { // st: { done, result }
  const ids = d.ids.filter((id) => d.picks?.[id] === o), res = st.result?.[o];
  const tags = o === 'any' && st.done ? anyTags(d, [...st.done]) : res
    ? res.map((id, i) => `<span class="gb-tag won ${i ? 'red' : 'blue'}"><i>${i ? 'RED' : 'BLUE'}</i>${esc(nm(id))}</span>`).join('')
    : ids.map((id) => `<span class="gb-tag ${BD.prev[id] === o ? '' : 'new'} ${id === BD.me ? 'me' : ''}">${esc(nm(id))}</span>`).join('');
  const crowd = o !== 'any' && ids.length > 2, short = o !== 'any' && ids.length < 2;
  return `<button class="gb-paper ${o} ${st.done ? 'shot' : ''} ${d.status !== 'open' ? 'locked' : ''} ${BD.me && d.picks?.[BD.me] === o ? 'mine' : ''}" data-a="bdPick" data-o="${o}" data-lane="${o}" style="--t:${tilt(o)}deg;--lc:${LANE_COLOR[o] || '#b98a3e'}">
    <i class="gb-pin"></i>
    <span class="gb-rank">${RANK[o]}</span>
    <small class="gb-kind">${o === 'any' ? 'MERCENARY' : 'QUEST'}</small>
    <span class="gb-ico">${icon(o)}</span>
    <b class="gb-title">${NAME[o]}</b>
    <em class="gb-flavor">${QUEST[o]}</em>
    <span class="gb-need">${o === 'any' ? '빈 자리 어디든 투입' : `모집 2명 · <u class="${crowd ? 'hot' : short ? 'low' : 'ok'}">지원 ${ids.length}명</u>`}</span>
    <span class="gb-tags">${tags || '<span class="gb-empty">아직 지원자 없음</span>'}</span>
    ${st.done && o !== 'any' ? `${hole(d.rid + o)}<span class="gb-stamp">모집 완료</span>` : ''}
  </button>`;
}
function inner(d, st = {}) {
  const picked = d.ids.filter((id) => d.picks?.[id]).length, isMe = d.ids.includes(BD.me);
  const roster = d.ids.map((id) => { const p = d.picks?.[id]; return `<button class="gb-mem ${id === BD.me ? 'me' : ''} ${p ? 'ok' : ''}" data-a="bdMe" data-id="${id}" ${d.status !== 'open' ? 'disabled' : ''}><i class="gb-seal">${p ? icon(p) : '…'}</i>${esc(nm(id))}${id === BD.me ? '<small>나</small>' : ''}</button>`; }).join('');
  const foot = d.status === 'open'
    ? `<div class="gb-foot"><span class="gb-count"><b class="mono">${picked}</b>/<span class="mono">${d.ids.length}</span> 지원 완료</span><span class="grow"></span><button class="btn ghost xs" data-a="bdShut">취소하기</button><button class="btn pri" data-a="bdGo" ${picked ? '' : 'disabled'}>${ic('bell')}지원 마감 · 추첨 시작</button></div>`
    : d.status === 'done' ? `<div class="gb-foot"><span class="gb-count">편성 완료 · 오늘의 내전 라인업에 반영했습니다${d.left?.length ? ` · 대기: ${d.left.map((x) => esc(nm(x))).join(', ')}` : ''}</span><span class="grow"></span><button class="btn pri" data-a="bdLineup">라인업 확인</button></div>`
      : `<div class="gb-foot"><span class="gb-count gb-livecall">${ic('today')}추첨 진행 중 · 모두 같은 화면을 보고 있습니다</span></div>`;
  return `<div class="gb-dust">${'<i></i>'.repeat(14)}</div><i class="gb-lamp l"></i><i class="gb-lamp r"></i>
    <header class="gb-head"><button class="gb-x" data-a="bdHide" title="닫기 (라인 지원은 계속 열려 있음)">${ic('x')}</button><button class="gb-snd" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button>
      <small>LANE APPLY · LIVE</small><h2>라인 지원</h2>
      <p>${d.status === 'open' ? `원하는 라인을 누르세요. 몰린 라인은 추첨, 빈 라인은 '상관없음' 지원자로 채웁니다.${d.by ? ` <span class="gb-by">게시: ${esc(d.by)}</span>` : ''}` : d.status === 'done' ? '라인이 모두 정해졌습니다!' : '지원 마감! 추첨이 시작됩니다.'}</p></header>
    <div class="gb-board">${OPTS.map((o) => paper(d, o, { done: st.done?.has(o), result: st.result })).join('')}</div>
    <div class="gb-roll"><div class="gb-rh"><b>참가자 명부</b><small>${d.status === 'open' ? (isMe ? `<b>${esc(nm(BD.me))}</b>(으)로 지원 중 · 다른 이름을 누르면 대리 지원` : '먼저 <b>본인 이름</b>을 눌러 주세요') : '지원 마감'}</small></div><div class="gb-mems">${roster}</div></div>
    ${foot}<div class="gb-stage"></div>`;
}
function draw() {
  const el = view(), d = cur();
  if (!el || !d || BD.playing === d.rid) return;
  if (d.status === 'done') { el.classList.remove('playing'); el.innerHTML = finalHTML(d); return; }
  el.innerHTML = inner(d, {});
  el.querySelectorAll('.gb-tag.new').forEach(() => sfx('pin'));
  BD.prev = { ...(d.picks || {}) };
}
function openBoard() {
  const d = cur(); if (!d) return;
  modal(`<div class="gb lock enter"></div>`, 'guild');
  setTimeout(() => view()?.classList.remove('enter'), 1200);
  BD.prev = { ...(d.picks || {}) };
  if (d.status === 'play') play(d); else draw();
}

// ---------- 열기·지원 ----------
function setup() {
  const st = S.st, last = st.matches[st.matches.length - 1];
  if (!BD.sel.length) { const p = placedIds(); BD.sel = p.length >= 2 ? p : last ? [...last.blue, ...last.red] : []; }
  const list = [...st.list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const html = `${mh(`${ic('scroll')}라인 지원 열기`)}
    <p class="mut">오늘 내전에 참가할 사람을 고르세요. 라인 지원을 열면 <b class="good">접속한 모든 사람의 화면에 함께 뜹니다.</b> 각자 원하는 라인을 고르고, 마감하면 몰린 라인은 추첨해서 라인업에 바로 넣습니다.</p>
    <div class="ph"><b>참가자</b><span class="tag ${BD.sel.length === 10 ? 'ok' : ''}">${BD.sel.length}명</span><span class="grow"></span>${last ? '<button class="btn xs" data-a="bdRecent">최근 내전 참가자</button>' : ''}<button class="btn xs ghost" data-a="bdNone">해제</button></div>
    <div class="chipsel">${list.map((s) => `<button class="${BD.sel.includes(s.id) ? 'on' : ''}" data-a="bdSel" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div>
    <button class="btn pri block big" data-a="bdOpen" ${BD.sel.length >= 2 ? '' : 'disabled'}>${BD.sel.length >= 2 ? `${BD.sel.length}명으로 라인 지원 열기` : '참가자를 2명 이상 고르세요'}</button>`;
  const open = document.querySelector('#modal.on .sheet.gb-setup');
  if (open) { const y = open.querySelector('.chipsel')?.scrollTop || 0; open.innerHTML = html; open.querySelector('.chipsel').scrollTop = y; } else modal(html, 'tall gb-setup');
}
act('tBoard', () => (live(cur()) ? openBoard() : setup()));
act('bdSel', (x) => { BD.sel = BD.sel.includes(x.id) ? BD.sel.filter((i) => i !== x.id) : [...BD.sel, x.id]; setup(); });
act('bdRecent', () => { const l = S.st.matches[S.st.matches.length - 1]; if (l) BD.sel = [...l.blue, ...l.red]; setup(); });
act('bdNone', () => { BD.sel = []; setup(); });
act('bdOpen', async () => {
  if (BD.sel.length < 2) return;
  await S.store.syncServerClock?.();
  const d = { rid: Date.now().toString(36) + rnd(1e6).toString(36), status: 'open', at: S.store.serverNow(), ids: [...BD.sel], picks: {}, by: nick() || '익명' };
  BD.prev = {};
  bseen = d.rid + d.status; // 내 화면은 직접 연다(내 쓰기가 돌아와도 다시 열지 않게)
  try { await S.store.put('meta', 'board', d); } catch (e) { return toast('게시 실패: ' + (e.code || e.message)); }
  sysChat(`라인 지원이 열렸습니다 · 참가자 ${d.ids.length}명`);
  sfx('horn'); openBoard();
});
act('bdMe', (x) => { BD.me = x.id; localStorage.setItem('naejeon:bdme:' + S.key, x.id); draw(); });
act('bdPick', async (x) => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!d.ids.includes(BD.me)) { toast('참가자 명부에서 본인 이름을 먼저 눌러 주세요'); view()?.querySelector('.gb-roll')?.classList.add('nudge'); setTimeout(() => view()?.querySelector('.gb-roll')?.classList.remove('nudge'), 900); return; }
  const me = BD.me, rid = d.rid;
  sfx('pin');
  try {
    await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== rid || r.status !== 'open') return null;
      const picks = { ...(r.picks || {}) };
      if (picks[me] === x.o) delete picks[me]; else picks[me] = x.o;
      return { ...r, picks };
    });
  } catch (e) { toast('지원 실패: ' + (e.code || e.message)); }
});
act('bdHide', () => closeModal());
act('bdMute', () => { BD.muted = !BD.muted; localStorage.setItem('naejeon:bdmute', BD.muted ? '1' : '0'); const b = view()?.querySelector('.gb-snd'); document.querySelectorAll('.gb-snd,.sd-btn[data-a="bdMute"]').forEach((x) => (x.innerHTML = ic(BD.muted ? 'mute' : 'sound'))); });
act('bdShut', async () => {
  const d = cur(); if (!d || !confirm('라인 지원을 취소할까요? 지원 내용이 사라집니다.')) return;
  await S.store.put('meta', 'board', { ...d, status: 'closed' }).catch(() => {});
  closeModal();
});
act('bdLineup', () => { closeModal(); location.hash = '#/today'; });

// ---------- 추첨 계획 ----------
// 1) 지원자가 2명 이상인 라인: 2명이면 바로 확정, 3명 이상이면 추첨으로 2명. 떨어진 사람은 용병으로.
// 2) 모자란 라인: 용병(상관없음 + 추첨 탈락 + 미지원자) 중에서 추첨으로 채운다.
// 블루·레드는 무작위. 이후 교체는 라인업에서 직접 한다.
function plan(d) {
  const by = Object.fromEntries(OPTS.map((o) => [o, []]));
  d.ids.forEach((id) => by[d.picks?.[id] || 'any'].push(id));
  const slots = {}, steps = [];
  let pool = [...by.any];
  for (const l of LANES) {
    const c = by[l];
    if (c.length >= 2) { const s = shuffle(c); slots[l] = s.slice(0, 2); pool.push(...s.slice(2)); steps.push({ lane: l, kind: c.length === 2 ? 'direct' : 'roll', cands: c, pick: s.slice(0, 2), pre: [] }); }
    else slots[l] = [...c];
  }
  pool = shuffle(pool);
  for (const l of LANES) {
    if (by[l].length >= 2) continue;
    const need = 2 - slots[l].length, cands = [...pool], got = pool.splice(0, need);
    steps.push({ lane: l, kind: cands.length > need ? 'roll' : 'direct', cands, pick: got, pre: [...slots[l]], fill: true });
    slots[l].push(...got);
  }
  const result = Object.fromEntries(LANES.map((l) => [l, shuffle(slots[l])]));
  return { steps, result, left: pool };
}
act('bdGo', async () => {
  const d = cur(); if (!d || d.status !== 'open') return;
  const miss = d.ids.filter((id) => !d.picks?.[id]).length;
  if (miss && !confirm(`아직 ${miss}명이 지원하지 않았어요. 미지원자는 '상관없음'으로 보고 마감할까요?`)) return;
  await S.store.syncServerClock?.();
  BD.runner = d.rid; // 내 쓰기가 먼저 돌아와 재생이 시작돼도 내가 라인업을 반영하도록 미리 표시
  toast('결투 준비 중…');
  const hunter = await pickHunter().catch(() => null);
  let mine = null;
  try {
    mine = await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open') return null;
      const p = plan(r);
      return { ...r, status: 'play', startAt: S.store.serverNow() + 1800, ...p, hunter, runner: nick() || '익명' };
    });
  } catch (e) { return toast('추첨 시작 실패: ' + (e.code || e.message)); }
  if (!mine) return;
  const r = S.store.mode === 'local' ? cur() : mine;
  BD.runner = r.rid;
  play(r);
});

// ---------- 추첨 재생: 카우보이 결투 (모든 화면이 같은 시각표를 따른다) ----------
// 몰린 라인(지원자 3명 이상)만 현상금 게시판에 붙는다. 카우보이가 걸어 나와, 라인마다 조준점이 지원자 포스터 사이를
// 천천히 오가다 뽑힌 사람의 포스터를 쏜다(한 라인 2발). 몰리지 않은 라인·용병 배치는 마지막 '최종 편성'에서만 보여 준다.
const T_WALK = 4800, T_LANE = 2800, T_PICK = 5600, T_GAP = 1600;
const HOP = 3200, HOLD = 700; // 한 발: 조준점이 오가는 시간 → 멈춰서 겨누는 시간 → 발사
const now = () => S.store.serverNow();
const wait = (ms) => new Promise((res) => BD.timers.push(setTimeout(res, Math.max(0, ms))));
function clearTimers() { BD.timers.forEach(clearTimeout); BD.timers = []; }
const COWBOY = `<svg class="cbsvg" viewBox="0 0 140 240" aria-hidden="true">
  <defs><linearGradient id="cbRim" x1="0" x2="1"><stop offset="0" stop-color="#0d0703"/><stop offset=".72" stop-color="#1e1108"/><stop offset="1" stop-color="#5a2e12"/></linearGradient></defs>
  <ellipse class="cb-shadow" cx="72" cy="231" rx="44" ry="6" fill="rgba(0,0,0,.45)"/>
  <g class="cb-body" fill="url(#cbRim)" stroke="#e08a3a" stroke-width="1" stroke-linejoin="round">
    <path class="cb-coat" d="M46 140q-6 40-14 70l20-4 6-60zM96 140q6 40 14 70l-20-4-6-60z" fill="#1a0e06"/>
    <g class="cb-leg l"><path d="M57 148 50 222h11l9-74z"/><path d="M44 221h20v8H40z"/><path d="M40 226l-5 3" stroke="#c9a060"/></g>
    <g class="cb-leg r"><path d="M73 148 80 222h11l-6-74z"/><path d="M78 221h20v8H78z"/><path d="M98 226l5 3" stroke="#c9a060"/></g>
    <path d="M58 104 52 134" stroke-width="7" stroke="#140b05"/>
    <path d="M45 82q26-13 52 0l7 70H39z"/>
    <path d="M45 82q26 19 52 0l3 23q-29 17-58 0z" fill="#3a1d0c"/>
    <path d="M44 100q28 14 56 0M43 108q29 15 58 0" fill="none" stroke="#b5562a" stroke-width="1.6" opacity=".8"/>
    <path d="M62 72q9 6 18 0v8q-9 5-18 0z" fill="#9a2b1c" stroke="#e05a3a"/>
    <path d="M78 76l8 10-5 2z" fill="#9a2b1c" stroke="#e05a3a"/>
    <circle cx="71" cy="60" r="13"/>
    <path d="M56 44q2-24 15-22 13-2 15 22z"/>
    <path d="M56.500 42h29v4h-29z" fill="#6a2a14" stroke="none"/>
    <path d="M34 47q37-13 74 0-6 7-37 5-31 2-37-5z"/>
    <path d="M60 140h22v7H60z" fill="#5a3a1a"/><circle cx="71" cy="143.500" r="2.500" fill="#d8b46a" stroke="none"/>
    <path d="M44 146h10v16h-10z" fill="#3a2410"/>
  </g>
  <g class="cb-arm" fill="url(#cbRim)" stroke="#e08a3a" stroke-width="1" stroke-linejoin="round">
    <path d="M84 84h30a4 4 0 0 1 0 8H84z"/>
    <path d="M112 80h22v6h-12v10h-7l-3-9z" fill="#2a2a2e" stroke="#b8bec8"/>
    <circle class="cb-flash" cx="138" cy="83" r="10" fill="#ffd36a" stroke="none"/>
  </g>
</svg>`;
// 하이 눈 스킨 사냥꾼: 추첨을 시작한 사람이 하나를 골라 문서에 적고, 모두 같은 일러스트를 본다. 못 불러오면 실루엣 카우보이.
const HUNTERS = ['Lucian', 'Yasuo', 'Thresh', 'Jhin', 'Senna', 'Ashe', 'Graves', 'Irelia', 'Kayn', 'Darius', 'Viego', 'Sett', 'TwistedFate', 'MissFortune'];
async function pickHunter() {
  if (!S.ver) return null;
  const get = (id) => Promise.race([fetch(`https://ddragon.leagueoflegends.com/cdn/${S.ver}/data/ko_KR/champion/${id}.json`).then((r) => r.json()), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 2500))]);
  for (const id of shuffle(HUNTERS).slice(0, 5)) {
    try {
      const sk = (await get(id)).data[id].skins.filter((x) => /하이\s*눈|high\s*noon/i.test(x.name));
      if (sk.length) { const k = sk[rnd(sk.length)]; return { id, num: k.num, name: k.name }; }
    } catch {}
  }
  return null;
}
const artOf = (h, kind) => `https://ddragon.leagueoflegends.com/cdn/img/champion/${kind}/${h.id}_${h.num}.jpg`;
function loadHunter(sc, h) {
  const art = sc.querySelector('.sd-hart'), tryKind = (kinds) => {
    if (!kinds.length) return sc.classList.remove('hmode'); // 일러스트를 못 받으면 실루엣으로
    const im = new Image(); im.onload = () => { art.style.backgroundImage = `url('${im.src}')`; };
    im.onerror = () => tryKind(kinds.slice(1)); im.src = artOf(h, kinds[0]);
  };
  tryKind(['centered', 'splash']);
}
function sceneHTML(steps, h) {
  return `<div class="sd ${h ? 'hmode' : ''}">
    <div class="sd-sky"><i class="sd-sun"></i><i class="sd-mesa a"></i><i class="sd-mesa b"></i><i class="sd-mesa c"></i></div><div class="sd-ground"></div><i class="sd-weed"></i>
    <div class="sd-top"><button class="sd-btn" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button><button class="sd-skip" data-a="bdSkip">건너뛰기 ▸▸</button></div>
    <div class="sd-title"><small>HIGH NOON · LIVE</small><b>운명의 결투</b><span>몰린 라인만 추첨합니다 · 모두 같은 장면을 보고 있어요</span></div>
    <div class="sd-board"><div class="sd-plank">WANTED · 라인 지원 현상금</div>
      ${steps.map((s) => `<div class="sd-row" data-lane="${s.lane}"><span class="sd-lane" style="--lc:${LANE_COLOR[s.lane]}">${LANE_ICON[s.lane]}<b>${LANE_NAME[s.lane]}</b><small>${s.cands.length}명 중 2명</small></span>
        <div class="sd-posters">${s.cands.map((id) => `<div class="sd-poster" data-id="${id}"><small>WANTED</small><b>${esc(nm(id))}</b><em>${LANE_NAME[s.lane]}</em></div>`).join('')}</div></div>`).join('')}
    </div>
    <div class="sd-reticle"><i></i></div>
    <div class="sd-cb">${COWBOY}</div>
    ${h ? `<div class="sd-hunter"><div class="sd-hart"></div><b class="sd-hname">${esc(h.name)}</b></div>` : ''}
    <div class="sd-cap"></div>
  </div>`;
}
function finalHTML(d) {
  const fill = new Set((d.steps || []).filter((s) => s.fill).flatMap((s) => s.pick));
  const cell = (id, side) => (id ? `<span class="sf-n ${side}">${esc(nm(id))}${fill.has(id) ? '<i>용병</i>' : ''}</span>` : '<span class="sf-n empty">빈 자리</span>');
  return `<div class="sf">
    <div class="sd-top"><button class="sd-btn" data-a="bdClose" title="닫기">${ic('x')}</button></div>
    <small>FINAL LINEUP</small><h3>최종 편성</h3>
    <div class="sf-grid"><span></span><b class="blue">BLUE</b><b class="red">RED</b>
      ${LANES.map((l) => `<span class="sf-l" style="--lc:${LANE_COLOR[l]}">${LANE_ICON[l]}${LANE_NAME[l]}</span>${cell(d.result?.[l]?.[0], 'blue')}${cell(d.result?.[l]?.[1], 'red')}`).join('')}</div>
    ${d.left?.length ? `<p class="sf-left">대기: ${d.left.map((x) => esc(nm(x))).join(', ')}</p>` : ''}
    <div class="row center"><button class="btn pri" data-a="bdLineup">라인업 확인</button><button class="btn ghost" data-a="bdClose">닫기</button></div>
    <p class="hint center">오늘의 내전 라인업에 반영했습니다. 진영·자리 교체는 라인업에서 끌어다 놓으면 됩니다.</p></div>`;
}
function showFinal(el, d) {
  clearTimers();
  BD.playing = '';
  if (!el || !document.body.contains(el)) return;
  el.classList.remove('playing');
  el.innerHTML = finalHTML(d);
  sfx('horn'); burst(innerWidth / 2, innerHeight / 3, 160);
}
const centerIn = (sc, el) => { const a = sc.getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left - a.left + r.width / 2, r.top - a.top + r.height / 2]; };
function pivot(sc) { // 카우보이 어깨(팔 회전축) 위치와 팔 길이(px)
  const a = sc.getBoundingClientRect(), r = sc.querySelector('.cbsvg').getBoundingClientRect(), k = r.width / 140;
  return { x: r.left - a.left + 86 * k, y: r.top - a.top + 88 * k, len: 52 * k };
}
function aim(sc, x, y) {
  const p = pivot(sc), ang = Math.max(-85, Math.min(25, (Math.atan2(y - p.y, x - p.x) * 180) / Math.PI));
  sc.querySelector('.cb-arm').style.transform = `rotate(${ang}deg)`;
  return { ...p, ang };
}
function gun(sc, x, y) { // 총구 위치: 일러스트 모드면 사냥꾼 그림의 오른쪽, 실루엣이면 팔을 돌려서 계산
  const a = sc.getBoundingClientRect();
  if (sc.classList.contains('hmode')) { const r = sc.querySelector('.sd-hunter').getBoundingClientRect(); return { mx: r.left - a.left + r.width * 0.8, my: r.top - a.top + r.height * 0.42 }; }
  const p = aim(sc, x, y), rad = (p.ang * Math.PI) / 180;
  return { mx: p.x + Math.cos(rad) * p.len, my: p.y + Math.sin(rad) * p.len };
}
function dust(sc, x, y, n = 3) {
  for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.className = 'sd-dust'; e.style.cssText = `left:${x + (Math.random() - 0.5) * 30}px;top:${y}px;--dx:${(Math.random() - 0.7) * 50}px;animation-delay:${i * 60}ms`; sc.appendChild(e); setTimeout(() => e.remove(), 1400); }
}
function moveReticle(sc, poster) {
  const [x, y] = centerIn(sc, poster), r = sc.querySelector('.sd-reticle');
  r.style.transform = `translate(${x}px,${y}px)`; r.classList.add('on');
  return [x, y];
}
function caption(sc, html) { const c = sc.querySelector('.sd-cap'); c.innerHTML = html; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
function markShot(sc, d, lane, id, fresh) {
  const po = sc.querySelector(`.sd-row[data-lane="${lane}"] .sd-poster[data-id="${id}"]`);
  if (!po || po.classList.contains('shot')) return;
  po.classList.add('shot');
  po.insertAdjacentHTML('beforeend', `${hole(d.rid + lane + id, fresh ? 'fresh' : '')}<span class="sd-stamp">채용</span>`);
  if (!fresh) return;
  const [x, y] = centerIn(sc, po), a = sc.getBoundingClientRect();
  sparks(a.left + x, a.top + y);
  for (let i = 0; i < 5; i++) { const sm = document.createElement('i'); sm.className = 'gb-smoke'; sm.style.cssText = `left:${x}px;top:${y}px;--dx:${(Math.random() - 0.5) * 90}px;--dy:${-30 - Math.random() * 70}px;animation-delay:${i * 70}ms`; sc.appendChild(sm); setTimeout(() => sm.remove(), 1700); }
  sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
  setTimeout(() => sfx('stamp'), 260);
}
async function duel(sc, d, s, id, late, alive) {
  const row = sc.querySelector(`.sd-row[data-lane="${s.lane}"]`);
  const pool = [...row.querySelectorAll('.sd-poster:not(.shot)')], target = row.querySelector(`.sd-poster[data-id="${id}"]`);
  if (!target) return;
  if (late < HOP) {
    // 조준점이 포스터 사이를 오가며 점점 느려지다 뽑힌 사람에서 멈춘다(심장 박동 소리)
    const order = [], n = pool.length, ti = pool.indexOf(target), hops = 2 * n + ((ti - (n ? 0 : 0) + n) % n);
    for (let k = 0; k <= hops; k++) order.push(pool[k % n]);
    const w = order.map((_, k) => 1 + Math.pow(k / hops, 2.4) * 7), sum = w.reduce((a, b) => a + b, 0), budget = HOP - late;
    for (let k = 0; k < order.length; k++) {
      if (!alive()) return;
      const [x, y] = moveReticle(sc, order[k]); if (!sc.classList.contains('hmode')) aim(sc, x, y);
      if (k % 2 === 0) sfx('heart');
      await wait((w[k] / sum) * budget);
    }
  }
  if (!alive()) return;
  const [x, y] = moveReticle(sc, target), g = gun(sc, x, y);
  sc.querySelector('.sd-reticle').classList.add('lock');
  sfx('cock');
  await wait(late > HOP ? 0 : HOLD);
  if (!alive()) return;
  // 발사: 총구 섬광 → 총알 궤적 → 명중
  const { mx, my } = gun(sc, x, y), dist = Math.hypot(x - mx, y - my);
  sfx('bang');
  const who = sc.querySelector(sc.classList.contains('hmode') ? '.sd-hunter' : '.sd-cb'); who.classList.remove('fire'); void who.offsetWidth; who.classList.add('fire');
  const mz = document.createElement('i'); mz.className = 'sd-muzzle'; mz.style.cssText = `left:${mx}px;top:${my}px`; sc.appendChild(mz); setTimeout(() => mz.remove(), 500);
  const tr = document.createElement('i'); tr.className = 'sd-tracer'; tr.style.cssText = `left:${mx}px;top:${my}px;width:${dist}px;transform:rotate(${Math.atan2(y - my, x - mx)}rad)`; sc.appendChild(tr); setTimeout(() => tr.remove(), 900);
  const fl = document.createElement('div'); fl.className = 'gb-flash sd-flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 500);
  await wait(170);
  sc.querySelector('.sd-reticle').classList.remove('on', 'lock');
  markShot(sc, d, s.lane, id, true);
  caption(sc, `<b>${esc(nm(id))}</b> ${LANE_NAME[s.lane]} 확정!`);
}
function walkIn(sc, ms) {
  const hm = sc.classList.contains('hmode'), who = sc.querySelector(hm ? '.sd-hunter' : '.sd-cb');
  who.style.transition = `left ${ms}ms ${hm ? 'cubic-bezier(.2,.7,.3,1)' : 'linear'}`; who.classList.add('walking');
  requestAnimationFrame(() => requestAnimationFrame(() => who.classList.add('in')));
  const a = () => sc.getBoundingClientRect(), feet = () => { const r = who.getBoundingClientRect(); return [r.left - a().left + r.width * (hm ? 0.45 : 0.5), r.bottom - a().top - 6]; };
  for (let t = 300; t < ms - 200; t += 560) BD.timers.push(setTimeout(() => { sfx('step'); const [x, y] = feet(); dust(sc, x, y, 2); }, t));
  BD.timers.push(setTimeout(() => { who.classList.remove('walking'); sfx('spur'); const [x, y] = feet(); dust(sc, x, y, 5); }, ms));
}
async function play(d) {
  if (BD.playing === d.rid && view()?.querySelector('.sd')) return;
  clearTimers(); clearTimeout(BD.finT);
  if (!view()) modal('<div class="gb lock"></div>', 'guild');
  const el = view();
  BD.playing = d.rid; BD.d = d; BD.skipped = false;
  const steps = (d.steps || []).filter((s) => s.kind === 'roll' && !s.fill && s.pick.length);
  const start = +d.startAt || now(), walk = steps.length ? T_WALK : 0;
  let t = start + walk;
  const tl = steps.map((s) => { const ln = { s, at: t, picks: [] }; t += T_LANE; for (const id of s.pick) { ln.picks.push({ id, at: t }); t += T_PICK; } t += T_GAP; return ln; });
  const end = t;
  // 라인업 반영은 건너뛰기와 상관없이 시각표의 끝에 한 번(추첨을 시작한 사람, 없으면 남은 사람)
  BD.finT = setTimeout(() => finishRun(d), Math.max(0, end - now()) + (BD.runner === d.rid ? 0 : 3000));
  if (!steps.length || now() >= end) return showFinal(el, d);
  el.innerHTML = sceneHTML(steps, d.hunter); el.classList.add('playing');
  const sc = el.querySelector('.sd');
  if (d.hunter) loadHunter(sc, d.hunter);
  const alive = () => BD.playing === d.rid && !BD.skipped && document.body.contains(sc);
  const done = new Set();
  for (const ln of tl) for (const p of ln.picks) if (p.at + HOP + HOLD + 200 <= now()) { markShot(sc, d, ln.s.lane, p.id, false); done.add(ln.s.lane + p.id); }
  sfx('wind');
  if (now() < start + walk) {
    await wait(start - now());
    if (!alive()) return;
    caption(sc, d.hunter ? `정오의 햇살 아래… <b>${esc(d.hunter.name)}</b> 등장!` : '정오의 햇살 아래, 현상금 사냥꾼이 나타났다…');
    walkIn(sc, Math.max(600, start + walk - now()));
    await wait(start + walk - now());
  } else sc.querySelectorAll('.sd-cb,.sd-hunter').forEach((x) => x.classList.add('in'));
  for (const ln of tl) {
    if (!alive()) return;
    const row = sc.querySelector(`.sd-row[data-lane="${ln.s.lane}"]`);
    if (!ln.picks.every((p) => done.has(ln.s.lane + p.id))) {
      await wait(ln.at - now()); if (!alive()) return;
      sc.querySelectorAll('.sd-row').forEach((r) => { r.classList.toggle('on', r === row); r.classList.toggle('dim', r !== row && !r.classList.contains('over')); });
      caption(sc, `${LANE_ICON[ln.s.lane]} <b>${LANE_NAME[ln.s.lane]}</b> · ${ln.s.cands.length}명 중 단 2명`);
      sfx('horn');
      for (const p of ln.picks) {
        if (done.has(ln.s.lane + p.id)) continue;
        await wait(p.at - now()); if (!alive()) return;
        await duel(sc, d, ln.s, p.id, Math.max(0, now() - p.at), alive);
        done.add(ln.s.lane + p.id);
      }
    }
    row.classList.add('over'); row.classList.remove('on');
    row.querySelectorAll('.sd-poster:not(.shot)').forEach((x) => x.classList.add('out'));
  }
  await wait(end - now());
  if (alive()) showFinal(el, d);
}
act('bdSkip', () => { BD.skipped = true; showFinal(view(), BD.d || cur()); });
act('bdClose', () => closeModal());
async function finishRun(d) { // 'play'→'done'을 먼저 바꾼 한 사람만 라인업에 반영한다(중복 반영·중복 채팅 방지)
  let ok = false;
  try { ok = await S.store.tx('meta', 'board', (r) => (r && r.rid === d.rid && r.status === 'play' ? { ...r, status: 'done' } : null)); } catch { return; }
  if (!ok) return;
  const blue = LANES.map((l) => d.result[l]?.[0] || ''), red = LANES.map((l) => d.result[l]?.[1] || '');
  setDraftTeams(blue, red);
  if (S.page === 'today') refresh();
  sysChat('라인 지원 결과 · ' + LANES.map((l) => `${LANE_NAME[l]} ${d.result[l].map(nm).join('/') || '-'}`).join(' · '));
}
function sparks(x, y) {
  if (calm()) return;
  const c = document.createElement('canvas'); c.className = 'fx'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), col = ['255,236,170', '255,190,90', '255,140,50', '255,255,255'];
  const ps = Array.from({ length: 90 }, () => { const a = Math.random() * 6.283, v = 3 + Math.random() * 16; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, l: 1, c: col[(Math.random() * 4) | 0], w: 1 + Math.random() * 2.5 }; });
  const chips = Array.from({ length: 26 }, () => { const a = Math.random() * 6.283, v = 2 + Math.random() * 7; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: Math.random() * 6, s: 3 + Math.random() * 5, l: 1 }; });
  const t0 = performance.now();
  (function loop(t) {
    g.clearRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (const p of ps) { p.vx *= 0.94; p.vy = p.vy * 0.94 + 0.25; p.x += p.vx; p.y += p.vy; p.l -= 0.03; if (p.l <= 0) continue; g.strokeStyle = `rgba(${p.c},${p.l})`; g.lineWidth = p.w; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (const p of chips) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2; p.l -= 0.014; if (p.l <= 0) continue; g.save(); g.globalAlpha = p.l; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = '#e2cc95'; g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.5); g.restore(); }
    if (t - t0 < 1800) requestAnimationFrame(loop); else c.remove();
  })(t0);
}

// ---------- 다른 사람의 게시판 받기 ----------
let bseen = null, docWatch = false;
function onBoard(d) {
  const k = d ? d.rid + d.status : '';
  if (bseen === null) { bseen = k; return; }
  if (k === bseen) { if (d?.status === 'open') draw(); return; }
  bseen = k;
  if (!d) return;
  if (d.status === 'open') { if (view()) draw(); else { sfx('horn'); openBoard(); } }
  else if (d.status === 'play') { if (BD.playing !== d.rid) play(d); }
  else if (d.status === 'done') { if (view() && BD.playing !== d.rid) draw(); }
  else if (d.status === 'closed' && view() && !BD.playing) { closeModal(); toast('라인 지원이 취소되었습니다'); }
  if (S.page === 'today') refresh();
}
export function watchBoard(initial) {
  const d = cur();
  if (initial) { if (bseen === null) bseen = d ? d.rid + d.status : ''; }
  else onBoard(d);
  if (!docWatch && S.store.mode === 'firebase') {
    docWatch = true;
    S.store.watchDoc('meta', 'board', (doc) => onBoard(doc && doc.rid ? doc : null), (e) => console.error('[board] listener', e));
  }
}
