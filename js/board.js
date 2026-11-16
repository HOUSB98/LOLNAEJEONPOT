// 라인 지원: 참가자가 원하는 라인(탑~서폿·상관없음)을 직접 고르고, 마감하면 2명 넘게 몰린 라인은 무작위로 2명을 뽑아 라인업에 넣는다.
// meta/board 문서 하나로 모든 접속자가 같은 지원 현황과 같은 추첨 장면을 같은 시각에 본다(시작 시각은 서버 시계 기준).
import { S, act, esc, modal, closeModal, mh, toast, burst, refresh, ic, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
import { setDraftTeams, placedIds } from './today.js';
import { sysChat, nick } from './social.js';

const OPTS = [...LANES, 'any'];
const NAME = { ...LANE_NAME, any: '상관없음' };
const COLOR = { ...LANE_COLOR, any: '#d9a441' };
const ANY_ICON = '<svg class="lic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 14.300 9.100 20.800 9.300 15.700 13.300 17.500 19.600 12 16 6.500 19.600 8.300 13.300 3.200 9.300 9.700 9.100z"/></svg>';
const icon = (o) => (o === 'any' ? ANY_ICON : LANE_ICON[o]);

const BD = { me: localStorage.getItem('naejeon:bdme:' + S.key) || '', sel: [], playing: '', timers: [], muted: localStorage.getItem('naejeon:bdmute') === '1', prev: {} };
const cur = () => { const d = S.store?.data?.meta?.board; return d && d.rid ? d : null; };
const nm = (id) => S.st.P[id]?.name || '?';
// 진행 중 판단: 지원 중이면 마지막 움직임(열기·지원)부터 2시간, 추첨 중이면 시작부터 10분이 지나면 끝난 것으로 본다.
// 시간이 지나면 버튼의 '진행 중' 표시가 꺼지고, 다음에 누르면 새로 열 수 있다.
const OPEN_TTL = 2 * 3600e3, PLAY_TTL = 10 * 60e3;
const live = (d) => {
  if (!d) return false;
  const t = S.store.serverNow();
  if (d.status === 'open') return t - (+d.upd || +d.at || 0) < OPEN_TTL;
  if (d.status === 'play') return t - (+d.startAt || +d.at || 0) < PLAY_TTL;
  return false;
};
const view = () => document.querySelector('#modal.on .lp');
const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const boardLive = () => live(cur());
// 지망: picks[선수] = ['top','mid','any'] 처럼 1~3지망 목록(예전 문서의 문자열 한 개도 1지망으로 읽는다)
const prefs = (d, id) => { const v = d.picks?.[id]; return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []; };
const RANK = ['1지망', '2지망', '3지망'];

// ---------- 효과음(파일 없이 Web Audio로, 부드러운 전자음만) ----------
let AC = null;
const ac = () => { try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch { return null; } };
document.addEventListener('pointerdown', () => { if (AC?.state === 'suspended') AC.resume(); }, { passive: true });
function sfx(kind) {
  if (BD.muted) return;
  const a = ac(); if (!a) return;
  const t0 = a.currentTime;
  const tone = (f, at, dur, vol, type = 'sine') => {
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0 + at);
    g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    o.connect(g).connect(a.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
  };
  if (kind === 'tick') tone(1320, 0, 0.06, 0.05, 'triangle');
  else if (kind === 'pick') tone(880, 0, 0.12, 0.08, 'triangle');
  else if (kind === 'lock') { tone(660, 0, 0.18, 0.08); tone(990, 0.08, 0.22, 0.07); }
  else if (kind === 'win') { tone(784, 0, 0.25, 0.1); tone(1046, 0.1, 0.3, 0.09); tone(1568, 0.2, 0.45, 0.06, 'triangle'); }
  else if (kind === 'start') { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.07, 'triangle')); }
}

// ---------- 지원 화면 ----------
function card(d, o) {
  const rankN = [0, 1, 2].map((r) => d.ids.filter((id) => prefs(d, id)[r] === o).length), n = rankN[0];
  const prevN = Object.values(BD.prev).filter((v) => (Array.isArray(v) ? v[0] : v) === o).length;
  const myRank = BD.me ? prefs(d, BD.me).indexOf(o) : -1;
  const state = o === 'any' ? '' : n > 2 ? `<span class="lp-st hot">1지망 ${n - 2}명 초과 · 추첨</span>` : n === 2 ? '<span class="lp-st ok">딱 맞음</span>' : `<span class="lp-st low">${2 - n}자리 남음</span>`;
  return `<button class="lp-card ${myRank >= 0 ? 'mine' : ''} ${o === 'any' ? 'any' : ''}" data-a="bdPick" data-o="${o}" style="--lc:${COLOR[o]}" ${d.status !== 'open' ? 'disabled' : ''}>
    <span class="lp-ch"><i class="lp-ico">${icon(o)}</i><b>${NAME[o]}</b>${myRank >= 0 ? `<em class="r${myRank + 1}">${RANK[myRank]}</em>` : ''}</span>
    <span class="lp-meta">${o === 'any' ? '빈 자리에 배치' : '모집 2명'}${state}</span>
    <span class="lp-bar"><i style="width:${o === 'any' ? 0 : Math.min(100, n * 50)}%"></i></span>
    <span class="lp-cnt ${n !== prevN ? 'bump' : ''}"><small>1지망</small><b class="mono">${n}</b>명<i class="lp-dots">${Array.from({ length: Math.max(n, o === 'any' ? 0 : 2) }, (_, i) => `<u class="${i < n ? 'on' : ''}"></u>`).join('')}</i></span>
    <span class="lp-sub">2지망 <b>${rankN[1]}</b> · 3지망 <b>${rankN[2]}</b></span>
  </button>`;
}
function openHTML(d) {
  const picked = d.ids.filter((id) => prefs(d, id).length).length, isMe = d.ids.includes(BD.me), mine = isMe ? prefs(d, BD.me) : [];
  return `<div class="lp-h"><div><small><i class="live"></i>LIVE · 모두 같은 화면</small><h2>${ic('users')}라인 지원</h2></div><span class="grow"></span>
      <button class="btn ghost xs" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button><button class="btn ghost xs" data-a="bdHide" title="닫기 (라인 지원은 계속 열려 있음)">${ic('x')}</button></div>
    <ol class="lp-steps"><li class="${isMe ? 'done' : 'on'}">내 이름 선택</li><li class="${isMe ? (mine.length ? 'done' : 'on') : ''}">라인 1~3지망 선택</li><li>마감 → 지망 순서대로 추첨</li></ol>
    ${isMe ? `<div class="lp-my"><b>${esc(nm(BD.me))}</b>의 지망${[0, 1, 2].map((r) => `<span class="lp-rk ${mine[r] ? 'on' : ''}" style="--lc:${mine[r] ? COLOR[mine[r]] : '#3a4a64'}"><small>${RANK[r]}</small>${mine[r] ? `${icon(mine[r])}${NAME[mine[r]]}` : '—'}</span>`).join('')}<small class="mut">카드를 누른 순서대로 1·2·3지망 · 다시 누르면 빠져요</small></div>` : ''}
    ${isMe && !BD.roster ? `<div class="lp-sec lp-mini"><span>${ic('user')}<b>${esc(nm(BD.me))}</b>(으)로 지원 중</span><button class="btn ghost xs" data-a="bdRoster">다른 이름 · 대리 지원</button></div>`
      : `<div class="lp-sec"><div class="lp-sh"><b>참가자</b><small>${isMe ? `<b>${esc(nm(BD.me))}</b>(으)로 지원 중 · 다른 이름을 누르면 대리 지원` : '본인 이름을 눌러 주세요'}</small></div>
      <div class="lp-roster">${d.ids.map((id) => { const p = prefs(d, id)[0], mine = id === BD.me; return `<button class="lp-mem ${mine ? 'me' : ''} ${p ? 'ok' : ''}" data-a="bdMe" data-id="${id}" style="--lc:${p && mine ? COLOR[p] : p ? '#4fd08b' : '#5a6a84'}" title="${p ? '지원 완료' : '아직 지원 안 함'}">${p ? `<i>${mine ? icon(p) : '✓'}</i>` : '<i class="dot"></i>'}${esc(nm(id))}</button>`; }).join('')}</div></div>`}
    <div class="lp-grid">${OPTS.map((o) => card(d, o)).join('')}</div>
    <div class="lp-foot"><span class="lp-count"><b class="mono">${picked}</b> / <span class="mono">${d.ids.length}</span> 지원 완료${d.by ? ` · 연 사람 ${esc(d.by)}` : ''}<small class="lp-ttl">2시간 동안 아무도 지원하지 않으면 자동으로 닫혀요</small></span><span class="grow"></span>
      <button class="btn ghost" data-a="bdShut">취소하기</button><button class="btn pri" data-a="bdGo" ${picked ? '' : 'disabled'}>${ic('dice')}지원 마감 · 추첨 시작</button></div>`;
}
function finalHTML(d) {
  const rk = d.rankOf || {};
  const drawn = new Set((d.steps || []).filter((s) => s.kind === 'roll' && !s.fill).flatMap((s) => s.pick));
  const tag = (id) => (rk[id] ? `<em class="r${rk[id]}">${RANK[rk[id] - 1]}${drawn.has(id) ? '·추첨' : ''}</em>` : '<em>배치</em>');
  const cell = (id, side, i) => (id ? `<span class="lf-n ${side}" style="--i:${i}">${esc(nm(id))}${tag(id)}</span>` : '<span class="lf-n empty">빈 자리</span>');
  return `<div class="lp-h"><div><small>RESULT</small><h2>${ic('today')}최종 라인업</h2></div><span class="grow"></span><button class="btn ghost xs" data-a="bdClose" title="닫기">${ic('x')}</button></div>
    <div class="lf"><span></span><b class="blue">BLUE</b><b class="red">RED</b>
      ${LANES.map((l, i) => `<span class="lf-l" style="--lc:${COLOR[l]}">${LANE_ICON[l]}${LANE_NAME[l]}</span>${cell(d.result?.[l]?.[0], 'blue', i * 2)}${cell(d.result?.[l]?.[1], 'red', i * 2 + 1)}`).join('')}</div>
    ${d.left?.length ? `<p class="mut center">대기: ${d.left.map((x) => esc(nm(x))).join(', ')}</p>` : ''}
    <p class="hint center"><em class="lf-tag">N지망</em> 몇 지망으로 들어갔는지 (·추첨: 몰려서 뽑힘) · <em class="lf-tag">배치</em> 상관없음·지망 실패·미지원으로 빈 자리에 들어감 · 진영·자리 교체는 라인업에서 끌어다 놓으면 됩니다</p>
    <div class="lp-foot center"><button class="btn pri" data-a="bdLineup">${ic('today')}라인업 확인</button><button class="btn ghost" data-a="bdClose">닫기</button></div>`;
}
function draw() {
  const el = view(), d = cur();
  if (!el || !d || BD.playing === d.rid) return;
  el.classList.remove('drawing');
  el.innerHTML = d.status === 'done' ? finalHTML(d) : openHTML(d);
  if (d.status === 'open' && el.querySelector('.lp-cnt.bump')) sfx('pick');
  BD.prev = { ...(d.picks || {}) };
}
function openBoard() {
  const d = cur(); if (!d) return;
  modal('<div class="lp"></div>', 'lp-sheet');
  BD.prev = { ...(d.picks || {}) };
  if (d.status === 'play') play(d); else draw();
}

// ---------- 열기·지원 ----------
function setup() {
  const st = S.st, last = st.matches[st.matches.length - 1];
  if (!BD.sel.length) { const p = placedIds(); BD.sel = p.length >= 2 ? p : last ? [...last.blue, ...last.red] : []; }
  const list = [...st.list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const html = `${mh(`${ic('users')}라인 지원 열기`)}
    <p class="mut">오늘 내전에 참가할 사람을 고르세요. 라인 지원을 열면 <b class="good">접속한 모든 사람의 화면에 함께 뜹니다.</b> 각자 원하는 라인을 고르고, 마감하면 몰린 라인은 추첨해서 라인업에 바로 넣습니다.</p>
    <div class="ph"><b>참가자</b><span class="tag ${BD.sel.length === 10 ? 'ok' : ''}">${BD.sel.length}명</span><span class="grow"></span>${last ? '<button class="btn xs" data-a="bdRecent">최근 내전 참가자</button>' : ''}<button class="btn xs ghost" data-a="bdNone">해제</button></div>
    <div class="chipsel">${list.map((s) => `<button class="${BD.sel.includes(s.id) ? 'on' : ''}" data-a="bdSel" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div>
    <button class="btn pri block big" data-a="bdOpen" ${BD.sel.length >= 2 ? '' : 'disabled'}>${BD.sel.length >= 2 ? `${BD.sel.length}명으로 라인 지원 열기` : '참가자를 2명 이상 고르세요'}</button>`;
  const open = document.querySelector('#modal.on .sheet.lp-setup');
  if (open) { const y = open.querySelector('.chipsel')?.scrollTop || 0; open.innerHTML = html; open.querySelector('.chipsel').scrollTop = y; } else modal(html, 'tall lp-setup');
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
  sfx('start'); openBoard();
});
act('bdMe', (x) => { BD.me = x.id; BD.roster = false; localStorage.setItem('naejeon:bdme:' + S.key, x.id); draw(); });
act('bdRoster', () => { BD.roster = true; draw(); });
act('bdPick', async (x) => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!live(d)) { toast('2시간 동안 움직임이 없어 라인 지원이 닫혔어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  if (!d.ids.includes(BD.me)) { toast('위쪽 참가자 목록에서 본인 이름을 먼저 눌러 주세요'); view()?.querySelector('.lp-roster')?.classList.add('nudge'); setTimeout(() => view()?.querySelector('.lp-roster')?.classList.remove('nudge'), 900); return; }
  const me = BD.me, rid = d.rid;
  sfx('pick');
  try {
    await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== rid || r.status !== 'open') return null;
      const picks = { ...(r.picks || {}) }, curP = prefs(r, me);
      let next;
      if (curP.includes(x.o)) next = curP.filter((v) => v !== x.o); // 다시 누르면 빠진다
      else {
        const lanes = curP.filter((v) => v !== 'any'), any = curP.includes('any') || x.o === 'any';
        next = [...(x.o === 'any' ? lanes : [...lanes, x.o]), ...(any ? ['any'] : [])]; // '상관없음'은 항상 마지막
        if (next.length > 3) { toast('3지망까지 고를 수 있어요. 하나를 빼고 다시 골라 주세요'); return null; }
      }
      if (next.length) picks[me] = next; else delete picks[me];
      return { ...r, picks, upd: S.store.serverNow() };
    });
  } catch (e) { toast('지원 실패: ' + (e.code || e.message)); }
});
act('bdHide', () => closeModal());
act('bdMute', () => { BD.muted = !BD.muted; localStorage.setItem('naejeon:bdmute', BD.muted ? '1' : '0'); document.querySelectorAll('.lp [data-a="bdMute"]').forEach((x) => (x.innerHTML = ic(BD.muted ? 'mute' : 'sound'))); });
act('bdShut', async () => {
  const d = cur(); if (!d || !confirm('라인 지원을 취소할까요? 지원 내용이 사라집니다.')) return;
  await S.store.put('meta', 'board', { ...d, status: 'closed' }).catch(() => {});
  closeModal();
});
act('bdLineup', () => { closeModal(); location.hash = '#/today'; });

// ---------- 추첨 계획: 지망 단계별 추첨 ----------
// 1라운드: 모두 1지망으로. 남은 자리 이하면 바로 확정, 넘치면 무작위로 남은 자리만큼 뽑는다.
// 2·3라운드: 아직 자리가 없는 사람만 2지망 → 3지망으로 넘어가 남은 자리 안에서 같은 방식으로 정한다.
// 라운드마다 라인을 처리하는 순서는 무작위. 끝까지 남은 사람(상관없음·지망 실패·미지원)은 빈 자리에 무작위 배치.
// 블루·레드는 무작위. 이후 교체는 라인업에서 직접 한다.
function plan(d) {
  const P = Object.fromEntries(d.ids.map((id) => [id, prefs(d, id)]));
  const slots = Object.fromEntries(LANES.map((l) => [l, []])), steps = [], rankOf = {};
  let left = [...d.ids];
  for (let r = 0; r < 3; r++) {
    for (const l of shuffle(LANES)) {
      const free = 2 - slots[l].length; if (free <= 0) continue;
      const c = left.filter((id) => P[id][r] === l); if (!c.length) continue;
      const pre = [...slots[l]], got = c.length <= free ? c : shuffle(c).slice(0, free);
      steps.push({ round: r + 1, lane: l, kind: c.length > free ? 'roll' : 'direct', cands: c, pick: got, pre });
      got.forEach((id) => { slots[l].push(id); rankOf[id] = r + 1; });
      left = left.filter((id) => !got.includes(id));
    }
  }
  left = shuffle(left);
  for (const l of shuffle(LANES)) {
    const need = 2 - slots[l].length; if (need <= 0 || !left.length) continue;
    const got = left.splice(0, need);
    steps.push({ round: 4, lane: l, kind: 'direct', cands: got, pick: got, pre: [...slots[l]], fill: true });
    slots[l].push(...got);
  }
  const result = Object.fromEntries(LANES.map((l) => [l, shuffle(slots[l])]));
  return { steps, result, left, rankOf };
}
act('bdGo', async () => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!live(d)) { toast('라인 지원이 만료됐어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  const miss = d.ids.filter((id) => !prefs(d, id).length).length;
  if (miss && !confirm(`아직 ${miss}명이 지원하지 않았어요. 미지원자는 '상관없음'으로 보고 마감할까요?`)) return;
  await S.store.syncServerClock?.();
  BD.runner = d.rid; // 내 쓰기가 먼저 돌아와 재생이 시작돼도 내가 라인업을 반영하도록 미리 표시
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

// ---------- 추첨 재생 (모든 화면이 같은 시각표를 따른다) ----------
// 2명 넘게 몰린 라인만 차례로 보여 준다. 빛이 지원자 이름 사이를 오가다 점점 느려지며 한 명씩 멈춘다(한 라인 2명).
// 몰리지 않은 라인과 빈 자리 배치는 마지막 '최종 라인업'에서 한꺼번에 보여 준다.
const T_INTRO = 2400, T_LANE = 2000, T_PICK = 4400, T_GAP = 1400, HOP = 2900, HOLD = 500;
const now = () => S.store.serverNow();
const wait = (ms) => new Promise((res) => BD.timers.push(setTimeout(res, Math.max(0, ms))));
function clearTimers() { BD.timers.forEach(clearTimeout); BD.timers = []; }
function drawHTML(steps) {
  return `<div class="lp-h"><div><small><i class="live"></i>LIVE · 추첨 중</small><h2>${ic('dice')}라인 추첨</h2></div><span class="grow"></span>
      <button class="btn ghost xs" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button><button class="btn xs" data-a="bdSkip">건너뛰기 ▸▸</button></div>
    <p class="lp-cap">지망 순서대로, 자리보다 지원자가 많은 라인만 추첨합니다 · 라인 순서는 무작위</p>
    <div class="ld">${steps.map((s) => `<div class="ld-row" data-lane="${s.lane}" style="--lc:${COLOR[s.lane]}">
      <div class="ld-lane"><i class="lp-ico">${LANE_ICON[s.lane]}</i><b>${LANE_NAME[s.lane]}</b><small>${RANK[(s.round || 1) - 1]} · ${s.cands.length}명 중 ${s.pick.length}명</small></div>
      <div class="ld-cands">${(s.pre || []).map((id) => `<span class="ld-c won pre" title="앞 라운드에서 확정">${esc(nm(id))}</span>`).join('')}${s.cands.map((id) => `<span class="ld-c" data-id="${id}">${esc(nm(id))}</span>`).join('')}</div></div>`).join('')}</div>`;
}
function finish(el, d) {
  clearTimers();
  BD.playing = '';
  if (!el || !document.body.contains(el)) return;
  el.classList.remove('drawing');
  el.innerHTML = finalHTML(d);
  sfx('win'); burst(innerWidth / 2, innerHeight / 3, 150);
}
function confirmPick(row, id, fresh) {
  const c = row.querySelector(`.ld-c[data-id="${id}"]`);
  if (!c || c.classList.contains('won')) return;
  c.classList.remove('hl'); c.classList.add('won');
  if (!fresh) return;
  sfx('lock');
  const r = c.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 60);
}
async function pickOne(sc, s, id, late, alive) {
  const row = sc.querySelector(`.ld-row[data-lane="${s.lane}"]`);
  const pool = [...row.querySelectorAll('.ld-c:not(.won)')], target = row.querySelector(`.ld-c[data-id="${id}"]`);
  if (!target) return;
  if (late < HOP && pool.length > 1) {
    const n = pool.length, ti = pool.indexOf(target), hops = 2 * n + ti;
    const w = Array.from({ length: hops + 1 }, (_, k) => 1 + Math.pow(k / hops, 2.4) * 7), sum = w.reduce((a, b) => a + b, 0), budget = HOP - late;
    for (let k = 0; k <= hops; k++) {
      if (!alive()) return;
      pool.forEach((p) => p.classList.remove('hl')); pool[k % n].classList.add('hl'); sfx('tick');
      await wait((w[k] / sum) * budget);
    }
  }
  if (!alive()) return;
  pool.forEach((p) => p.classList.remove('hl')); target.classList.add('hl', 'lock');
  await wait(late > HOP ? 0 : HOLD);
  if (!alive()) return;
  target.classList.remove('lock');
  confirmPick(row, id, true);
}
async function play(d) {
  if (BD.playing === d.rid && view()?.querySelector('.ld')) return;
  clearTimers(); clearTimeout(BD.finT);
  if (!view()) modal('<div class="lp"></div>', 'lp-sheet');
  const el = view();
  BD.playing = d.rid; BD.d = d; BD.skipped = false;
  const steps = (d.steps || []).filter((s) => s.kind === 'roll' && !s.fill && s.pick.length);
  const start = +d.startAt || now();
  let t = start + (steps.length ? T_INTRO : 0);
  const tl = steps.map((s) => { const ln = { s, at: t, picks: [] }; t += T_LANE; for (const id of s.pick) { ln.picks.push({ id, at: t }); t += T_PICK; } t += T_GAP; return ln; });
  const end = t;
  // 라인업 반영은 건너뛰기와 상관없이 시각표 끝에 한 번(추첨을 시작한 사람, 없으면 남은 사람)
  BD.finT = setTimeout(() => finishRun(d), Math.max(0, end - now()) + (BD.runner === d.rid ? 0 : 3000));
  if (!steps.length || now() >= end) return finish(el, d);
  el.classList.add('drawing');
  el.innerHTML = drawHTML(steps);
  const sc = el, alive = () => BD.playing === d.rid && !BD.skipped && document.body.contains(el);
  const done = new Set();
  for (const ln of tl) for (const p of ln.picks) if (p.at + HOP + HOLD + 100 <= now()) { confirmPick(el.querySelector(`.ld-row[data-lane="${ln.s.lane}"]`), p.id, false); done.add(ln.s.lane + p.id); }
  if (now() < start + T_INTRO) { await wait(start - now()); if (!alive()) return; sfx('start'); el.querySelector('.lp-cap').textContent = '추첨을 시작합니다…'; await wait(start + T_INTRO - now()); }
  for (const ln of tl) {
    if (!alive()) return;
    const row = el.querySelector(`.ld-row[data-lane="${ln.s.lane}"]`);
    if (!ln.picks.every((p) => done.has(ln.s.lane + p.id))) {
      await wait(ln.at - now()); if (!alive()) return;
      el.querySelectorAll('.ld-row').forEach((r) => { r.classList.toggle('on', r === row); r.classList.toggle('dim', r !== row && !r.classList.contains('over')); });
      el.querySelector('.lp-cap').innerHTML = `${RANK[(ln.s.round || 1) - 1]} 추첨 · ${LANE_NAME[ln.s.lane]} — ${ln.s.cands.length}명 중 ${ln.s.pick.length}명을 뽑습니다`;
      row.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      for (const p of ln.picks) {
        if (done.has(ln.s.lane + p.id)) continue;
        await wait(p.at - now()); if (!alive()) return;
        await pickOne(sc, ln.s, p.id, Math.max(0, now() - p.at), alive);
        done.add(ln.s.lane + p.id);
        if (alive()) el.querySelector('.lp-cap').innerHTML = `<b>${esc(nm(p.id))}</b> · ${LANE_NAME[ln.s.lane]} 확정`;
      }
    }
    row.classList.add('over'); row.classList.remove('on');
    row.querySelectorAll('.ld-c:not(.won)').forEach((x) => x.classList.add('out'));
  }
  await wait(end - now());
  if (alive()) finish(el, d);
}
act('bdSkip', () => { BD.skipped = true; finish(view(), BD.d || cur()); });
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

// ---------- 다른 사람의 게시판 받기 ----------
let bseen = null, docWatch = false;
function onBoard(d) {
  const k = d ? d.rid + d.status : '';
  if (bseen === null) { bseen = k; return; }
  if (k === bseen) { if (d?.status === 'open') draw(); return; }
  bseen = k;
  if (!d) return;
  if (d.status === 'open') { if (view()) draw(); else { sfx('start'); openBoard(); } }
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
// 열어 둔 화면에서도 시간이 지나 만료되면 '라인 지원 중' 버튼 표시를 끈다(1분마다 확인)
let liveWas = null;
setInterval(() => { if (!S.store) return; const l = boardLive(); if (liveWas !== null && l !== liveWas && S.page === 'today') refresh(); liveWas = l; }, 60e3);
