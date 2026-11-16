// 길드 의뢰 게시판: 참가자가 원하는 라인의 의뢰서(탑~서폿·상관없음)를 고르고, 마감하면 몰린 라인은 추첨해 바로 라인업에 넣는다.
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
const INTRO = 2600, T_DIRECT = 3600, T_ROLL = 7200, OUTRO = 1500;

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
    ? `<div class="gb-foot"><span class="gb-count"><b class="mono">${picked}</b>/<span class="mono">${d.ids.length}</span> 지원 완료</span><span class="grow"></span><button class="btn ghost xs" data-a="bdShut">게시판 철거</button><button class="btn pri" data-a="bdGo" ${picked ? '' : 'disabled'}>${ic('bell')}의뢰 마감 · 추첨 시작</button></div>`
    : d.status === 'done' ? `<div class="gb-foot"><span class="gb-count">편성 완료 · 오늘의 내전 라인업에 반영했습니다${d.left?.length ? ` · 대기: ${d.left.map((x) => esc(nm(x))).join(', ')}` : ''}</span><span class="grow"></span><button class="btn pri" data-a="bdLineup">라인업 확인</button></div>`
      : `<div class="gb-foot"><span class="gb-count gb-livecall">${ic('today')}추첨 진행 중 · 모두 같은 화면을 보고 있습니다</span></div>`;
  return `<div class="gb-dust">${'<i></i>'.repeat(14)}</div><i class="gb-lamp l"></i><i class="gb-lamp r"></i>
    <header class="gb-head"><button class="gb-x" data-a="bdHide" title="닫기 (게시판은 계속 열려 있음)">${ic('x')}</button><button class="gb-snd" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button>
      <small>ADVENTURERS' GUILD · LIVE</small><h2>모험가 길드 의뢰 게시판</h2>
      <p>${d.status === 'open' ? `원하는 라인의 의뢰서를 누르세요. 몰린 의뢰는 추첨, 빈 의뢰는 용병으로 채웁니다.${d.by ? ` <span class="gb-by">게시: ${esc(d.by)}</span>` : ''}` : d.status === 'done' ? '모든 원정대가 편성되었습니다!' : '의뢰 마감! 운명의 추첨이 시작됩니다.'}</p></header>
    <div class="gb-board">${OPTS.map((o) => paper(d, o, { done: st.done?.has(o), result: st.result })).join('')}</div>
    <div class="gb-roll"><div class="gb-rh"><b>길드원 명부</b><small>${d.status === 'open' ? (isMe ? `<b>${esc(nm(BD.me))}</b>(으)로 지원 중 · 다른 이름을 누르면 대리 지원` : '먼저 <b>본인 이름</b>을 눌러 주세요') : '지원 마감'}</small></div><div class="gb-mems">${roster}</div></div>
    ${foot}<div class="gb-stage"></div>`;
}
function draw() {
  const el = view(), d = cur();
  if (!el || !d || BD.playing === d.rid) return;
  const st = d.status === 'done' ? { done: new Set(LANES), result: d.result } : {};
  el.innerHTML = inner(d, st);
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
  const html = `${mh(`${ic('scroll')}길드 의뢰 게시판 열기`)}
    <p class="mut">오늘 내전에 참가할 길드원을 고르세요. 게시판을 열면 <b class="good">접속한 모든 사람의 화면에 함께 뜹니다.</b> 각자 원하는 라인 의뢰서를 고르고, 마감하면 추첨해서 라인업에 바로 넣습니다.</p>
    <div class="ph"><b>참가자</b><span class="tag ${BD.sel.length === 10 ? 'ok' : ''}">${BD.sel.length}명</span><span class="grow"></span>${last ? '<button class="btn xs" data-a="bdRecent">최근 내전 참가자</button>' : ''}<button class="btn xs ghost" data-a="bdNone">해제</button></div>
    <div class="chipsel">${list.map((s) => `<button class="${BD.sel.includes(s.id) ? 'on' : ''}" data-a="bdSel" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div>
    <button class="btn pri block big" data-a="bdOpen" ${BD.sel.length >= 2 ? '' : 'disabled'}>${BD.sel.length >= 2 ? `${BD.sel.length}명으로 게시판 열기` : '참가자를 2명 이상 고르세요'}</button>`;
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
  sysChat(`길드 의뢰 게시판이 열렸습니다 · 참가자 ${d.ids.length}명`);
  sfx('horn'); openBoard();
});
act('bdMe', (x) => { BD.me = x.id; localStorage.setItem('naejeon:bdme:' + S.key, x.id); draw(); });
act('bdPick', async (x) => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!d.ids.includes(BD.me)) { toast('아래 길드원 명부에서 본인 이름을 먼저 눌러 주세요'); view()?.querySelector('.gb-roll')?.classList.add('nudge'); setTimeout(() => view()?.querySelector('.gb-roll')?.classList.remove('nudge'), 900); return; }
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
act('bdHide', () => { if (BD.playing) return toast('추첨이 끝나면 닫을 수 있어요'); closeModal(); });
act('bdMute', () => { BD.muted = !BD.muted; localStorage.setItem('naejeon:bdmute', BD.muted ? '1' : '0'); const b = view()?.querySelector('.gb-snd'); if (b) b.innerHTML = ic(BD.muted ? 'mute' : 'sound'); });
act('bdShut', async () => {
  const d = cur(); if (!d || !confirm('게시판을 철거할까요? 지원 내용이 사라집니다.')) return;
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
  let mine = null;
  try {
    mine = await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open') return null;
      const p = plan(r);
      return { ...r, status: 'play', startAt: S.store.serverNow() + 1800, ...p, runner: nick() || '익명' };
    });
  } catch (e) { return toast('추첨 시작 실패: ' + (e.code || e.message)); }
  if (!mine) return;
  const r = S.store.mode === 'local' ? cur() : mine;
  BD.runner = r.rid;
  play(r);
});

// ---------- 추첨 재생(모든 화면이 같은 시각표를 따른다) ----------
const wait = (ms) => new Promise((res) => BD.timers.push(setTimeout(res, Math.max(0, ms))));
const durOf = (s) => (s.kind === 'roll' ? T_ROLL : T_DIRECT);
function clearTimers() { BD.timers.forEach(clearTimeout); BD.timers = []; }
async function play(d) {
  if (BD.playing === d.rid && view()?.classList.contains('playing')) return;
  clearTimers();
  if (!view()) { modal(`<div class="gb lock enter"></div>`, 'guild'); setTimeout(() => view()?.classList.remove('enter'), 1200); }
  const el = view();
  BD.playing = d.rid;
  const done = new Set();
  el.innerHTML = inner(d, { done });
  el.classList.add('playing');
  const start = +d.startAt || S.store.serverNow();
  let t = start + INTRO;
  const sched = d.steps.map((s) => { const x = { s, at: t }; t += durOf(s); return x; });
  const end = t;
  const now = () => S.store.serverNow();
  // 늦게 들어온 사람: 이미 끝난 단계는 결과만 바로 보여준다
  for (const x of sched) if (x.at + durOf(x.s) <= now()) markDone(el, d, x.s, done);
  if (now() < start + INTRO) { await wait(start - now()); banner(el, '의뢰 마감!', '운명의 추첨을 시작합니다'); sfx('horn'); await wait(start + INTRO - now()); }
  for (const x of sched) {
    if (BD.playing !== d.rid || !document.body.contains(el)) break;
    if (done.has(x.s.lane)) continue;
    await wait(x.at - now());
    await runStep(el, d, x.s, Math.max(0, now() - x.at));
    markDone(el, d, x.s, done);
  }
  await wait(end - now());
  if (BD.playing !== d.rid) return;
  banner(el, '원정대 편성 완료!', '라인업에 반영했습니다. 교체는 라인업에서 직접 하세요');
  burst(innerWidth / 2, innerHeight / 2, 220);
  if (BD.runner === d.rid) finishRun(d);
  else BD.timers.push(setTimeout(() => finishRun(d), 3000)); // 추첨을 시작한 사람이 나갔으면 남은 사람이 대신 반영한다
  await wait(OUTRO + 1400);
  if (BD.playing !== d.rid) return;
  BD.playing = '';
  el.classList.remove('playing');
  if (cur()?.rid === d.rid && cur().status === 'done') draw();
  else el.innerHTML = inner({ ...d, status: 'done' }, { done: new Set(LANES), result: d.result });
}
async function finishRun(d) { // 'play'→'done'을 먼저 바꾼 한 사람만 라인업에 반영한다(중복 반영·중복 채팅 방지)
  let ok = false;
  try { ok = await S.store.tx('meta', 'board', (r) => (r && r.rid === d.rid && r.status === 'play' ? { ...r, status: 'done' } : null)); } catch { return; }
  if (!ok) return;
  const blue = LANES.map((l) => d.result[l]?.[0] || ''), red = LANES.map((l) => d.result[l]?.[1] || '');
  setDraftTeams(blue, red);
  if (S.page === 'today') refresh();
  sysChat('길드 편성 완료 · ' + LANES.map((l) => `${LANE_NAME[l]} ${d.result[l].map(nm).join('/') || '-'}`).join(' · '));
}
function markDone(el, d, s, done) {
  done.add(s.lane);
  const p = el.querySelector(`.gb-board .gb-paper[data-lane="${s.lane}"]`);
  if (!p) return;
  p.classList.add('shot');
  p.querySelector('.gb-tags').innerHTML = d.result[s.lane].map((id, i) => `<span class="gb-tag won ${i ? 'red' : 'blue'}"><i>${i ? 'RED' : 'BLUE'}</i>${esc(nm(id))}</span>`).join('') || '<span class="gb-empty">인원 부족</span>';
  if (!p.querySelector('.hole')) p.insertAdjacentHTML('beforeend', `${hole(d.rid + s.lane)}<span class="gb-stamp">모집 완료</span>`);
  const any = el.querySelector('.gb-paper[data-lane="any"] .gb-tags');
  if (any && s.fill) any.innerHTML = anyTags(d, [...done]) || '<span class="gb-empty">아직 지원자 없음</span>';
}
function banner(el, title, sub) {
  const b = document.createElement('div'); b.className = 'gb-banner';
  b.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  el.appendChild(b); setTimeout(() => b.remove(), 2600);
}
async function runStep(el, d, s, late) {
  const stage = el.querySelector('.gb-stage'), small = el.querySelector(`.gb-board .gb-paper[data-lane="${s.lane}"]`);
  el.querySelectorAll('.gb-board .gb-paper').forEach((p) => p.classList.toggle('dim', p !== small));
  const cands = [...new Set([...s.pre, ...s.cands])];
  stage.innerHTML = `<div class="gb-big" style="--lc:${LANE_COLOR[s.lane]}">
      <i class="gb-pin"></i><span class="gb-rank">${RANK[s.lane]}</span><small class="gb-kind">${s.fill ? 'MERCENARY CALL' : 'QUEST DRAW'}</small>
      <span class="gb-ico">${icon(s.lane)}</span><b class="gb-title">${NAME[s.lane]} 원정대</b>
      <em class="gb-flavor">${s.fill ? (s.cands.length ? '빈 자리를 채울 용병을 고릅니다' : '지원자가 없어 자리가 비었습니다') : s.kind === 'roll' ? `${s.cands.length}명 중 단 2명만 뽑힙니다` : '지원자 2명, 바로 채용!'}</em>
      <div class="gb-cands">${cands.map((id) => `<span class="gb-tag ${s.pre.includes(id) ? 'won pre' : ''}" data-id="${id}">${esc(nm(id))}</span>`).join('')}</div>
      <div class="gb-scope"><i></i></div></div>`;
  stage.classList.add('on');
  const big = stage.querySelector('.gb-big'), tagOf = (id) => big.querySelector(`.gb-tag[data-id="${id}"]`);
  const fast = late > 0;
  if (s.kind === 'roll' && !fast) {
    await wait(700);
    let pool = s.cands.filter((id) => !s.pre.includes(id));
    for (const win of s.pick) { // 하이라이트가 이름표 사이를 돌다가 점점 느려지며 당첨자에서 멈춘다
      const order = pool, target = order.indexOf(win), laps = 3 * order.length + target;
      const gaps = Array.from({ length: laps + 1 }, (_, k) => 1 + Math.pow(k / laps, 3) * 6), sum = gaps.reduce((a, b) => a + b, 0);
      for (let k = 0; k <= laps; k++) { // 후보 수와 관계없이 한 명당 약 1.5초에 끝나게 간격을 맞춘다
        big.querySelectorAll('.gb-tag.hl').forEach((x) => x.classList.remove('hl'));
        tagOf(order[k % order.length])?.classList.add('hl'); sfx('tick');
        await wait((gaps[k] / sum) * 1500);
      }
      const w = tagOf(win); w?.classList.remove('hl'); w?.classList.add('won'); sfx('stamp');
      pool = pool.filter((id) => id !== win);
      await wait(320);
    }
    big.querySelectorAll('.gb-tag:not(.won)').forEach((x) => x.classList.add('out'));
  } else {
    await wait(fast ? 0 : 500);
    s.pick.forEach((id) => tagOf(id)?.classList.add('won')); if (s.pick.length) sfx('stamp');
    big.querySelectorAll('.gb-tag:not(.won)').forEach((x) => x.classList.add('out'));
    await wait(fast ? 0 : 500);
  }
  // 조준 → 발사
  const scope = big.querySelector('.gb-scope'), h = hash(d.rid + s.lane);
  scope.style.setProperty('--x', `${26 + (h % 48)}%`); scope.style.setProperty('--y', `${15 + ((h >> 8) % 18)}%`);
  scope.classList.add('aim'); sfx('cock');
  await wait(fast ? 200 : 750);
  shoot(el, big, d.rid + s.lane);
  await wait(fast ? 500 : 1100);
  stage.classList.add('fly');
  await wait(450);
  stage.classList.remove('on', 'fly'); stage.innerHTML = '';
  el.querySelectorAll('.gb-paper.dim').forEach((p) => p.classList.remove('dim'));
  if (small) { small.classList.add('hit'); setTimeout(() => small.classList.remove('hit'), 700); }
}
function shoot(el, big, seed) {
  sfx('bang');
  big.querySelector('.gb-scope')?.classList.add('fire');
  big.insertAdjacentHTML('beforeend', `${hole(seed, 'fresh')}<span class="gb-stamp big">모집 완료</span>`);
  big.parentElement.insertAdjacentHTML('beforeend', '<span class="gb-bang">BANG!</span>');
  const hl = big.querySelector('.hole.fresh');
  for (let i = 0; i < 6; i++) { const sm = document.createElement('i'); sm.className = 'gb-smoke'; sm.style.cssText = `left:${hl.style.left};top:${hl.style.top};--dx:${(Math.random() - 0.5) * 120}px;--dy:${-40 - Math.random() * 90}px;animation-delay:${i * 60}ms`; big.appendChild(sm); }
  const flash = document.createElement('div'); flash.className = 'gb-flash'; document.body.appendChild(flash); setTimeout(() => flash.remove(), 500);
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  big.classList.add('recoil');
  const r = hl.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2);
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
  else if (d.status === 'closed' && view() && !BD.playing) { closeModal(); toast('게시판이 철거되었습니다'); }
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
