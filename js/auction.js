// 팀 경매: 팀장이 한정 포인트로 선수를 한 명씩 입찰. 타이머·입찰은 DB 트랜잭션으로 모든 접속자에게 동기화된다.
import { S, page, act, esc, uid, col, pname, go, refresh, toast, needAdmin, isAdmin, ic, champIcon, sigChamp, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
import { dayKey } from './stats.js';
import { setDraftTeams } from './today.js';
import { sendLobbyChat } from './social.js';

const AU = { name: '', role: {}, points: 1000, unit: 10, sec: 20, ext: 8, delay: 15, hcap: {}, hide: true, chat: '', amt: '', as: 0, mode: 'live', batchDraft: {}, dl: [0, 1] };
const LOT_START_DELAY_MS = 15_000; // 예전 방(대기시간 설정이 없던 방)의 매물 사이 대기
const lotDelay = (r) => (r.cfg.delay ?? LOT_START_DELAY_MS / 1000) * 1000;
const tok = () => uid() + uid();
const hostKey = (id) => `naejeon:auhost:${S.key}:${id}`;
const room = (id) => S.store.data.auctions?.[id];
const say = (r, s) => { r.log = [...(r.log || []), { t: Date.now(), s }].slice(-40); };
const openTeams = (r) => r.teams.map((t, i) => i).filter((i) => r.teams[i].members.length < r.cfg.size - 1);
const nm = (id) => S.st.P[id]?.name || '?';

function finish(r) { r.status = 'done'; r.cur = null; say(r, '경매가 끝났습니다.'); return r; }
function nextItem(r, now) {
  let open = openTeams(r);
  if (!open.length) return finish(r);
  if (!r.pool.length && r.unsold.length && r.round < 2) { r.pool = r.unsold; r.unsold = []; r.round++; say(r, '유찰된 선수를 다시 경매합니다.'); }
  if (open.length === 1 || !r.pool.length) {
    const left = [...r.pool, ...r.unsold]; r.pool = []; r.unsold = [];
    while (left.length && (open = openTeams(r)).length) {
      const ti = open.sort((a, b) => r.teams[b].points - r.teams[a].points || r.teams[a].members.length - r.teams[b].members.length)[0];
      const pid = left.shift(); r.teams[ti].members.push({ pid, price: 0 }); say(r, `${nm(pid)} → ${r.teams[ti].name} (자동 배정)`);
    }
    r.unsold = left;
    return finish(r);
  }
  r.cur = { pid: r.pool.shift(), bid: 0, team: -1, startsAt: now + lotDelay(r), endsAt: now + lotDelay(r) + r.cfg.sec * 1000 };
  return r;
}
// 시각 판단(경매 마감·입찰 마감)은 '확실히 지났을 때'만 한다. 기기마다 서버 시각 추정에 오차(err)가 있어서,
// 시계가 앞서 보이는 기기가 남들보다 먼저 매물을 넘겨 버리는 일을 막는다. 새로 정하는 시각(다음 매물·연장)은 err만큼 넉넉히 잡아 짧아지지 않게 한다.
const passed = (now, err, at) => now - err >= at;
// 진행자 되돌리기용: 낙찰(유찰) 직전 상태를 한 단계만 기억한다(팀·대기 매물·유찰·라운드·그 매물). 다음 낙찰 때 덮어쓴다
const snap = (r) => JSON.parse(JSON.stringify({ teams: r.teams.map((t) => ({ points: t.points, members: t.members })), pool: r.pool, unsold: r.unsold, round: r.round, pid: r.cur.pid, status: r.status }));
function settle(r, now) {
  const c = r.cur;
  r.undo = snap(r);
  if (c.team >= 0) { const t = r.teams[c.team]; t.points -= c.bid; t.members.push({ pid: c.pid, price: c.bid }); say(r, `${nm(c.pid)} → ${t.name} · ${c.bid}P 낙찰`); }
  else { r.unsold.push(c.pid); say(r, `${nm(c.pid)} 유찰`); }
  return nextItem(r, now);
}
const batch = (r) => r.batch || (r.batch = { phase: 'initial', initial: {}, final: {}, ties: [] });
const isSubmitted = (r, phase, ti) => !!batch(r)[phase][ti];
const allSubmitted = (r, phase) => r.teams.every((_, i) => (phase === 'final' && !batch(r).ties.some((x) => x.teams.includes(i))) || isSubmitted(r, phase, i));
function award(r, pid, ti, price, note = '') {
  const t = r.teams[ti];
  if (!t || t.members.length >= r.cfg.size - 1 || price > t.points) return false;
  t.points -= price;
  t.members.push({ pid, price });
  say(r, `${nm(pid)} → ${t.name} · ${price}P 낙찰${note}`);
  return true;
}
function topOpenBids(r, pid, bids, eligible = null) {
  const ranked = Object.entries(bids || {}).map(([i, v]) => ({ ti: +i, value: +v || 0 }))
    .filter((x) => x.value > 0 && (!eligible || eligible.includes(x.ti)) && r.teams[x.ti]?.members.length < r.cfg.size - 1 && x.value <= r.teams[x.ti].points)
    .sort((a, b) => b.value - a.value);
  if (!ranked.length) return { best: 0, teams: [], ranked };
  const best = ranked[0].value;
  return { best, teams: ranked.filter((x) => x.value === best).map((x) => x.ti), ranked };
}
function resolveBatch(r, phase) {
  const b = batch(r), sheet = b[phase], pending = [...(phase === 'initial' ? r.pool : b.ties.map((x) => x.pid))];
  const tied = [];
  while (pending.length) {
    const proposals = pending.map((pid) => {
      const eligible = phase === 'final' ? b.ties.find((x) => x.pid === pid)?.teams : null;
      return { pid, ...topOpenBids(r, pid, Object.fromEntries(r.teams.map((_, i) => [i, sheet[i]?.bids?.[pid] || 0])), eligible) };
    });
    const unique = proposals.filter((x) => x.best && x.teams.length === 1).sort((a, b) => b.best - a.best);
    if (!unique.length) break;
    const win = unique[0];
    if (award(r, win.pid, win.teams[0], win.best)) pending.splice(pending.indexOf(win.pid), 1);
    else break;
  }
  const tiedPlayerCount = pending.filter((pid) => {
    const eligible = phase === 'final' ? b.ties.find((x) => x.pid === pid)?.teams : null;
    const result = topOpenBids(r, pid, Object.fromEntries(r.teams.map((_, i) => [i, sheet[i]?.bids?.[pid] || 0])), eligible);
    return result.best && result.teams.length > 1;
  }).length;
  for (const pid of pending) {
    const eligible = phase === 'final' ? b.ties.find((x) => x.pid === pid)?.teams : null;
    const result = topOpenBids(r, pid, Object.fromEntries(r.teams.map((_, i) => [i, sheet[i]?.bids?.[pid] || 0])), eligible);
    if (!result.best) { r.unsold.push(pid); say(r, `${nm(pid)} 유찰`); continue; }
    if (result.teams.length === 1) {
      award(r, pid, result.teams[0], result.best);
      continue;
    }
    const richest = [...result.teams].sort((a, b) => r.teams[b].points - r.teams[a].points);
    if (phase === 'final' || (tiedPlayerCount === 1 && r.teams[richest[0]].points !== r.teams[richest[1]].points)) {
      if (richest.length === 1 || r.teams[richest[0]].points > r.teams[richest[1]].points) {
        award(r, pid, richest[0], result.best, ' · 잔여 포인트 우선');
      } else { r.unsold.push(pid); say(r, `${nm(pid)} 최종 동점 · 미배정`); }
      continue;
    }
    tied.push({ pid, teams: result.teams, price: result.best });
  }
  if (phase === 'initial' && tied.length) {
    b.ties = tied; b.phase = 'final'; b.final = {};
    say(r, `동점 매물 ${tied.length}명 · 마지막 동시 입찰을 시작합니다.`);
    return r;
  }
  b.phase = 'done'; r.pool = [];
  if (phase === 'final') say(r, '마지막 동점 입찰 결과를 공개했습니다.');
  r.status = 'done'; r.cur = null;
  say(r, '경매가 끝났습니다.');
  return r;
}
const tx = async (id, fn) => {
  try {
    await S.store.syncServerClock?.();
    if (!S.store.serverClockReady?.()) throw new Error('시계 동기화에 실패했습니다. 연결을 확인한 뒤 다시 시도하세요.');
    return await S.store.tx('auctions', id, (r) => (r && !r.deleted ? fn(JSON.parse(JSON.stringify(r)), S.store.serverNow(), S.store.serverClockErr?.() || 0) : null));
  } catch (e) { toast('오류: ' + (e.code || e.message)); return false; }
};

function myRole(r, token) {
  const t = token || localStorage.getItem(hostKey(r.id));
  if (t && t === r.host) return { host: true, team: -1 };
  return { host: false, team: r.teams.findIndex((x) => x.token === t) };
}
function bestLanes(ids) { // 라인 점수 합이 최대가 되도록 5명을 라인에 배치
  let best = ids, top = -1;
  const perm = (arr, out) => {
    if (!arr.length) { const v = out.reduce((s, id, i) => s + (+S.st.P[id]?.p.scores?.[LANES[i]] || 0), 0); if (v > top) { top = v; best = out; } return; }
    arr.forEach((x, i) => perm([...arr.slice(0, i), ...arr.slice(i + 1)], [...out, x]));
  };
  if (ids.length === 5) perm(ids, []);
  return best;
}

function lobbyList() {
  const st = S.st, rooms = col('auctions').filter((r) => !r.deleted).sort((a, b) => b.createdAt - a.createdAt);
  const caps = Object.keys(AU.role).filter((k) => AU.role[k] === 2), parts = Object.keys(AU.role).filter((k) => AU.role[k] === 1);
  return `<h1>${ic('auction')}팀 경매</h1>
  <p class="hint">팀장별 포인트로 팀을 구성합니다. 실시간 경매 또는 매물별 일괄 입찰을 선택할 수 있고, 참가자는 같은 방의 진행 상황을 함께 봅니다.</p>
  ${rooms.length ? `<div class="panel"><div class="ph"><b>경매 방</b></div>${rooms.map((r) => `<a class="kv link" href="#/auction/${r.id}"><span>${esc(r.name)} <small class="mut">${new Date(r.createdAt).toLocaleDateString('ko')}</small></span><b>${{ lobby: '대기 중', running: '<i class="live"></i>진행 중', paused: '일시정지', done: '완료' }[r.status]} · ${r.teams.length}팀</b></a>`).join('')}</div>` : ''}
  <h2>새 경매 만들기</h2>
  <div class="panel">
    <label class="fld"><span>방 이름</span><input id="auName" class="inp" value="${esc(AU.name)}" placeholder="예: 11월 2주차 내전" data-i="auF" data-k="name"></label>
    <div class="fld"><span>경매 방식</span><div class="row"><label class="mini"><input type="radio" name="auMode" value="live" data-c="auMode" ${AU.mode === 'live' ? 'checked' : ''}> 실시간 경매</label><label class="mini"><input type="radio" name="auMode" value="batch" data-c="auMode" ${AU.mode === 'batch' ? 'checked' : ''}> 일괄 입찰</label></div><small class="mut">일괄 입찰은 팀장이 모든 매물의 가격을 제출한 뒤 한 번에 공개합니다.</small></div>
    <div class="ausel">
      <div class="au-pool">
        <div class="ph"><b>참가자</b><span class="tag ok">${parts.length + caps.length}명 선택</span><small class="mut">이름을 누르면 참가 ↔ 제외 · 왕관을 누르면 팀장</small><span class="grow"></span><button class="btn xs" data-a="auRecent">최근 내전 참가자</button><button class="btn xs" data-a="auAll">전원</button><button class="btn xs ghost" data-a="auNone">해제</button></div>
        ${st.list.length ? LANES.map((l) => { const g = st.byOvr.filter((s) => s.mainLane === l); return g.length ? `<div class="au-lane" style="--tc:${LANE_COLOR[l]}"><span class="au-ll">${LANE_ICON[l]}<b>${LANE_NAME[l]}</b><small class="mono">${g.filter((s) => AU.role[s.id]).length}/${g.length}</small></span>
          <div>${g.map((s) => { const r = AU.role[s.id] || 0; return `<span class="auc ${['', 'on', 'cap'][r]}"><button class="auc-n" data-a="auRole" data-id="${s.id}" data-r="1" title="${r ? '누르면 제외' : '누르면 참가'}">${esc(s.name)}<small class="mono">${s.ovr}</small></button><button class="auc-c" data-a="auRole" data-id="${s.id}" data-r="2" title="${r === 2 ? '팀장 해제' : '팀장으로 지정'}" aria-label="팀장 지정">${ic('crown')}</button></span>`; }).join('')}</div></div>` : ''; }).join('') : '<span class="mut">선수가 없습니다. 관리에서 먼저 선수를 등록하세요.</span>'}
      </div>
      <div class="au-caps">
        <div class="ph">${ic('crown')}<b>팀장</b><span class="tag gold">${caps.length}팀</span><span class="grow"></span><small class="mut">핸디캡 = 시작 포인트에서 차감</small></div>
        ${caps.map((id, i) => { const c = st.P[id]; return c ? `<div class="aucap" style="--tc:${LANE_COLOR[c.mainLane]}"><i class="mono">${i + 1}</i>${champIcon(sigChamp(c), 'face')}<div><b>${esc(c.name)}</b><small>${LANE_ICON[c.mainLane]} ${LANE_NAME[c.mainLane]} · OVR ${c.ovr}</small></div><label title="시작 포인트에서 차감할 포인트"><span>핸디캡</span><input id="auH${id}" class="inp xs mono" type="number" value="${AU.hcap[id] || 0}" data-i="auHc" data-id="${id}"></label><button class="btn ghost xs" data-a="auRole" data-id="${id}" data-r="2" title="팀장 해제">${ic('x')}</button></div>` : ''; }).join('') || `<div class="aucap-emp">${ic('crown')}<p>왼쪽 참가자 이름 옆의 <b>왕관</b>을 눌러<br>팀장을 2명 이상 지정하세요.</p></div>`}
        <div class="au-sum"><div><small>팀장</small><b class="mono">${caps.length}</b></div><div><small>매물</small><b class="mono">${parts.length}</b></div><div><small>필요</small><b class="mono">${caps.length * 4}</b></div></div>
        <p class="sm ${caps.length >= 2 && parts.length < caps.length * 4 ? 'bad' : 'mut'}">${caps.length < 2 ? '팀장이 정해지면 필요한 인원이 계산됩니다.' : parts.length < caps.length * 4 ? `팀당 4명이 필요합니다 · 매물이 ${caps.length * 4 - parts.length}명 부족합니다.` : parts.length > caps.length * 4 ? `${caps.length * 4}명 배정 · ${parts.length - caps.length * 4}명은 예비가 됩니다.` : '인원이 딱 맞습니다.'}</p>
      </div>
    </div>
    <div class="fgrid">
      <label class="fld"><span>시작 포인트</span><input id="auP" class="inp" type="number" value="${AU.points}" data-i="auF" data-k="points"></label>
      <label class="fld"><span>입찰 단위</span><input id="auU" class="inp" type="number" value="${AU.unit}" data-i="auF" data-k="unit"></label>
      ${AU.mode === 'live' ? `<label class="fld"><span>경매 시간(초)</span><input id="auS" class="inp" type="number" value="${AU.sec}" data-i="auF" data-k="sec"></label>
      <label class="fld"><span>입찰 시 최소 남은 시간(초)</span><input id="auE" class="inp" type="number" value="${AU.ext}" data-i="auF" data-k="ext"></label>
      <label class="fld"><span>매물 사이 대기(초)</span><select id="auD" class="inp" data-c="auDelay">${[5, 10, 15].map((v) => `<option value="${v}" ${AU.delay === v ? 'selected' : ''}>${v}초</option>`).join('')}</select></label>` : ''}
    </div>
    ${AU.mode === 'live' ? '<label class="mini"><input type="checkbox" data-c="auHide" ' + (AU.hide ? 'checked' : '') + '> 경매 순서 비공개 (무작위)</label>' : '<p class="hint">팀장은 매물별 입찰가 합계가 보유 포인트를 넘지 않도록 제출합니다. 낙찰된 금액만 차감됩니다.</p>'}
    <button class="btn pri block big" data-a="auCreate">경매 방 만들기</button>
  </div>`;
}

function batchStage(r, me) {
  const b = batch(r), phase = b.phase, isFinal = phase === 'final';
  const subs = isFinal ? b.final : b.initial;
  const teamIndex = me.host ? Math.min(AU.as, r.teams.length - 1) : me.team;
  const team = r.teams[teamIndex], submitted = teamIndex >= 0 && !!subs[teamIndex];
  const players = isFinal ? b.ties : r.pool.map((pid) => ({ pid, teams: r.teams.map((_, i) => i) }));
  const eligible = (x) => !isFinal || x.teams.includes(teamIndex);
  const draftKey = `${r.id}:${phase}:${teamIndex}`;
  const draft = AU.batchDraft[draftKey] || {};
  const rows = players.map((x) => {
    const pid = x.pid, s = S.st.P[pid];
    const detail = isFinal ? `1차 동점 ${x.price}P · ${x.teams.map((i) => esc(r.teams[i].name)).join(' / ')}` : s ? `${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · OVR ${s.ovr}` : '매물';
    return `<label class="sealed-row"><span><b>${esc(nm(pid))}</b><small>${detail}</small></span>${submitted ? '<b class="tag ok">제출 완료</b>' : `<input class="inp mono" type="number" min="0" step="${r.cfg.unit}" value="${draft[pid] ?? ''}" placeholder="0P" data-i="auBatchBid" data-id="${pid}" ${!eligible(x) || teamIndex < 0 ? 'disabled' : ''}>`}</label>`;
  }).join('');
  const requiredTeams = r.teams.map((_, i) => i).filter((i) => !isFinal || b.ties.some((x) => x.teams.includes(i)));
  const submittedCount = requiredTeams.filter((i) => subs[i]).length;
  const points = team?.points || 0;
  const total = Object.values(draft).reduce((sum, v) => sum + (+v || 0), 0);
  const status = r.teams.map((t, i) => `<span class="chip ${subs[i] ? 'ok' : ''}">${esc(t.name)} · ${isFinal && !requiredTeams.includes(i) ? '대상 아님' : subs[i] ? '제출 완료' : '대기 중'}</span>`).join('');
  return `<div class="panel stage sealed-stage">
    <div class="sub"><span class="tag">${isFinal ? '마지막 동점 입찰' : '일괄 입찰'}</span><span class="grow"></span><span class="tag">${submittedCount}/${requiredTeams.length}팀 제출</span></div>
    <h2>${isFinal ? `${ic('scale')}동점 매물 마지막 입찰` : `${ic('edit')}매물별 입찰가 입력`}</h2>
    <p class="mut">${isFinal ? '각 매물에서 1차 입찰이 동점이었던 팀만 다시 입찰할 수 있습니다. 이번 입찰은 딱 한 번이며, 다시 동점이면 남은 포인트가 많은 팀이 우선합니다.' : '모든 매물에 원하는 금액을 입력하세요. 0은 입찰하지 않음입니다. 제출 후에는 수정할 수 없으며, 모든 팀 제출 후 결과를 공개합니다.'}</p>
    ${teamIndex >= 0 && me.host ? `<label class="fld"><span>대리 입력 팀</span><select class="inp" data-c="auAs">${r.teams.map((t, i) => `<option value="${i}" ${i === teamIndex ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    ${teamIndex >= 0 ? `<div class="sealed-meta"><span>${esc(team.name)}</span><b>잔여 ${points}P</b><b id="au-batch-total" data-points="${points}" class="${total > points ? 'bad' : ''}">입찰 합계 ${total}P</b></div>` : '<p class="hint">팀장 링크로 접속하면 입찰할 수 있습니다.</p>'}
    <div class="sealed-list">${rows || '<p class="mut">입찰할 매물이 없습니다.</p>'}</div>
    ${teamIndex >= 0 ? (submitted ? '<div class="tag ok">이 팀은 제출을 완료했습니다. 입찰 공개를 기다리는 중입니다.</div>' : `<button class="btn pri block" data-a="auBatchSubmit" data-id="${r.id}" data-phase="${phase}" ${total > points || !players.some(eligible) ? 'disabled' : ''}>${isFinal ? '마지막 입찰 제출' : '입찰 제출 · 제출 후 수정 불가'}</button>`) : ''}
    <div class="chips">${status}</div>
  </div>`;
}

// ---------- 소리·진동: 내 팀 입찰이 밀렸을 때, 낙찰 순간(내 팀이면 더 밝게). 오른쪽 위 스피커 버튼으로 끔 ----------
try { AU.mute = localStorage.getItem('naejeon:aumute') === '1'; } catch {}
let ACX = null;
function cue(kind) {
  if (kind === 'outbid' || kind === 'win') try { navigator.vibrate?.(kind === 'win' ? [60, 40, 60] : 120); } catch {}
  if (AU.mute) return;
  try {
    ACX ||= new (window.AudioContext || window.webkitAudioContext)(); if (ACX.state === 'suspended') ACX.resume();
    const N = { outbid: [[330, 0, 0.12], [262, 0.13, 0.16]], sold: [[523, 0, 0.1], [659, 0.1, 0.18]], win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.28]] }[kind];
    const t0 = ACX.currentTime;
    for (const [f, at, d] of N) {
      const o = ACX.createOscillator(), g = ACX.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d);
      o.connect(g).connect(ACX.destination); o.start(t0 + at); o.stop(t0 + at + d + 0.02);
    }
  } catch {}
}
// 화면을 다시 그릴 때마다 지난번 상태와 비교해 '밀림'·'낙찰'을 한 번만 알린다(처음 연 화면에서는 알리지 않음)
let AW = { id: '', pid: '', lead: -1, n: 0 };
function cues(r, me) {
  if (!r || r.cfg.mode === 'batch') return;
  const c = r.cur, myT = me.host ? -1 : me.team, n = r.teams.reduce((a, t) => a + t.members.length, 0);
  if (AW.id === r.id) {
    if (c && c.pid === AW.pid && myT >= 0 && AW.lead === myT && c.team >= 0 && c.team !== myT) cue('outbid');
    if (AW.pid && (!c || c.pid !== AW.pid) && n > AW.n) {
      const ti = r.teams.findIndex((t) => t.members.some((m) => m.pid === AW.pid));
      if (ti >= 0) { AU.sold = { pid: AW.pid, team: ti, at: Date.now(), until: Date.now() + 2400 }; cue(ti === myT ? 'win' : 'sold'); }
    }
  }
  AW = { id: r.id, pid: c?.pid || '', lead: c?.team ?? -1, n };
}
function roomView(id, token) {
  const r = room(id), st = S.st;
  if (!r || r.deleted || r.status === 'deleted') return `<div class="panel empty">이 경매 방은 삭제되어 더 이상 참여할 수 없습니다. <a href="#/auction">경매 목록으로</a></div>`;
  const me = myRole(r, token), c = r.cur; cues(r, me);
  const base = location.origin + location.pathname + location.search + '#/auction/' + r.id;
  const bidTeam = me.host ? Math.min(AU.as, r.teams.length - 1) : me.team;
  const info = (pid) => { const s = st.P[pid]; return s ? `<div class="item"><div class="ov big"><b>${s.ovr}</b><small>OVR</small></div><div><h1>${esc(s.name)}</h1><div class="mut">${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · ${esc(s.p.soloTier || '티어 정보 없음')} · ${s.g ? `내전 ${s.wr}% (${s.g}판)` : '내전 기록 없음'}</div>
      <div class="lanes5 sm">${LANES.map((l) => `<div class="${l === s.mainLane ? 'main' : ''}"><small>${LANE_ICON[l]}</small><b>${s.p.scores?.[l] ?? 0}</b></div>`).join('')}</div></div></div>` : ''; };
  const teams = r.teams.map((t, i) => `<div class="panel ateam ${c && c.team === i ? 'lead' : ''} ${me.team === i ? 'mine' : ''}${AU.sold?.team === i && Date.now() < AU.sold.until ? ` au-win" style="--t:-${Date.now() - AU.sold.at}ms` : ''}">
    <div class="ph"><b>${esc(t.name)}</b>${me.team === i ? '<span class="tag ok">내 팀</span>' : ''}<span class="grow"></span><b class="pts">${t.points}P</b></div>
    <div class="kv"><span>${ic('crown')}${pname(t.captain)}</span><small class="mut">팀장</small></div>
    ${t.members.map((m) => `<div class="kv${m.pid === AU.sold?.pid && Date.now() < AU.sold.until ? ` au-sold" style="--t:-${Date.now() - AU.sold.at}ms` : ''}"><span>${pname(m.pid)} <small class="mut">${LANE_ICON[st.P[m.pid]?.mainLane] || ''}</small></span><b>${m.price}P</b></div>`).join('')}
    ${Array(Math.max(0, r.cfg.size - 1 - t.members.length)).fill('<div class="kv emp"><span>빈 자리</span></div>').join('')}</div>`).join('');
  let stage = '';
  if (r.status === 'lobby') {
    stage = `<div class="panel stage"><h2>대기 중</h2><p class="mut">팀장에게 각자의 링크를 보내고, 모두 들어오면 시작하세요.</p>
      ${me.host ? `<div class="links"><div class="kv"><span>${ic('eye')}관전 링크</span><span class="grow"></span><button class="btn xs" data-a="auCopy" data-u="${esc(base)}">복사</button><button class="btn xs" data-a="auSendLink" data-u="${esc(base)}" data-label="관전 링크">채팅 전송</button></div>
        ${r.teams.map((t) => `<div class="kv"><span>${ic('crown')}${pname(t.captain)} 팀장 링크</span><span class="grow"></span><button class="btn xs" data-a="auCopy" data-u="${esc(base + '/' + t.token)}">복사</button><button class="btn xs" data-a="auSendLink" data-u="${esc(base + '/' + t.token)}" data-label="${esc(nm(t.captain) + ' 팀장 링크')}">채팅 전송</button></div>`).join('')}</div>
        <button class="btn pri block big" data-a="auStart" data-id="${r.id}">▶ 경매 시작</button>` : `<p>${me.team >= 0 ? `${ic('crown')} <b>${esc(r.teams[me.team].name)}</b> 팀장으로 접속했습니다. 진행자가 시작하면 입찰할 수 있습니다.` : `${ic('eye')} 관전 중입니다.`}</p>`}</div>`;
  } else if (r.status === 'done') {
    stage = `<div class="panel stage"><h2>${ic('flag')}경매 완료</h2>${r.unsold.length ? `<p class="mut">예비: ${r.unsold.map(pname).join(', ')}</p>` : ''}
      ${r.teams.length >= 2 ? `${r.teams.length > 2 ? `<div class="row au-dl">${['블루', '레드'].map((side, k) => `<label class="fld"><span>${side}</span><select class="inp" data-c="auDl" data-i="${k}">${r.teams.map((t, i) => `<option value="${i}" ${Math.min(AU.dl[k], r.teams.length - 1) === i ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`).join('')}</div>` : ''}
      <button class="btn pri block big" data-a="auToDraft" data-id="${r.id}">${ic('today')}이 팀으로 오늘의 내전 라인업 채우기</button><p class="hint">${r.teams.length > 2 ? '고른 두 팀이' : '첫 번째 팀이 블루, 두 번째 팀이 레드로'} 들어가고 라인은 점수 기준으로 자동 배치됩니다(이후 수정 가능).</p>` : ''}
      ${me.host && r.undo ? `<button class="btn ghost block" data-a="auUndo" data-id="${r.id}">↩ 직전 낙찰 취소</button>` : ''}</div>`;
  } else if (r.cfg.mode === 'batch' && r.status === 'running') {
    stage = batchStage(r, me);
  } else if (c) {
    const lead = c.team >= 0 ? r.teams[c.team] : null, bt = r.teams[bidTeam];
    const can = bidTeam >= 0 && r.status === 'running' && bt.members.length < r.cfg.size - 1 && c.team !== bidTeam;
    const min = c.bid + r.cfg.unit;
    const b = (add) => `<button class="btn bid" data-a="auBid" data-id="${r.id}" data-v="${c.bid + add}" ${can && c.bid + add <= bt.points ? '' : 'disabled'}>+${add}<small>${c.bid + add}P</small></button>`;
    const lft = c.endsAt - S.store.serverNow(), hot = r.status === 'running' && S.store.serverNow() >= c.startsAt && lft > 0 && lft < 5000 ? ' hot' : ''; // 다시 그려도 맥동이 끊기지 않게
    stage = `<div class="panel stage ${r.status}${hot}">
      <div class="sub"><span class="tag">${r.round === 2 ? '재경매' : '경매'} · 남은 매물 ${r.pool.length}</span><span class="grow"></span><span id="au-timer" class="timer${hot}">--</span></div>
      ${info(c.pid)}
      <div class="bidnow${lead ? ' lead' : ''}${bidBumped(c) ? ' bump' : ''}"><small>현재 입찰</small><b>${c.bid}P</b><span>${lead ? `${ic('crown')}${esc(lead.name)}` : '입찰 없음'}</span></div>
      ${bidTeam >= 0 ? `<div class="bidbar">
        ${me.host ? `<select class="inp" data-c="auAs">${r.teams.map((t, i) => `<option value="${i}" ${i === bidTeam ? 'selected' : ''}>${esc(t.name)} 대리 입찰</option>`).join('')}</select>` : ''}
        <div class="bids">${b(r.cfg.unit)}${b(r.cfg.unit * 5)}${b(r.cfg.unit * 10)}</div>
        <div class="row"><input id="auAmt" class="inp grow" type="number" inputmode="numeric" placeholder="직접 입력 (${min}P 이상)" value="${esc(AU.amt)}" data-i="auAmt"><button class="btn pri" data-a="auBid" data-id="${r.id}" data-v="amt" ${can ? '' : 'disabled'}>입찰</button></div>
        <p class="hint">${bt.members.length >= r.cfg.size - 1 ? '팀이 가득 찼습니다.' : c.team === bidTeam ? '현재 최고 입찰 팀입니다.' : `${esc(bt.name)} 잔여 ${bt.points}P`}</p></div>` : `<p class="mut">${ic('eye')} 관전 중 — 팀장 링크로 들어오면 입찰할 수 있습니다.</p>`}
      ${me.host ? `<div class="row au-hostbar"><button class="btn" data-a="auPause" data-id="${r.id}">${r.status === 'paused' ? '▶ 재개' : '⏸ 일시정지'}</button>${r.status === 'running' && S.store.serverNow() < c.startsAt ? `<button class="btn" data-a="auNow" data-id="${r.id}">⏩ 바로 시작</button>` : ''}${r.undo ? `<button class="btn ghost" data-a="auUndo" data-id="${r.id}" title="직전 낙찰(유찰)을 취소하고 그 선수를 다시 경매">↩ 직전 낙찰 취소</button>` : ''}</div>` : ''}</div>`;
  }
  const queue = r.pool, hideUpcoming = r.cfg.hide && r.status !== 'done';
  const queueView = hideUpcoming ? `<span class="chip mut">매물 이름 비공개 · ${queue.length}명</span>` : queue.map((p) => `<span class="chip">${pname(p)}</span>`).join('') || '<span class="chip mut">없음</span>';
  const unsoldView = hideUpcoming ? `<span class="chip mut">유찰 선수 이름 비공개 · ${r.unsold.length}명</span>` : r.unsold.map((p) => `<span class="chip mut">${pname(p)}</span>`).join('');
  const canDelete = me.host || ['lobby', 'running', 'paused'].includes(r.status);
  return `<div class="h2row"><a class="btn xs" href="#/auction">← 목록</a><h1>${ic('auction')}${esc(r.name)}</h1><span class="grow"></span><button class="btn xs ghost" data-a="auMute" title="입찰 밀림·낙찰 효과음과 진동">${ic(AU.mute ? 'mute' : 'sound')}</button>${me.host ? '<span class="tag ok">진행자</span>' : ''}${canDelete ? `<button class="btn xs ghost" data-a="auDel" data-id="${r.id}">${me.host ? '방 삭제' : '관리자 삭제'}</button>` : ''}</div>
  <div class="agrid"><div>${stage}
    <div class="panel"><div class="ph"><b>대기 매물 ${r.pool.length}</b><small class="mut">${hideUpcoming ? '다음 매물 비공개' : '경매 순서 공개'}</small></div><div class="chips">${queueView}</div>
      ${r.unsold.length ? `<div class="ph"><b>유찰 ${r.unsold.length}</b></div><div class="chips">${unsoldView}</div>` : ''}</div>
    <div class="panel"><div class="ph"><b>${ic('chat')}채팅 · 기록</b></div>
      <div class="chat" id="au-chat">${[...(r.log || []).map((x) => ({ ...x, sys: 1 })), ...(r.chat || [])].sort((a, b) => a.t - b.t).slice(-60).map((x) => (x.sys ? `<div class="sys">${esc(x.s)}</div>` : `<div><b>${esc(x.w)}</b> ${esc(x.s)}</div>`)).join('') || '<div class="sys">아직 기록이 없습니다.</div>'}</div>
      <form class="row" id="au-chatf" data-id="${r.id}"><input id="auChat" class="inp grow" maxlength="100" placeholder="메시지 입력" value="${esc(AU.chat)}" data-i="auChatI" autocomplete="off"><button class="btn">전송</button></form></div>
  </div><div class="ateams">${teams}</div></div>`;
}

// 입찰 금액이 바뀌어 다시 그릴 때만 한 번 반짝(같은 매물에서 금액이 오른 경우)
let lastBid = null;
function bidBumped(c) { const k = c.pid + ':' + c.bid, b = lastBid && lastBid !== k && lastBid.startsWith(c.pid + ':') && c.bid > 0; lastBid = k; return b; }
let timer = 0;
let clockSyncPending = false, clockRetryAt = 0;
function tick() {
  if (S.page !== 'auction' || !S.arg[0]) { clearInterval(timer); timer = 0; return; }
  const r = room(S.arg[0]), el = document.getElementById('au-timer');
  if (!r || r.deleted || r.status === 'deleted') { clearInterval(timer); timer = 0; return; }
  if (!r.cur || !el) return;
  const c = r.cur;
  if (!S.store.serverClockReady?.()) {
    el.textContent = '시계 동기화 중';
    if (!clockSyncPending && Date.now() >= clockRetryAt) {
      clockSyncPending = true;
      Promise.resolve(S.store.syncServerClock?.(true)).finally(() => { clockSyncPending = false; clockRetryAt = Date.now() + 15_000; });
    }
    return;
  }
  const now = S.store.serverNow();
  if (r.status === 'paused') { el.textContent = `⏸ ${Math.ceil((c.left || 0) / 1000)}초`; return; }
  const waiting = now < c.startsAt, bar = document.querySelector('.bidbar');
  if (bar && bar.classList.contains('wait') !== waiting) bar.classList.toggle('wait', waiting); // 대기 중엔 입찰 버튼을 흐리게(누르면 '아직 시작 전' 안내)
  if (!waiting) document.querySelector('[data-a=auNow]')?.remove(); // 시작되면 '바로 시작' 버튼은 치운다
  if (waiting) { el.textContent = `곧 시작 ${Math.ceil((c.startsAt - now) / 1000)}`; el.className = 'timer'; return; }
  const left = c.endsAt - now;
  el.textContent = left > 0 ? `⏱ ${Math.ceil(left / 1000)}초` : '낙찰 처리 중…';
  const hot = left > 0 && left < 5000;
  if (el.classList.contains('hot') !== hot) { el.classList.toggle('hot', hot); el.closest('.stage')?.classList.toggle('hot', hot); } // 마감 5초 전: 타이머·경매판 빨간 맥동
  const me = myRole(r, S.arg[1]);
  if (left <= (me.host || me.team >= 0 ? 0 : -2500) - (S.store.serverClockErr?.() || 0) && !tick.busy) { // 시간이 끝나면 접속자 중 누구든 정산(중복 실행돼도 안전)
    tick.busy = true;
    tx(r.id, (x, t, err) => (x.status === 'running' && x.cur && x.cur.pid === c.pid && passed(t, err, x.cur.endsAt) ? settle(x, t + err) : null)).finally(() => setTimeout(() => (tick.busy = false), 800));
  }
}
// 경매 기록은 이 화면을 연 사람만 실시간으로 받는다(store.need). 다른 화면으로 가고 1분이 지나면 구독을 끊는다.
// 실시간 입찰·타이머·정산은 원래도 경매 화면을 연 사람의 브라우저에서만 돌았으므로 동작은 같다.
let auOff = 0;
addEventListener('hashchange', () => {
  clearTimeout(auOff);
  if (!/^#\/auction(\/|$)/.test(location.hash)) auOff = setTimeout(() => { if (S.page !== 'auction') S.store?.unneed?.('auctions'); }, 60e3);
});
const auReady = () => { if (S.store.loaded?.('auctions') !== false) return true; S.store.need('auctions').then(() => { if (S.page === 'auction') refresh(); }); return false; };
page('auction', {
  render: (id, token) => (!auReady() ? `<h1>${ic('auction')}팀 경매</h1><div class="panel empty">경매 방을 불러오는 중…</div>` : id ? roomView(id, token) : lobbyList()),
  after() {
    if (!S.arg[0] || S.store.loaded?.('auctions') === false) return; // 경매 기록을 다 받은 뒤에 타이머를 돌린다
    if (!timer) timer = setInterval(tick, 250);
    tick();
    // 채팅·기록: 맨 아래를 보고 있었을 때만 새 기록을 따라 내려간다(위로 올려 읽는 중이면 그 자리 유지)
    const ch = document.getElementById('au-chat');
    if (ch) {
      if (AU.chatRoom !== S.arg[0]) { AU.chatRoom = S.arg[0]; AU.chatPin = true; }
      ch.scrollTop = AU.chatPin ? ch.scrollHeight : AU.chatTop || 0;
      ch.onscroll = () => { AU.chatPin = ch.scrollHeight - ch.scrollTop - ch.clientHeight < 24; AU.chatTop = ch.scrollTop; };
    }
    const f = document.getElementById('au-chatf');
    if (f) f.onsubmit = (e) => {
      e.preventDefault();
      const s = AU.chat.trim(), r = room(f.dataset.id); if (!s || !r) return;
      const me = myRole(r, S.arg[1]), w = me.host ? '진행자' : me.team >= 0 ? `팀장 ${nm(r.teams[me.team].captain)}` : '관전자';
      AU.chat = '';
      tx(r.id, (x, t) => { x.chat = [...(x.chat || []), { t, w, s }].slice(-40); return x; });
    };
  },
});
act('auF', (d, el) => { AU[d.k] = d.k === 'name' ? el.value : Math.max(0, +el.value || 0); });
act('auHc', (d, el) => { AU.hcap[d.id] = +el.value || 0; });
act('auHide', (d, el) => { AU.hide = el.checked; });
act('auDelay', (d, el) => { AU.delay = +el.value || 15; });
act('auMode', (d, el) => { AU.mode = el.value; refresh(); });
// r=1: 이름(참가 ↔ 제외, 팀장이면 일반 참가자로) · r=2: 왕관(팀장 ↔ 참가자)
act('auRole', (d) => { const cur = AU.role[d.id] || 0; AU.role[d.id] = d.r === '2' ? (cur === 2 ? 1 : 2) : cur === 1 ? 0 : 1; refresh(); });
act('auAll', () => { S.st.list.forEach((s) => { AU.role[s.id] ||= 1; }); refresh(); });
act('auNone', () => { AU.role = {}; refresh(); });
act('auRecent', () => {
  const st = S.st; const keep = Object.keys(AU.role).filter((k) => AU.role[k] === 2); AU.role = {};
  st.matches.filter((m) => st.MI[m.id].day === st.lastDay).forEach((m) => [...m.blue, ...m.red].forEach((id) => (AU.role[id] = 1)));
  keep.forEach((id) => { if (AU.role[id]) AU.role[id] = 2; });
  refresh();
});
act('auChatI', (d, el) => { AU.chat = el.value; });
act('auAmt', (d, el) => { AU.amt = el.value; });
act('auAs', (d, el) => { AU.as = +el.value; refresh(); });
act('auCopy', async (d) => { try { await navigator.clipboard.writeText(d.u); toast('링크를 복사했습니다'); } catch { prompt('이 링크를 복사하세요', d.u); } });
act('auSendLink', (d) => { if (d.u && sendLobbyChat(`${d.label || '경매 링크'}: ${d.u}`)) toast('공용 채팅에 링크를 보냈습니다'); });
act('auCreate', async () => {
  const caps = Object.keys(AU.role).filter((k) => AU.role[k] === 2), parts = Object.keys(AU.role).filter((k) => AU.role[k] === 1);
  if (caps.length < 2) return toast('팀장을 2명 이상 지정해 주세요 (이름 옆 왕관 누르기)');
  if (!parts.length) return toast('경매에 나올 참가자를 선택해 주세요');
  if (!Number.isInteger(AU.unit) || AU.unit < 1 || (AU.mode === 'live' && AU.sec < 5)) return toast('입찰 단위는 1 이상의 정수여야 하며, 실시간 경매 시간은 5초 이상이어야 합니다');
  for (let i = parts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [parts[i], parts[j]] = [parts[j], parts[i]]; }
  const id = uid(), host = tok();
  const r = {
    id, name: AU.name.trim() || `${dayKey(Date.now()).slice(5)} 경매`, createdAt: Date.now(), status: 'lobby', host,
    cfg: { points: AU.points, unit: AU.unit, sec: AU.sec, ext: AU.ext, delay: AU.delay, size: 5, hide: AU.hide, mode: AU.mode },
    teams: caps.map((pid) => ({ name: nm(pid) + ' 팀', captain: pid, token: tok(), points: Math.max(0, AU.points - (AU.hcap[pid] || 0)), members: [] })),
    pool: parts, unsold: [], round: 1, cur: null, log: [], chat: [],
  };
  await S.store.put('auctions', id, r);
  localStorage.setItem(hostKey(id), host);
  AU.role = {}; AU.name = ''; AU.mode = 'live'; AU.as = 0; AU.batchDraft = {};
  go(`#/auction/${id}/${host}`);
});
act('auStart', (d) => tx(d.id, (r, t, err) => { const now = t + err;
  if (r.status !== 'lobby') return null;
  r.status = 'running'; say(r, '▶ 경매를 시작합니다!');
  if (r.cfg.mode === 'batch') { r.batch = { phase: 'initial', initial: {}, final: {}, ties: [] }; return r; }
  return nextItem(r, now);
}));
act('auPause', (d) => tx(d.id, (r, now, err) => {
  if (!r.cur) return null;
  if (r.status === 'running') { r.status = 'paused'; r.cur.left = Math.max(1000, r.cur.endsAt - (now - err)); }
  else if (r.status === 'paused') { r.status = 'running'; r.cur.endsAt = now + err + r.cur.left; r.cur.startsAt = Math.min(r.cur.startsAt, now); }
  return r;
}));
act('auBid', async (d) => {
  const r0 = room(d.id); if (!r0?.cur) return;
  const me = myRole(r0, S.arg[1]), ti = me.host ? Math.min(AU.as, r0.teams.length - 1) : me.team, pid = r0.cur.pid;
  const v = d.v === 'amt' ? Math.floor(+AU.amt) : +d.v;
  if (!v || v < r0.cur.bid + r0.cfg.unit) return toast(r0.cur.team >= 0 && d.v !== 'amt' ? `${r0.teams[r0.cur.team]?.name || '다른 팀'}이 먼저 ${r0.cur.bid}P를 불렀어요 · 다음 최소 ${r0.cur.bid + r0.cfg.unit}P` : `${r0.cur.bid + r0.cfg.unit}P 이상 입찰해야 합니다`);
  if (r0.cur.team === ti) return toast('이미 우리 팀이 최고 입찰이에요');
  if (v % r0.cfg.unit) return toast(`입찰 단위는 ${r0.cfg.unit}P입니다`);
  if (v > r0.teams[ti].points) return toast('포인트가 부족합니다');
  let why = '';
  const ok = await tx(d.id, (r, now, err) => {
    const c = r.cur, t = r.teams[ti];
    if (r.status === 'paused') { why = '일시정지 중이에요'; return null; }
    if (r.status !== 'running' || !c || c.pid !== pid || passed(now, err, c.endsAt)) { why = '이 매물은 시간이 끝났어요'; return null; }
    if (now + err < c.startsAt) { why = '아직 입찰 시작 전이에요'; return null; }
    if (c.team === ti) { why = '이미 우리 팀이 최고 입찰이에요'; return null; }
    if (v < c.bid + r.cfg.unit) { why = `${r.teams[c.team]?.name || '다른 팀'}이 먼저 ${c.bid}P를 불렀어요 · 다음 최소 ${c.bid + r.cfg.unit}P`; return null; }
    if (v > t.points) { why = '포인트가 부족해요'; return null; }
    if (t.members.length >= r.cfg.size - 1) { why = '팀이 가득 찼어요'; return null; }
    c.bid = v; c.team = ti; c.endsAt = Math.max(c.endsAt, now + err + r.cfg.ext * 1000);
    say(r, `${t.name} ${v}P`);
    return r;
  });
  if (ok) { AU.amt = ''; } else if (ok !== false) toast(why ? '입찰이 반영되지 않았어요 · ' + why : '입찰이 반영되지 않았어요');
});
// 진행자: 직전 낙찰(유찰) 취소 → 그 선수를 처음부터 다시 경매(지금 경매하던 다음 매물은 다시 대기열 맨 앞으로)
act('auUndo', (d) => {
  const r0 = room(d.id); if (!r0?.undo || !myRole(r0, S.arg[1]).host) return;
  if (!confirm(`직전 낙찰을 취소할까요?\n${nm(r0.undo.pid)} 선수를 다시 경매하고, 낙찰 포인트는 돌려줍니다.`)) return;
  tx(d.id, (r, now, err) => {
    const u = r.undo; if (!u || r.cfg.mode === 'batch' || !['running', 'paused', 'done'].includes(r.status)) return null;
    // 낙찰 직전 상태로 통째로 되돌린다(그 뒤에 꺼낸 다음 매물은 이미 기억해 둔 대기열 맨 앞에 들어 있음 → 따로 넣지 않는다)
    r.teams.forEach((t, i) => { t.points = u.teams[i].points; t.members = u.teams[i].members; });
    r.pool = u.pool; r.unsold = u.unsold; r.round = u.round; r.undo = null;
    r.status = u.status === 'paused' ? 'paused' : 'running';
    const at = now + err + lotDelay(r);
    r.cur = { pid: u.pid, bid: 0, team: -1, startsAt: at, endsAt: at + r.cfg.sec * 1000, ...(r.status === 'paused' ? { left: lotDelay(r) + r.cfg.sec * 1000 } : {}) };
    say(r, `↩ 진행자가 직전 낙찰을 취소했어요 · ${nm(u.pid)} 다시 경매`);
    return r;
  }).then((ok) => ok && toast('직전 낙찰을 취소했어요'));
});
// 진행자: 매물 사이 대기 건너뛰고 바로 입찰 시작
act('auNow', (d) => tx(d.id, (r, now, err) => {
  const c = r.cur; if (r.status !== 'running' || !c || now - err >= c.startsAt) return null;
  const at = now + err; c.endsAt = at + r.cfg.sec * 1000; c.startsAt = at; return r;
}));
act('auMute', () => { AU.mute = !AU.mute; try { localStorage.setItem('naejeon:aumute', AU.mute ? '1' : '0'); } catch {} refresh(); });
act('auDl', (d, el) => { AU.dl[+d.i] = +el.value; });
act('auBatchBid', (d, el) => {
  const r = room(S.arg[0]); if (!r || r.cfg.mode !== 'batch') return;
  const me = myRole(r, S.arg[1]), ti = me.host ? Math.min(AU.as, r.teams.length - 1) : me.team;
  if (ti < 0) return;
  const phase = batch(r).phase, key = `${r.id}:${phase}:${ti}`;
  (AU.batchDraft[key] ||= {})[d.id] = el.value;
  const total = Object.values(AU.batchDraft[key]).reduce((sum, v) => sum + (+v || 0), 0);
  const out = document.getElementById('au-batch-total');
  if (out) { out.textContent = `입찰 합계 ${total}P`; out.classList.toggle('bad', total > r.teams[ti].points); }
});
act('auBatchSubmit', async (d) => {
  const r0 = room(d.id); if (!r0 || r0.cfg.mode !== 'batch') return;
  const me = myRole(r0, S.arg[1]), ti = me.host ? Math.min(AU.as, r0.teams.length - 1) : me.team;
  if (ti < 0 || (!me.host && ti < 0)) return toast('팀장 링크로 접속해 주세요');
  const b0 = batch(r0), phase = d.phase, key = `${r0.id}:${phase}:${ti}`, draft = AU.batchDraft[key] || {};
  if (b0.phase !== phase) return toast('입찰 단계가 이미 변경되었습니다. 화면을 새로고침해 주세요.');
  const players = phase === 'final' ? b0.ties : r0.pool.map((pid) => ({ pid, teams: r0.teams.map((_, i) => i) }));
  const bids = {}, team = r0.teams[ti]; let total = 0;
  for (const x of players) {
    if (phase === 'final' && !x.teams.includes(ti)) continue;
    const raw = draft[x.pid] ?? '';
    if (raw === '') continue;
    const v = +raw;
    if (!Number.isInteger(v) || v < 0 || (v && v % r0.cfg.unit)) return toast(`입찰은 0 또는 ${r0.cfg.unit}P 단위의 정수로 입력하세요`);
    if (v > 0) { bids[x.pid] = v; total += v; }
  }
  if (total > team.points) return toast(`입찰 합계가 잔여 포인트 ${team.points}P를 넘었습니다`);
  const ok = await tx(d.id, (r, now) => {
    const b = batch(r), sheet = phase === 'final' ? b.final : b.initial;
    if (r.status !== 'running' || r.cfg.mode !== 'batch' || b.phase !== phase || sheet[ti]) return null;
    const livePlayers = phase === 'final' ? b.ties : r.pool.map((pid) => ({ pid, teams: r.teams.map((_, i) => i) }));
    if (phase === 'final' && !livePlayers.some((x) => x.teams.includes(ti))) return null;
    if (Object.values(bids).some((v) => !Number.isInteger(v) || v < 1 || v % r.cfg.unit || v > r.teams[ti].points)) return null;
    if (Object.values(bids).reduce((sum, v) => sum + v, 0) > r.teams[ti].points) return null;
    sheet[ti] = { bids, at: now };
    const required = phase === 'final' ? new Set(b.ties.flatMap((x) => x.teams)).size : r.teams.length;
    say(r, `${r.teams[ti].name} 입찰 제출 완료 (${Object.keys(sheet).length}/${required})`);
    if (allSubmitted(r, phase)) resolveBatch(r, phase);
    return r;
  });
  if (ok) {
    delete AU.batchDraft[key];
    const updated = room(d.id);
    toast(updated?.batch?.phase === 'final' && phase === 'initial' ? '1차 결과 공개 · 동점 매물 마지막 입찰을 시작합니다' : updated?.status === 'done' ? '입찰 결과를 공개했습니다' : '입찰을 제출했습니다');
    refresh();
  } else toast('입찰 제출에 실패했습니다. 단계와 잔여 포인트를 확인해 주세요.');
});
act('auToDraft', (d) => {
  const r = room(d.id); if (!r) return;
  const [a, b] = r.teams.length === 2 ? [0, 1] : AU.dl.map((i) => Math.min(i, r.teams.length - 1));
  if (a === b) return toast('블루와 레드에 서로 다른 팀을 골라 주세요');
  const ids = (t) => bestLanes([t.captain, ...t.members.map((m) => m.pid)].slice(0, 5));
  setDraftTeams(ids(r.teams[a]), ids(r.teams[b]));
  toast('라인업을 채웠습니다'); go('#/today');
});
act('auDel', (d) => {
  const current = room(d.id); if (!current) return;
  const me = myRole(current, S.arg[1]);
  const remove = () => {
    if (!me.host && !isAdmin()) return toast('관리자 권한이 필요합니다');
    if (!confirm('이 경매 방을 삭제할까요? 진행 중인 경매는 모든 참가자에게 즉시 종료됩니다.')) return;
    tx(d.id, (r) => {
      if (!me.host && !isAdmin()) return null;
      r.deleted = true; r.status = 'deleted'; r.cur = null;
      say(r, '경매 방이 삭제되어 진행이 종료되었습니다.');
      return r;
    }).then((ok) => { if (ok) go('#/auction'); else toast('경매 방을 삭제하지 못했습니다'); });
  };
  if (me.host) remove(); else needAdmin(remove);
});
