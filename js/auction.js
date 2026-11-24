// 팀 경매: 팀장이 한정 포인트로 선수를 한 명씩 입찰. 타이머·입찰은 DB 트랜잭션으로 모든 접속자에게 동기화된다.
import { S, page, act, esc, uid, col, pname, go, refresh, toast, needAdmin, isAdmin, ic, champIcon, sigChamp, dots, streak, titleChips, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
import { dayKey } from './stats.js';
import { setDraftTeams } from './today.js';
import { sendLobbyChat } from './social.js';
import { talkOf, talkIcon } from './board.js';

const AU = { blind: false, name: '', role: {}, points: 1000, unit: 10, sec: 20, ext: 5, extTouched: false, delay: 15, hcap: {}, hide: true, chat: '', amt: '', as: 0, mode: 'live', batchDraft: {}, dl: [0, 1] };
const LOT_START_DELAY_MS = 15_000; // 예전 방(대기시간 설정이 없던 방)의 매물 사이 대기
// 연장 추천값: 경매 시간의 1/4(3~10초). 20초 → 5초, 30초 → 8초, 10초 → 3초
export const recExt = (sec) => Math.min(10, Math.max(3, Math.round((+sec || 0) / 4)));
// 예상 소요 시간(초): 매물 수 = min(참가자, 팀장 수 × 4). 매물 1개 = 대기 + 경매 + 정산(약 0.5초).
// 빠르면: 경쟁 없음 · 보통: 매물 40%에서 연장 2번 · 길면: 75%에서 연장 2번 + 재경매 2번
export function auEstimate(cfg, parts, caps) {
  const n = Math.min(parts, caps * (cfg.size - 1 || 4)); if (!n || caps < 2) return null;
  const lot = (cfg.delay ?? 15) + cfg.sec + 0.5, ext = cfg.ext;
  return { n, low: n * lot, mid: n * lot + Math.ceil(n * 0.4) * 2 * ext, high: n * lot + Math.ceil(n * 0.75) * 2 * ext + 2 * lot };
}
const fmtDur = (sec) => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return m ? `${m}분${s ? ` ${s}초` : ''}` : `${s}초`; };
const estHTML = (e) => (e ? `${ic('clock')}예상 소요 <b>약 ${fmtDur(e.mid)}</b><small>빠르면 ${fmtDur(e.low)} · 길면 ${fmtDur(e.high)} · 경매 ${e.n}번 기준</small>` : `${ic('clock')}<small>팀장 2명 이상과 참가자를 고르면 예상 소요 시간이 나와요</small>`);
const lotDelay = (r) => (r.cfg.delay ?? LOT_START_DELAY_MS / 1000) * 1000;
const tok = () => uid() + uid();
const hostKey = (id) => `naejeon:auhost:${S.key}:${id}`;
const room = (id) => S.store.data.auctions?.[id];
const say = (r, s) => { r.log = [...(r.log || []), { t: Date.now(), s }].slice(-40); };
const openTeams = (r) => r.teams.map((t, i) => i).filter((i) => r.teams[i].members.length < r.cfg.size - 1);
const nm = (id) => S.st.P[id]?.name || '?';
// 팀 색: 팀 순서대로(블루·레드·초록·보라·주황·청록·분홍·노랑). 팀 카드·현재 입찰·입찰 경쟁·낙찰 배너·결과 요약에 같은 색을 써서 누가 이기는지 한눈에
const TEAM_COLOR = ['#5b8cff', '#f0506e', '#4fd08b', '#b07cff', '#ff9f43', '#3fd0e0', '#ff7ac6', '#e8d35a'];
export const teamColor = (i) => TEAM_COLOR[((i % TEAM_COLOR.length) + TEAM_COLOR.length) % TEAM_COLOR.length];
// 익명 경매(cfg.blind): 끝나기 전까지는 매물을 '매물 A·B…'로만 보여 주고 힌트(주라인·라인 점수 모양·최근 흐름·챔피언 성향·소통)만 공개.
// 화면에서만 숨긴다(방 문서에는 선수 ID가 그대로 있음 — 친구끼리 재미용). 기록 글에도 별칭으로 남기고, 끝나면 한꺼번에 정체 공개
const blindOn = (r) => !!r?.cfg?.blind && r.status !== 'done';
const alias = (r, pid) => r.alias?.[pid] || '?';
const whoT = (r, pid) => (blindOn(r) ? `매물 ${alias(r, pid)}` : nm(pid));
const who = (r, pid) => (blindOn(r) ? `<span class="au-anon">🎭 매물 ${esc(alias(r, pid))}</span>` : pname(pid));
const letter = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const ROLE = { Assassin: '암살자', Fighter: '전사', Mage: '마법사', Marksman: '원거리 딜러', Support: '서포터', Tank: '탱커' };
function champStyle(s) { // 판수 기준 역할군 상위 2개(챔피언 이름은 숨김)
  const n = {}; let all = 0;
  for (const [name, v] of Object.entries(s.champs || {})) { const t = S.champBy?.[name]?.tags?.[0]; if (!t || !ROLE[t]) continue; n[t] = (n[t] || 0) + (v.g || 0); all += v.g || 0; }
  if (all < 3) return '';
  return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, g], i) => `<span class="as-role${i ? '' : ' top'}">${ROLE[t]}${i ? '' : ' 위주'} <small>${Math.round((g / all) * 100)}%</small></span>`).join('');
}
const tname = (r, i) => (r.teams[i] ? `<span class="au-tn" style="--tc:${teamColor(i)}">${esc(r.teams[i].name)}</span>` : '');

function finish(r) { r.status = 'done'; r.cur = null; say(r, '경매가 끝났습니다.'); return r; }
function nextItem(r, now) {
  let open = openTeams(r);
  if (!open.length) return finish(r);
  if (!r.pool.length && r.unsold.length && r.round < 2) { r.pool = r.unsold; r.unsold = []; r.round++; say(r, '유찰된 선수를 다시 경매합니다.'); }
  if (open.length === 1 || !r.pool.length) {
    const left = [...r.pool, ...r.unsold]; r.pool = []; r.unsold = [];
    while (left.length && (open = openTeams(r)).length) {
      const ti = open.sort((a, b) => r.teams[b].points - r.teams[a].points || r.teams[a].members.length - r.teams[b].members.length)[0];
      const pid = left.shift(); r.teams[ti].members.push({ pid, price: 0 }); say(r, `${whoT(r, pid)} → ${r.teams[ti].name} (자동 배정)`);
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
  if (c.team >= 0) { const t = r.teams[c.team]; t.points -= c.bid; t.members.push({ pid: c.pid, price: c.bid }); say(r, `${whoT(r, c.pid)} → ${t.name} · ${c.bid}P 낙찰`); }
  else { r.unsold.push(c.pid); say(r, `${whoT(r, c.pid)} 유찰`); }
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

const formCfg = () => ({ sec: AU.sec, ext: AU.ext, delay: AU.delay, size: 5 });
const formEst = () => { const caps = Object.keys(AU.role).filter((k) => AU.role[k] === 2).length, parts = Object.keys(AU.role).filter((k) => AU.role[k] === 1).length; return auEstimate(formCfg(), parts, caps); };
const recHTML = () => { const r = recExt(AU.sec); return AU.ext === r ? `추천값(경매 시간의 1/4)` : `추천 ${r}초 <button type="button" class="lnk" data-a="auExtRec">적용</button>`; };
// 입력 중에는 화면 전체를 다시 그리지 않고 추천·예상 시간 글자만 바꾼다(입력칸 커서 유지)
function formLive() { const a = document.getElementById('au-rec'), b = document.getElementById('au-est'); if (a) a.innerHTML = recHTML(); if (b) b.innerHTML = estHTML(formEst()); }
function lobbyList() {
  const st = S.st, rooms = col('auctions').filter((r) => !r.deleted).sort((a, b) => b.createdAt - a.createdAt);
  const caps = Object.keys(AU.role).filter((k) => AU.role[k] === 2), parts = Object.keys(AU.role).filter((k) => AU.role[k] === 1);
  return `<h1>${ic('auction')}팀 경매</h1>
  <p class="hint">팀장별 포인트로 팀을 구성합니다. 실시간 경매 또는 매물별 일괄 입찰을 선택할 수 있고, 참가자는 같은 방의 진행 상황을 함께 봅니다.</p>
  ${rooms.length ? `<div class="panel"><div class="ph"><b>경매 방</b>${S.store.allLoaded?.('auctions') === false ? '<small class="mut">최근 2주</small>' : ''}</div>${rooms.map((r) => `<a class="kv link" href="#/auction/${r.id}"><span>${esc(r.name)} <small class="mut">${new Date(r.createdAt).toLocaleDateString('ko')}</small></span><b>${{ lobby: '대기 중', running: '<i class="live"></i>진행 중', paused: '일시정지', done: '완료' }[r.status]} · ${r.teams.length}팀${r.cfg?.blind ? ' · 🎭 익명' : ''}</b></a>`).join('')}${S.store.allLoaded?.('auctions') === false ? `<button class="btn ghost xs block au-old" data-a="auOld" ${AU.oldBusy ? 'disabled' : ''}>${AU.oldBusy ? '불러오는 중…' : '이전 경매 보기'}</button>` : ''}</div>` : S.store.allLoaded?.('auctions') === false ? `<button class="btn ghost xs au-old" data-a="auOld" ${AU.oldBusy ? 'disabled' : ''}>${AU.oldBusy ? '불러오는 중…' : '이전 경매 보기'}</button>` : ''}
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
      <label class="fld"><span>입찰 시 최소 남은 시간(초)</span><input id="auE" class="inp" type="number" value="${AU.ext}" data-i="auF" data-k="ext"><small class="au-rec" id="au-rec">${recHTML()}</small></label>
      <label class="fld"><span>매물 사이 대기(초)</span><select id="auD" class="inp" data-c="auDelay">${[5, 10, 15].map((v) => `<option value="${v}" ${AU.delay === v ? 'selected' : ''}>${v}초</option>`).join('')}</select></label>` : ''}
    </div>
    ${AU.mode === 'live' ? `<p class="au-est" id="au-est">${estHTML(formEst())}</p>` : ''}
    ${AU.mode === 'live' ? `<label class="mini au-blindopt"><input type="checkbox" data-c="auBlind" ${AU.blind ? 'checked' : ''}> 🎭 익명 경매 <small class="mut">누구인지 숨기고 힌트(주라인·라인 점수 모양·최근 흐름·챔피언 성향·소통)만 보고 입찰 · 끝나면 한꺼번에 공개</small></label>` : ''}
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
    const N = { tick: [[1175, 0, 0.05]], start: [[784, 0, 0.09], [988, 0.09, 0.14]], outbid: [[330, 0, 0.12], [262, 0.13, 0.16]], sold: [[523, 0, 0.1], [659, 0.1, 0.18]], win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.28]] }[kind];
    const t0 = ACX.currentTime;
    for (const [f, at, d] of N) {
      const o = ACX.createOscillator(), g = ACX.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.12, t0 + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d);
      o.connect(g).connect(ACX.destination); o.start(t0 + at); o.stop(t0 + at + d + 0.02);
    }
  } catch {}
}
// 낙찰·유찰 순간 화면 가운데에 크게(1.8초, 누르는 것을 막지 않음). 화면 다시 그리기와 상관없이 body에 따로 붙인다
function banner(r, pid, ti, mine) {
  setTimeout(() => {
    if (S.page !== 'auction') return;
    document.querySelector('.au-banner')?.remove();
    const price = ti >= 0 ? r.teams[ti].members.find((m) => m.pid === pid)?.price ?? 0 : 0;
    const el = document.createElement('div');
    el.className = `au-banner${ti < 0 ? ' unsold' : ''}${mine ? ' mine' : ''}`; el.setAttribute('aria-live', 'polite');
    el.innerHTML = ti >= 0 ? `<small>🔨 ${mine ? '우리 팀 낙찰!' : '낙찰'}</small><b>${esc(whoT(r, pid))}</b><span>${tname(r, ti)} · <em class="mono">${price}P</em></span>`
      : `<small>유찰</small><b>${esc(whoT(r, pid))}</b><span>${r.round === 2 ? '예비로' : '재경매로'}</span>`;
    if (ti >= 0) el.style.setProperty('--tc', teamColor(ti));
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }, 0);
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
      if (ti >= 0) { AU.sold = { pid: AW.pid, team: ti, at: Date.now(), until: Date.now() + 2400 }; cue(ti === myT ? 'win' : 'sold'); banner(r, AW.pid, ti, ti === myT); }
    } else if (AW.pid && (!c || c.pid !== AW.pid) && n === AW.n && r.unsold.includes(AW.pid)) banner(r, AW.pid, -1, false);
  }
  AW = { id: r.id, pid: c?.pid || '', lead: c?.team ?? -1, n };
}
// 팀 카드 아래: 주라인 구성(없는 라인·겹친 라인)과 남은 자리당 평균 포인트. 팀장은 다음 매물 판단, 관전자는 '저 팀 미드 급하다' 보는 재미
function teamFoot(r, t) {
  const n = {}; [t.captain, ...t.members.map((m) => m.pid)].forEach((id) => { const l = S.st.P[id]?.mainLane; if (l) n[l] = (n[l] || 0) + 1; });
  const left = Math.max(0, r.cfg.size - 1 - t.members.length), miss = LANES.filter((l) => !n[l]);
  const lanes = `<div class="au-lanes">${LANES.map((l) => `<span class="${!n[l] ? 'no' : n[l] > 1 ? 'dup' : 'ok'}" title="${LANE_NAME[l]} 주라인 ${n[l] || 0}명">${LANE_ICON[l]}${n[l] > 1 ? `<b>${n[l]}</b>` : ''}</span>`).join('')}</div>`;
  const note = left ? `${miss.length ? `<span class="au-miss">${miss.map((l) => LANE_NAME[l]).join('·')} 없음</span>` : '<span class="au-full">주라인 다 있음</span>'}<span class="au-per">남은 ${left}자리 · 자리당 <b class="mono">${Math.floor(t.points / left)}P</b></span>`
    : `<span class="au-full">팀 완성</span>${miss.length ? `<span class="au-miss">${miss.map((l) => LANE_NAME[l]).join('·')} 주라인 없음</span>` : ''}`;
  return `<div class="au-tf">${lanes}<div class="au-tfn">${note}</div></div>`;
}
// 익명 경매가 끝나면 정체 공개: 매물 A부터 차례로 카드가 뒤집힌다(이 기기에서 처음 볼 때만 애니메이션)
const revealSeen = new Set();
function revealHTML(r) {
  const list = Object.entries(r.alias || {}).sort((a, b) => a[1].length - b[1].length || a[1].localeCompare(b[1]));
  const anim = !revealSeen.has(r.id); revealSeen.add(r.id);
  return `<div class="au-reveal${anim ? ' anim' : ''}"><div class="ph"><b>🎭 정체 공개</b><small class="mut">익명 경매 · 매물 ${list.length}명</small></div><div class="au-rv">${list.map(([pid, a], i) => {
    const ti = r.teams.findIndex((t) => t.members.some((m) => m.pid === pid)), m = ti >= 0 ? r.teams[ti].members.find((x) => x.pid === pid) : null;
    return `<div class="au-rvc" style="--i:${i}${ti >= 0 ? `;--tc:${teamColor(ti)}` : ''}"><small>매물 ${esc(a)}</small><b>${pname(pid)}</b><span>${ti >= 0 ? `${tname(r, ti)} · ${m.price ? m.price + 'P' : '자동 배정'}` : '예비'}</span></div>`;
  }).join('')}</div></div>`;
}
function roomView(id, token) {
  const r = room(id), st = S.st;
  if (!r || r.deleted || r.status === 'deleted') return `<div class="panel empty">이 경매 방은 삭제되어 더 이상 참여할 수 없습니다. <a href="#/auction">경매 목록으로</a></div>`;
  const me = myRole(r, token), c = r.cur; cues(r, me);
  const base = location.origin + location.pathname + location.search + '#/auction/' + r.id;
  const bidTeam = me.host ? Math.min(AU.as, r.teams.length - 1) : me.team;
  const info = (pid) => { const s = st.P[pid]; return s ? `<div class="item" data-k="info"><div class="ov big"><b>${s.ovr}</b><small>OVR</small></div><div><h1>${esc(s.name)}</h1><div class="mut">${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · ${esc(s.p.soloTier || '티어 정보 없음')} · ${s.g ? `내전 ${s.wr}% (${s.g}판)` : '내전 기록 없음'}</div>
      <div class="lanes5 sm">${LANES.map((l) => `<div class="${l === s.mainLane ? 'main' : ''}"><small>${LANE_ICON[l]}</small><b>${s.p.scores?.[l] ?? 0}</b></div>`).join('')}</div></div></div>` : ''; };
  // 진행 중 매물 한눈에(같이 보는 재미): OVR 순위·MMR, 최근 5경기·연승, 주라인 실전 승률, 모스트 챔피언, 칭호, 팀별 궁합(지금 팀원들과 같은 팀이었을 때 승률)
  const scout = (pid) => {
    const s = st.P[pid]; if (!s) return '';
    const ml = s.lanes?.[s.mainLane], champs = Object.entries(s.champs || {}).sort((a, b) => b[1].g - a[1].g).slice(0, 3);
    const chem = r.teams.map((t, i) => { let g = 0, w = 0; [t.captain, ...t.members.map((m) => m.pid)].forEach((o) => { const v = st.together[pid < o ? pid + '|' + o : o + '|' + pid]; if (v) { g += v.g; w += v.w; } }); return { i, t, g, w, wr: g ? Math.round((w / g) * 100) : null }; });
    const best = chem.filter((x) => x.g >= 3).sort((a, b) => b.wr - a.wr)[0];
    return `<div class="au-scout" data-k="scout">
      <div class="as-row"><span class="as-k">순위</span><b>OVR ${s.ovrRank}위</b><small>/ ${st.list.length}명 · MMR ${Math.round(s.mmr)}</small></div>
      <div class="as-row"><span class="as-k">최근</span>${s.g ? `${dots(s.recent)}${streak(s.cur)}` : '<small>내전 기록 없음</small>'}</div>
      <div class="as-row"><span class="as-k">${LANE_ICON[s.mainLane]}주라인</span>${ml?.g ? `<b>${Math.round((ml.w / ml.g) * 100)}%</b><small>${ml.g}판 실전</small>` : '<small>실전 기록 없음</small>'}</div>
      ${champs.length ? `<div class="as-row"><span class="as-k">모스트</span>${champs.map(([n, v]) => `<span class="as-ch" title="${esc(n)} ${v.g}판">${champIcon(n, 'sm')}</span>`).join('')}</div>` : ''}
      ${s.titles?.length ? `<div class="as-row as-tt">${titleChips(s, 2)}</div>` : ''}
      <div class="as-chem">${chem.map((x) => `<span class="${best && best.i === x.i ? 'best' : ''}" title="${esc(x.t.name)} 팀원들과 같은 팀일 때">${esc(x.t.name)} 궁합 <b>${x.wr === null ? '—' : x.wr + '%'}</b><small>${x.g ? x.g + '판' : '기록 없음'}</small></span>`).join('')}</div>
    </div>`;
  };
  // 익명 경매의 매물 카드: 이름·OVR·티어·챔피언·칭호·궁합 대신 힌트만
  const blindCard = (pid) => {
    const s = st.P[pid]; if (!s) return '';
    const lv = (v) => (v >= 15 ? [3, '강'] : v >= 10 ? [2, '중'] : [1, '약']), tk = talkOf(pid), cs = champStyle(s);
    return `<div class="item au-blind" data-k="info"><div class="ov big au-q"><b>?</b><small>익명</small></div><div class="au-bh"><h1>🎭 매물 ${esc(alias(r, pid))}</h1>
      <div class="as-row"><span class="as-k">주라인</span><b>${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]}</b></div>
      <div class="au-shape">${LANES.map((l) => { const [k, t] = lv(+s.p.scores?.[l] || 0); return `<span class="lv${k}${l === s.mainLane ? ' main' : ''}" title="${LANE_NAME[l]} ${t}"><i>${LANE_ICON[l]}</i><u><em></em></u><small>${t}</small></span>`; }).join('')}</div>
      <div class="as-row"><span class="as-k">최근</span>${s.g ? `${dots(s.recent)}${streak(s.cur)}` : '<small>내전 기록 없음</small>'}</div>
      <div class="as-row"><span class="as-k">성향</span>${cs || '<small>정보 없음</small>'}</div>
      <div class="as-row"><span class="as-k">소통</span>${tk ? `${talkIcon(tk)}` : '<small>정보 없음</small>'}</div></div></div>`;
  };
  const teams = r.teams.map((t, i) => `<div data-k="team${i}" class="panel ateam ${c && c.team === i ? 'lead' : ''} ${me.team === i ? 'mine' : ''}${AU.sold?.team === i && Date.now() < AU.sold.until ? ' au-win' : ''}" style="--tc:${teamColor(i)}${AU.sold?.team === i && Date.now() < AU.sold.until ? `;--t:-${Date.now() - AU.sold.at}ms` : ''}">
    <div class="ph"><b class="au-tname"><i class="au-dot"></i>${esc(t.name)}</b>${me.team === i ? '<span class="tag ok">내 팀</span>' : ''}${c?.pass?.[i] ? '<span class="tag au-ps">패스</span>' : ''}<span class="grow"></span><b class="pts">${t.points}P</b></div>
    <div class="kv"><span>${ic('crown')}${pname(t.captain)}</span><small class="mut">팀장</small></div>
    ${t.members.map((m) => `<div class="kv${m.pid === AU.sold?.pid && Date.now() < AU.sold.until ? ` au-sold" style="--t:-${Date.now() - AU.sold.at}ms` : ''}"><span>${who(r, m.pid)} <small class="mut">${LANE_ICON[st.P[m.pid]?.mainLane] || ''}</small></span><b>${m.price}P</b></div>`).join('')}
    ${Array(Math.max(0, r.cfg.size - 1 - t.members.length)).fill('<div class="kv emp"><span>빈 자리</span></div>').join('')}
    ${teamFoot(r, t)}</div>`).join('');
  let stage = '';
  if (r.status === 'lobby') {
    stage = `<div class="panel stage"><h2>대기 중</h2><p class="mut">팀장에게 각자의 링크를 보내고, 모두 들어오면 시작하세요.</p>
      ${r.cfg.blind ? '<p class="au-blindnote">🎭 <b>익명 경매</b> · 매물은 \'매물 A·B…\'로만 보이고 힌트만 공개돼요. 누구인지는 경매가 모두 끝나면 한꺼번에 공개!</p>' : ''}
      ${r.cfg.mode !== 'batch' ? `<p class="au-est">${estHTML(auEstimate(r.cfg, r.pool.length, r.teams.length))}<small class="au-rule">매물마다 대기 ${r.cfg.delay ?? 15}초 + 경매 ${r.cfg.sec}초 · 마감 ${r.cfg.ext}초 전에 입찰하면 ${r.cfg.ext}초로 연장</small></p>` : ''}
      ${me.host ? `<div class="links"><div class="kv"><span>${ic('eye')}관전 링크</span><span class="grow"></span><button class="btn xs" data-a="auCopy" data-u="${esc(base)}">복사</button><button class="btn xs" data-a="auSendLink" data-u="${esc(base)}" data-label="관전 링크">채팅 전송</button></div>
        <div class="au-online">${r.teams.map((t) => { const on = t.seen && S.store.serverNow() - t.seen < 90e3; return `<span class="au-on ${on ? 'on' : ''}"><i></i>${pname(t.captain)}<small>${on ? '접속 중' : t.seen ? '나감' : '아직 안 들어옴'}</small></span>`; }).join('')}</div>
        ${r.teams.map((t, i) => `<div class="kv"><span><i class="au-dot" style="--tc:${teamColor(i)}"></i>${ic('crown')}${pname(t.captain)} 팀장 링크</span><span class="grow"></span><button class="btn xs" data-a="auCopy" data-u="${esc(base + '/' + t.token)}">복사</button><button class="btn xs" data-a="auSendLink" data-u="${esc(base + '/' + t.token)}" data-label="${esc(nm(t.captain) + ' 팀장 링크')}">채팅 전송</button></div>`).join('')}</div>
        <button class="btn pri block big" data-a="auStart" data-id="${r.id}">▶ 경매 시작${r.teams.every((t) => t.seen && S.store.serverNow() - t.seen < 90e3) ? ' · 팀장 모두 접속' : ''}</button>` : `<p>${me.team >= 0 ? `${ic('crown')} <b>${esc(r.teams[me.team].name)}</b> 팀장으로 접속했습니다. 진행자가 시작하면 입찰할 수 있습니다.` : `${ic('eye')} 관전 중입니다.`}</p>`}</div>`;
  } else if (r.status === 'done') {
    stage = `<div class="panel stage"><h2>${ic('flag')}경매 완료</h2>${r.unsold.length ? `<p class="mut">예비: ${r.unsold.map(pname).join(', ')}</p>` : ''}
      ${(() => { const x = resultStats(r); return `<div class="au-stats">${x.top ? `<div><small>💰 최고가</small><b>${pname(x.top.pid)}</b><span>${tname(r, x.top.ti)} · ${x.top.price}P</span></div>` : ''}${x.value ? `<div><small>🍀 가성비</small><b>${pname(x.value.pid)}</b><span>OVR ${x.value.ovr} · ${x.value.price}P</span></div>` : ''}${x.teams.map((t, i) => `<div class="au-st" style="--tc:${teamColor(i)}"><small>${esc(t.name)}</small><b>평균 OVR ${t.avg}</b><span>사용 ${t.used}P · 남은 ${t.points}P</span></div>`).join('')}</div>`; })()}
      ${r.cfg.blind ? revealHTML(r) : ''}
      <button class="btn block" data-a="auResult" data-id="${r.id}">${ic('copy')}결과 복사 (단톡방에 붙여 넣기)</button>
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
      <div class="au-tbar"><i id="au-tbar"></i></div>
      <div class="au-off" hidden>${ic('alert')}연결이 끊겼어요 · 다시 연결될 때까지 입찰할 수 없어요</div>
      ${blindOn(r) ? blindCard(c.pid) : info(c.pid) + scout(c.pid)}
      <div data-k="bidnow" class="bidnow${lead ? ' lead' : ''}${bidBumped(c) ? ' bump' : ''}"${lead ? ` style="--tc:${teamColor(c.team)}"` : ''}><small>현재 입찰</small><b>${c.bid}P</b><span>${lead ? `${ic('crown')}${tname(r, c.team)}` : '입찰 없음'}</span></div>
      <div data-k="ladder" class="au-ladder">${(c.hist || []).slice(1).map((h) => `<span>${tname(r, h.t)} ${h.v}P</span>`).join('') || '<span class="mut">이 매물의 입찰 기록이 여기 쌓여요</span>'}</div>
      ${bidTeam >= 0 ? `<div data-k="bidbar" class="bidbar">
        ${me.host ? `<select class="inp" data-c="auAs">${r.teams.map((t, i) => `<option value="${i}" ${i === bidTeam ? 'selected' : ''}>${esc(t.name)} 대리 입찰</option>`).join('')}</select>` : ''}
        <div class="bids">${b(r.cfg.unit)}${b(r.cfg.unit * 5)}${b(r.cfg.unit * 10)}${(() => { const all = Math.floor(bt.points / r.cfg.unit) * r.cfg.unit; return `<button class="btn bid allin" data-a="auBid" data-id="${r.id}" data-v="all" ${can && all >= min ? '' : 'disabled'} title="남은 포인트를 모두 걸기">올인<small>${all}P</small></button>`; })()}</div>
        <div class="row"><input id="auAmt" class="inp grow" type="number" inputmode="numeric" placeholder="직접 입력 (${min}P 이상)" value="${esc(AU.amt)}" data-i="auAmt"><button class="btn pri" data-a="auBid" data-id="${r.id}" data-v="amt" ${can ? '' : 'disabled'}>입찰</button></div>
        <div class="row au-passrow"><p class="hint grow">${bt.members.length >= r.cfg.size - 1 ? '팀이 가득 찼습니다.' : c.team === bidTeam ? '현재 최고 입찰 팀입니다.' : `${esc(bt.name)} 잔여 ${bt.points}P`}</p>${can ? `<button class="btn ghost xs au-pass" data-a="auPass" data-id="${r.id}" ${c.pass?.[bidTeam] ? 'disabled' : ''} title="이 가격이면 안 사요 · 최고 입찰 팀 말고 모두 패스하면 바로 낙찰">${c.pass?.[bidTeam] ? '패스함' : '패스'}</button>` : ''}</div></div>` : `<p class="mut" data-k="spec">${ic('eye')} 관전 중 — 팀장 링크로 들어오면 입찰할 수 있습니다.</p>`}
      ${me.host ? `<div data-k="hostbar" class="row au-hostbar"><button class="btn" data-a="auPause" data-id="${r.id}">${r.status === 'paused' ? '▶ 재개' : '⏸ 일시정지'}</button>${r.status === 'running' && S.store.serverNow() < c.startsAt ? `<button class="btn" data-a="auNow" data-id="${r.id}">⏩ 바로 시작</button>` : ''}${r.undo ? `<button class="btn ghost" data-a="auUndo" data-id="${r.id}" title="직전 낙찰(유찰)을 취소하고 그 선수를 다시 경매">↩ 직전 낙찰 취소</button>` : ''}</div>` : ''}</div>`;
  }
  const queue = r.pool, hideUpcoming = r.cfg.hide && r.status !== 'done';
  const queueView = hideUpcoming ? `<span class="chip mut">매물 이름 비공개 · ${queue.length}명</span>` : queue.map((p) => `<span class="chip">${who(r, p)}</span>`).join('') || '<span class="chip mut">없음</span>';
  const unsoldView = hideUpcoming ? `<span class="chip mut">유찰 선수 이름 비공개 · ${r.unsold.length}명</span>` : r.unsold.map((p) => `<span class="chip mut">${who(r, p)}</span>`).join('');
  const canDelete = true; // 진행자는 바로, 그 외에는 관리자 PIN 확인 후(완료된 지난 방도)
  return `<div class="h2row" data-k="head"><a class="btn xs" href="#/auction">← 목록</a><h1>${ic('auction')}${esc(r.name)}</h1><span class="grow"></span><button class="btn xs ghost" data-a="auMute" title="입찰 밀림·낙찰 효과음과 진동">${ic(AU.mute ? 'mute' : 'sound')}</button>${me.host ? '<span class="tag ok">진행자</span>' : ''}${canDelete ? `<button class="btn xs ghost" data-a="auDel" data-id="${r.id}">${me.host ? '방 삭제' : '관리자 삭제'}</button>` : ''}</div>
  <div class="agrid"><div>${stage}
    <div class="panel" data-k="queue"><div class="ph"><b>대기 매물 ${r.pool.length}</b><small class="mut">${hideUpcoming ? '다음 매물 비공개' : '경매 순서 공개'}</small></div><div class="chips">${queueView}</div>
      ${r.unsold.length ? `<div class="ph"><b>유찰 ${r.unsold.length}</b></div><div class="chips">${unsoldView}</div>` : ''}</div>
    <div class="panel"><div class="ph"><b>${ic('chat')}채팅 · 기록</b></div>
      <div class="chat" id="au-chat" data-k="chat"></div>
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
  if (r.status === 'lobby') { // 대기실: 팀장은 1분마다 '접속 중' 표시를 남기고(시작하면 멈춤), 진행자 화면은 20초마다 표시를 새로 그린다
    const me = myRole(r, S.arg[1]);
    if (me.team >= 0 && document.visibilityState === 'visible' && Date.now() - (AU.seenAt || 0) > 60e3) {
      AU.seenAt = Date.now(); const ti = me.team;
      tx(r.id, (x, t) => (x.status === 'lobby' && x.teams[ti] ? ((x.teams[ti].seen = t), x) : null));
    }
    if (me.host && Date.now() - (AU.lobbyAt || 0) > 20e3) { AU.lobbyAt = Date.now(); refresh(); }
    return;
  }
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
  // 시계는 5분마다 다시 맞추는데, 그 순간의 입찰이 기다리지 않게 경매 화면에서는 4분마다 미리(뒤에서) 맞춘다
  if (Date.now() - (AU.clk || 0) > 4 * 60e3 && document.visibilityState === 'visible') { AU.clk = Date.now(); Promise.resolve(S.store.syncServerClock?.(true)).catch(() => {}); }
  const off = navigator.onLine === false, ob = document.querySelector('.au-off');
  if (ob && ob.hidden === off) { ob.hidden = !off; document.querySelector('.bidbar')?.classList.toggle('offline', off); }
  // 남은 시간 막대: 새로 그려진 막대는 애니메이션 없이 바로 그 자리로(처음부터 줄어드는 모습이 보이지 않게), 그 뒤로는 0.25초씩 부드럽게
  const tb = document.getElementById('au-tbar'), setBar = (f, k) => {
    if (!tb) return; const box = tb.parentNode, fresh = !box.dataset.s;
    if (fresh) tb.style.transition = 'none';
    tb.style.transform = `scaleX(${Math.max(0, Math.min(1, f)).toFixed(4)})`;
    if (box.dataset.s !== k) { box.dataset.s = k; box.className = 'au-tbar ' + k; }
    if (fresh) { void tb.offsetWidth; tb.style.transition = ''; }
  };
  if (r.status === 'paused') { el.textContent = `⏸ ${Math.ceil((c.left || 0) / 1000)}초`; setBar((c.wait ? c.wait / lotDelay(r) : (c.left || 0) / (r.cfg.sec * 1000)), c.wait ? 'wait paused' : 'paused'); return; }
  const waiting = now < c.startsAt, bar = document.querySelector('.bidbar');
  if (bar && bar.classList.contains('wait') !== waiting) bar.classList.toggle('wait', waiting); // 대기 중엔 입찰 버튼을 흐리게(누르면 '아직 시작 전' 안내)
  if (!waiting) document.querySelector('[data-a=auNow]')?.remove(); // 시작되면 '바로 시작' 버튼은 치운다
  if (waiting) AU.waitPid = c.pid;
  else if (AU.waitPid === c.pid && r.status === 'running') { // 대기 → 입찰 시작 순간: 자리가 남은 팀장에게 짧은 알림음 한 번
    AU.waitPid = '';
    const me = myRole(r, S.arg[1]); if (me.team >= 0 && r.teams[me.team].members.length < r.cfg.size - 1) cue('start');
  }
  if (waiting) { el.textContent = `곧 시작 ${Math.ceil((c.startsAt - now) / 1000)}`; el.className = 'timer'; setBar((c.startsAt - now) / lotDelay(r), 'wait'); return; }
  const left = c.endsAt - now;
  setBar(left / (r.cfg.sec * 1000), left > 0 && left < 5000 ? 'hot' : 'run'); // 연장되면 막대가 다시 차오른다
  el.textContent = left > 0 ? `⏱ ${Math.ceil(left / 1000)}초` : '낙찰 처리 중…';
  const hot = left > 0 && left < 5000;
  if (el.classList.contains('hot') !== hot) { el.classList.toggle('hot', hot); el.closest('.stage')?.classList.toggle('hot', hot); } // 마감 5초 전: 타이머·경매판 빨간 맥동
  const me = myRole(r, S.arg[1]);
  const sec = Math.ceil(left / 1000), tk = c.pid + ':' + sec + ':' + c.endsAt;
  if (me.team >= 0 && r.status === 'running' && left > 0 && sec <= 3 && AU.tk !== tk && r.teams[me.team].members.length < r.cfg.size - 1) { AU.tk = tk; cue('tick'); } // 마감 3·2·1 (연장되면 다시)
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
  if (!/^#\/auction(\/|$)/.test(location.hash)) auOff = setTimeout(() => { if (S.page !== 'auction') { S.store?.unneed?.('auctions'); Object.keys(docWait).forEach((k) => delete docWait[k]); } }, 60e3);
});
// 방 화면인데 최근 구독(14일)에 없는 오래된 방이면 그 방 문서 하나만 받아 온다(받는 동안은 '불러오는 중')
const docWait = {};
const auReady = (id) => {
  if (S.store.loaded?.('auctions') === false) { S.store.need('auctions').then(() => { if (S.page === 'auction') refresh(); }); return false; }
  if (!id || room(id) || !S.store.needDoc || docWait[id] === 'done') return true;
  if (!docWait[id]) docWait[id] = S.store.needDoc('auctions', id).then(() => { docWait[id] = 'done'; if (S.page === 'auction') refresh(); });
  return false;
};
act('auOld', async () => { AU.oldBusy = true; refresh(); await S.store.need('auctions', true); AU.oldBusy = false; if (S.page === 'auction') refresh(); });
page('auction', {
  keyed: true, // 입찰마다 바뀐 구역만 다시 그림(core.js keyedRender)
  render: (id, token) => (!auReady(id) ? `<h1>${ic('auction')}팀 경매</h1><div class="panel empty">경매 방을 불러오는 중…</div>` : id ? roomView(id, token) : lobbyList()),
  after() {
    if (!S.arg[0] || S.store.loaded?.('auctions') === false) return; // 경매 기록을 다 받은 뒤에 타이머를 돌린다
    if (!timer) timer = setInterval(tick, 250);
    tick();
    // 채팅·기록: 맨 아래를 보고 있었을 때만 새 기록을 따라 내려간다(위로 올려 읽는 중이면 그 자리 유지)
    // 화면을 다시 그려도 기록 칸은 그대로 두고 새 줄만 덧붙인다(입찰마다 60줄을 다시 배치하지 않게)
    const ch = document.getElementById('au-chat'), r = room(S.arg[0]);
    if (ch && r) {
      if (AU.chatRoom !== S.arg[0]) { AU.chatRoom = S.arg[0]; AU.chatPin = true; }
      const list = [...(r.log || []).map((x) => ({ ...x, sys: 1 })), ...(r.chat || [])].sort((a, b) => a.t - b.t).slice(-60);
      const key = (x) => `${x.t}|${x.w || ''}|${x.s}`, line = (x) => (x.sys ? `<div class="sys">${esc(x.s)}</div>` : `<div><b>${esc(x.w)}</b> ${esc(x.s)}</div>`);
      const at = ch._last ? list.findIndex((x) => key(x) === ch._last) : -1;
      if (ch._last && at < 0 && list.length) ch._last = null; // 이어 붙일 자리를 못 찾으면 처음부터
      const fresh = !ch._last;
      if (fresh) ch.innerHTML = list.map(line).join('') || '<div class="sys empty-note">아직 기록이 없습니다.</div>';
      else if (at < list.length - 1) { ch.querySelector('.sys.empty-note')?.remove(); ch.insertAdjacentHTML('beforeend', list.slice(at + 1).map(line).join('')); while (ch.children.length > 60) ch.firstElementChild.remove(); }
      if (list.length) ch._last = key(list[list.length - 1]);
      if (fresh || at < list.length - 1) requestAnimationFrame(() => { ch.scrollTop = AU.chatPin ? ch.scrollHeight : AU.chatTop || 0; }); // 배치 계산은 다음 그림 때 한 번에
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
act('auF', (d, el) => {
  AU[d.k] = d.k === 'name' ? el.value : Math.max(0, +el.value || 0);
  if (d.k === 'ext') AU.extTouched = true;
  if (d.k === 'sec' && !AU.extTouched) { AU.ext = recExt(AU.sec); const e = document.getElementById('auE'); if (e) e.value = AU.ext; } // 연장을 직접 고치기 전에는 경매 시간에 맞춰 따라감
  if (d.k !== 'name') formLive();
});
act('auExtRec', () => { AU.ext = recExt(AU.sec); AU.extTouched = false; const e = document.getElementById('auE'); if (e) e.value = AU.ext; formLive(); });
act('auHc', (d, el) => { AU.hcap[d.id] = +el.value || 0; });
act('auHide', (d, el) => { AU.hide = el.checked; });
act('auBlind', (d, el) => { AU.blind = el.checked; });
act('auDelay', (d, el) => { AU.delay = +el.value || 15; formLive(); });
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
  if (AU.mode === 'live' && AU.ext < 1) return toast('입찰 시 최소 남은 시간은 1초 이상이어야 합니다');
  for (let i = parts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [parts[i], parts[j]] = [parts[j], parts[i]]; }
  const id = uid(), host = tok();
  const r = {
    id, name: AU.name.trim() || `${dayKey(Date.now()).slice(5)} 경매`, createdAt: Date.now(), status: 'lobby', host,
    cfg: { points: AU.points, unit: AU.unit, sec: AU.sec, ext: AU.ext, delay: AU.delay, size: 5, hide: AU.hide, mode: AU.mode, ...(AU.mode === 'live' && AU.blind ? { blind: true } : {}) },
    teams: caps.map((pid) => ({ name: nm(pid) + ' 팀', captain: pid, token: tok(), points: Math.max(0, AU.points - (AU.hcap[pid] || 0)), members: [] })),
    pool: parts, unsold: [], round: 1, cur: null, log: [], chat: [],
    ...(AU.mode === 'live' && AU.blind ? { alias: Object.fromEntries(parts.map((p, i) => [p, letter(i)])) } : {}), // 매물 A·B…(경매 순서와 같음)
  };
  await S.store.put('auctions', id, r);
  localStorage.setItem(hostKey(id), host);
  AU.role = {}; AU.name = ''; AU.mode = 'live'; AU.blind = false; AU.as = 0; AU.batchDraft = {}; AU.extTouched = false;
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
  if (r.status === 'running') { r.status = 'paused'; r.cur.left = Math.max(1000, r.cur.endsAt - (now - err)); r.cur.wait = Math.max(0, r.cur.startsAt - (now - err)); } // 대기 카운트다운 중이면 남은 대기도 기억
  else if (r.status === 'paused') { r.status = 'running'; const w = r.cur.wait || 0; r.cur.endsAt = now + err + r.cur.left; r.cur.startsAt = w ? now + err + w : Math.min(r.cur.startsAt, now); delete r.cur.wait; } // 재개하면 남은 대기부터 이어서
  return r;
}));
act('auBid', async (d) => {
  const r0 = room(d.id); if (!r0?.cur) return;
  const me = myRole(r0, S.arg[1]), ti = me.host ? Math.min(AU.as, r0.teams.length - 1) : me.team, pid = r0.cur.pid;
  const v = d.v === 'amt' ? Math.floor(+AU.amt) : d.v === 'all' ? Math.floor((r0.teams[ti]?.points || 0) / r0.cfg.unit) * r0.cfg.unit : +d.v;
  if (d.v === 'all' && v >= r0.cur.bid + r0.cfg.unit && !confirm(`남은 포인트 ${v}P를 모두 걸까요?`)) return;
  if (!v || v < r0.cur.bid + r0.cfg.unit) return toast(r0.cur.team >= 0 && d.v !== 'amt' ? `${r0.teams[r0.cur.team]?.name || '다른 팀'}이 먼저 ${r0.cur.bid}P를 불렀어요 · 다음 최소 ${r0.cur.bid + r0.cfg.unit}P` : `${r0.cur.bid + r0.cfg.unit}P 이상 입찰해야 합니다`);
  if (r0.cur.team === ti) return toast('이미 우리 팀이 최고 입찰이에요');
  if (v % r0.cfg.unit) return toast(`입찰 단위는 ${r0.cfg.unit}P입니다`);
  if (v > r0.teams[ti].points) return toast('포인트가 부족합니다');
  if (AU.pending) return; // 응답을 기다리는 동안 다시 누르지 않게
  AU.pending = true; const btn = document.activeElement?.closest?.('.bidbar button') || [...document.querySelectorAll('.bidbar [data-a=auBid]')].find((b) => b.dataset.v === d.v);
  document.querySelector('.bidbar')?.classList.add('pending'); if (btn) btn.classList.add('sending');
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
    c.hist = [{ t: ti, v }, ...(c.hist || [])].slice(0, 4); c.pass = {}; // 이 매물의 최근 입찰(경쟁 보기) · 값이 올랐으니 패스는 다시
    say(r, `${t.name} ${v}P`);
    return r;
  });
  AU.pending = false; document.querySelector('.bidbar')?.classList.remove('pending'); document.querySelectorAll('.bidbar .sending').forEach((b) => b.classList.remove('sending'));
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
    say(r, `↩ 진행자가 직전 낙찰을 취소했어요 · ${whoT(r, u.pid)} 다시 경매`);
    return r;
  }).then((ok) => ok && toast('직전 낙찰을 취소했어요'));
});
// 진행자: 매물 사이 대기 건너뛰고 바로 입찰 시작
act('auNow', (d) => tx(d.id, (r, now, err) => {
  const c = r.cur; if (r.status !== 'running' || !c || now - err >= c.startsAt) return null;
  const at = now + err; c.endsAt = at + r.cfg.sec * 1000; c.startsAt = at; return r;
}));
// 경매 결과를 글로 복사: 팀별 팀장·선수·낙찰가·남은 포인트(카톡·디스코드에 그대로 붙여 넣을 수 있게)
// 결과 한눈에: 최고가 선수, 가성비 선수(OVR ÷ (낙찰가 + 입찰 단위 5번), 낙찰가 있는 선수 중), 팀별 평균 OVR(팀장 포함)·사용 포인트
export function resultStats(r) {
  const ovr = (id) => S.st.P[id]?.ovr || 0, bought = r.teams.flatMap((t, ti) => t.members.filter((m) => m.price > 0).map((m) => ({ ...m, ti, ovr: ovr(m.pid) })));
  const top = [...bought].sort((a, b) => b.price - a.price)[0] || null;
  const value = bought.length > 1 ? [...bought].sort((a, b) => b.ovr / (b.price + r.cfg.unit * 5) - a.ovr / (a.price + r.cfg.unit * 5))[0] : null;
  const teams = r.teams.map((t) => { const ids = [t.captain, ...t.members.map((m) => m.pid)]; return { name: t.name, points: t.points, used: t.members.reduce((a, m) => a + (m.price || 0), 0), avg: Math.round(ids.reduce((a, id) => a + ovr(id), 0) / ids.length) }; });
  return { top, value: value && value.pid !== top?.pid ? value : null, teams };
}
export function resultText(r) {
  const L = [`🏆 ${/경매$/.test(r.name) ? r.name : r.name + ' 경매'} 결과`], x = resultStats(r);
  r.teams.forEach((t) => {
    const used = t.members.reduce((a, m) => a + (m.price || 0), 0);
    L.push('', `[${t.name}] 사용 ${used}P · 남은 ${t.points}P`, `👑 ${nm(t.captain)} (팀장)`, ...t.members.map((m) => `· ${nm(m.pid)} ${m.price ? m.price + 'P' : '(자동 배정)'}`));
  });
  if (r.unsold.length) L.push('', `예비: ${r.unsold.map(nm).join(', ')}`);
  if (x.top || x.value) L.push('', ...(x.top ? [`💰 최고가: ${nm(x.top.pid)} (${r.teams[x.top.ti].name}) ${x.top.price}P`] : []), ...(x.value ? [`🍀 가성비: ${nm(x.value.pid)} (${r.teams[x.value.ti].name}) ${x.value.price}P · OVR ${x.value.ovr}`] : []));
  L.push('', x.teams.map((t) => `${t.name} 평균 OVR ${t.avg}`).join(' / '));
  return L.join('\n');
}
act('auResult', async (d) => {
  const r = room(d.id); if (!r) return; const t = resultText(r);
  try { await navigator.clipboard.writeText(t); toast('경매 결과를 복사했어요'); } catch { prompt('아래 내용을 복사하세요', t); }
});
// 팀장 패스: 지금 가격으로는 이 선수를 안 사겠다는 표시. 최고 입찰 팀을 뺀 자리 남은 팀이 모두 패스하면 바로 낙찰(입찰 없으면 유찰).
// 누가 더 부르면 패스는 모두 풀린다(값이 바뀌었으니 다시 판단)
act('auPass', (d) => {
  const r0 = room(d.id); if (!r0?.cur) return;
  const me = myRole(r0, S.arg[1]), ti = me.host ? Math.min(AU.as, r0.teams.length - 1) : me.team; if (ti < 0) return;
  const pid = r0.cur.pid;
  tx(d.id, (r, now, err) => {
    const c = r.cur; if (r.status !== 'running' || !c || c.pid !== pid || now + err < c.startsAt || passed(now, err, c.endsAt) || c.team === ti || c.pass?.[ti]) return null;
    c.pass = { ...(c.pass || {}), [ti]: true }; say(r, `${r.teams[ti].name} 패스`);
    const rest = openTeams(r).filter((i) => i !== c.team);
    if (rest.every((i) => c.pass[i])) { say(r, c.team >= 0 ? '모두 패스 · 바로 낙찰' : '모두 패스 · 유찰'); return settle(r, now + err); }
    return r;
  });
});
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
    if (!confirm(current.status === 'done' ? '이 경매 방을 목록에서 삭제할까요? (기록은 DB에 남아 복구할 수 있어요)' : '이 경매 방을 삭제할까요? 진행 중인 경매는 모든 참가자에게 즉시 종료됩니다.')) return;
    tx(d.id, (r) => {
      if (!me.host && !isAdmin()) return null;
      r.deleted = true; r.status = 'deleted'; r.cur = null;
      say(r, '경매 방이 삭제되어 진행이 종료되었습니다.');
      return r;
    }).then((ok) => { if (ok) go('#/auction'); else toast('경매 방을 삭제하지 못했습니다'); });
  };
  if (me.host) remove(); else needAdmin(remove);
});
