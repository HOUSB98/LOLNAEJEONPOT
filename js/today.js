// 오늘의 내전: 라인업 보드(점수·예상승률·해설) + 경기 결과 입력/수정
import { S, page, act, esc, uid, pname, go, refresh, ddMenu, champIcon, artUrl, toast, pickChamp, pickPlayer, history, ic, dots, burst, LANES, LANE_NAME, LANE_ICON, pct } from './core.js';
import { evalLineup, commentary, bestDuo, aiBalance } from './stats.js';
import { notify, hookOn } from './hook.js';
import { seriesUsed, matchCard } from './app.js';
import { sysChat, nick, cid } from './social.js';
import { boardLive } from './board.js';

const five = () => ['', '', '', '', ''];
const blank = () => ({ blue: five(), red: five(), winner: '', champs: { blue: five(), red: five() }, bans: { blue: five(), red: five() }, kda: {}, newSeries: false, at: '', more: false });
const remoteDraft = () => S.store?.data?.meta?.todayDraft || null;
let draftUpdatedAt = 0;
let draftBase = null;

function draftState(d) {
  return JSON.stringify({
    blue: d.blue, red: d.red, winner: d.winner || '',
    champs: d.champs, bans: d.bans, kda: d.kda || {},
    newSeries: !!d.newSeries, at: d.at || '', more: !!d.more
  });
}

const cloneDraft = (d) => JSON.parse(JSON.stringify(d));

function mergeDraftChanges(base, local, remote) {
  const next = cloneDraft(remote || blank());
  const arr = (key, side) => {
    const b = base?.[key]?.[side] || five();
    const l = local?.[key]?.[side] || five();
    const r = remote?.[key]?.[side] || five();
    next[key] ||= {};
    next[key][side] = r.map((v, i) => (l[i] !== b[i] ? l[i] : v));
  };
  ['blue', 'red'].forEach((side) => {
    const b = base?.[side] || five(), l = local?.[side] || five(), r = remote?.[side] || five();
    next[side] = r.map((v, i) => (l[i] !== b[i] ? l[i] : v));
    arr('champs', side);
    arr('bans', side);
  });

  const scalars = ['winner', 'newSeries', 'at', 'more'];
  scalars.forEach((k) => {
    const b = base?.[k], l = local?.[k], r = remote?.[k];
    if (l !== b) next[k] = l;
    else next[k] = r;
  });

  next.kda = { ...(remote?.kda || {}) };
  const keys = new Set([...Object.keys(base?.kda || {}), ...Object.keys(local?.kda || {}), ...Object.keys(remote?.kda || {})]);
  keys.forEach((k) => {
    if ((local?.kda || {})[k] !== (base?.kda || {})[k]) next.kda[k] = (local?.kda || {})[k] || '';
  });
  next.updatedAt = Date.now();
  return next;
}

// 라인업 초안 동기화(meta/todayDraft). 연속 입력은 한 번으로 묶고(120ms), 전송은 한 번에 하나만 보낸다.
// 보내는 동안 또 바뀌면 끝난 뒤 최신 상태로 한 번 더 보낸다. 다른 사람의 변경과는 칸 단위로 합친다(mergeDraftChanges).
let syncTimer = 0, syncBusy = false, syncAgain = false, appliedAt = -1;
function syncDraft() {
  if (edit || S.store?.mode !== 'firebase' || !draft) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(pushDraft, 120);
}
async function pushDraft() {
  syncTimer = 0;
  if (syncBusy) { syncAgain = true; return; }
  if (edit || !draft) return;
  syncBusy = true;
  const local = cloneDraft(draft), base = cloneDraft(draftBase || remoteDraft() || blank());
  try {
    const merged = await S.store.tx('meta', 'todayDraft', (remote) => mergeDraftChanges(base, local, remote || blank()));
    if (merged) {
      const changedMeanwhile = draftState(draft) !== draftState(local); // 전송 중에 내가 또 고쳤으면 그 내용은 다음 전송에서 합친다
      draftBase = cloneDraft(merged); appliedAt = Number(merged.updatedAt) || 0;
      if (!changedMeanwhile) {
        const same = draftState(merged) === draftState(draft);
        draft = merged; draftUpdatedAt = appliedAt || Date.now();
        localStorage.setItem(dkey(), JSON.stringify(draft));
        if (!same) refresh();
      } else syncAgain = true;
    }
  } catch (e) {
    toast('팀 동기화 실패: ' + (e.code || e.message));
  }
  syncBusy = false;
  if (syncAgain) { syncAgain = false; pushDraft(); }
}

function applyRemoteDraft() {
  if (edit || S.store?.mode !== 'firebase') return;
  const r = remoteDraft();
  if (!r) return;
  const at = Number(r.updatedAt) || 0;
  if (draft && at === appliedAt) return; // 이미 반영한 버전: 화면을 그릴 때마다 다시 비교하지 않는다
  if (syncBusy) return; // 내 변경을 보내는 중이면 응답에서 합쳐진다
  appliedAt = at;
  const pad = (a) => [...(a || []), '', '', '', '', ''].slice(0, 5);
  const remote = {
    ...blank(), ...r, blue: pad(r.blue), red: pad(r.red),
    champs: { blue: pad(r.champs?.blue), red: pad(r.champs?.red) }, bans: { blue: pad(r.bans?.blue), red: pad(r.bans?.red) }, kda: { ...(r.kda || {}) },
  };
  if (!draft || draftState(remote) !== draftState(draft)) {
    // 아직 보내지 않은 내 변경이 있으면 원격 내용 위에 내 변경을 얹는다
    draft = draft && draftBase && syncTimer && draftState(draft) !== draftState(draftBase) ? mergeDraftChanges(draftBase, draft, remote) : remote;
    draftUpdatedAt = at || Date.now();
    localStorage.setItem(dkey(), JSON.stringify(draft));
  }
  draftBase = cloneDraft(remote);
}
const dkey = () => 'naejeon:draft:' + S.key;
let draft = null, edit = null, lastSaved = null;
const isFull = (d) => { const all = [...d.blue, ...d.red]; return all.every(Boolean) && new Set(all).size === 10; };
function D() {
  if (S.page === 'today' && S.arg[0] === 'edit') {
    const m = S.store.data.matches[S.arg[1]];
    if (m && edit?.id !== m.id) edit = { ...blank(), ...JSON.parse(JSON.stringify(m)), champs: { blue: five(), red: five(), ...m.champs }, bans: { blue: [...(m.bans?.blue || []), ...five()].slice(0, 5), red: [...(m.bans?.red || []), ...five()].slice(0, 5) }, kda: Object.fromEntries(Object.entries(m.kda || {}).map(([k, v]) => [k, v.join('/')])), at: toLocal(m.at), more: true };
    if (m) return edit;
  }
  edit = null;
  if (!draft) {
    try {
      const local = JSON.parse(localStorage.getItem(dkey()));
      draft = { ...blank(), ...(local || {}) };
      draftUpdatedAt = Number(local?.updatedAt) || 0;
    } catch {
      draft = blank();
      draftUpdatedAt = 0;
    }
  }
  applyRemoteDraft();
  return draft;
}
const keep = () => {
  if (!edit) {
    draftUpdatedAt = Date.now();
    draft.updatedAt = draftUpdatedAt;
    localStorage.setItem(dkey(), JSON.stringify(draft));
    syncDraft();
  }
  refresh();
};
const toLocal = (at) => { const d = new Date(at - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
export function setDraftTeams(blue, red) {
  D(); draft = { ...blank(), blue: [...blue, ...five()].slice(0, 5), red: [...red, ...five()].slice(0, 5) };
  draftUpdatedAt = Date.now(); draft.updatedAt = draftUpdatedAt;
  localStorage.setItem(dkey(), JSON.stringify(draft)); syncDraft();
}
// 리플레이 분석 결과를 입력 화면에 채운다(저장은 사용자가 확인 후 직접)
export function importDraft(x) {
  D(); draft = { ...blank(), ...x, more: true };
  localStorage.setItem(dkey(), JSON.stringify(draft));
}
// 주사위 결과 반영: 해당 라인의 블루/레드 자리에 두 사람을 넣는다
export function assignLane(i, blueId, redId) {
  const d = D();
  for (const s of ['blue', 'red']) d[s] = d[s].map((id) => (id === blueId || id === redId ? '' : id));
  d.blue[i] = blueId; d.red[i] = redId; keep();
}
export const placedIds = () => { const d = D(); return [...d.blue, ...d.red].filter(Boolean); };
const sameRoster = (m, d) => { const k = (a) => [...a].sort().join(); const a = k(m.blue), b = k(m.red), x = k(d.blue), y = k(d.red); return (a === x && b === y) || (a === y && b === x); };
function seriesFor(d) {
  if (edit) return edit.seriesId || edit.id;
  const last = S.st.matches[S.st.matches.length - 1];
  const at = d.at ? new Date(d.at).getTime() : Date.now();
  if (!d.newSeries && last && d.blue.every(Boolean) && d.red.every(Boolean) && sameRoster(last, d) && Math.abs(at - last.at) < 8 * 3600e3) return last.seriesId || last.id;
  return null;
}

page('today', {
  render() {
    const d = D(), st = S.st, ev = evalLineup(d.blue, d.red, st);
    const sid = seriesFor(d), sr = sid && st.series.find((s) => s.id === sid);
    const any = d.blue.some(Boolean) || d.red.some(Boolean), pb = any ? Math.round(ev.pBlue * 100) : 50;
    const filled = [...d.blue, ...d.red].filter(Boolean).length;
    const full = isFull(d);
    const slot = (side, i) => {
      const id = d[side][i], l = LANES[i], s = st.P[id];
      const ch = d.champs[side][i], art = ch && artUrl(ch) ? ` art" style="--img:url('${artUrl(ch)}')` : '';
      const champ = `<button class="sl-champ" data-a="tChamp" data-s="${side}" data-i="${i}" title="챔피언 선택 (선택 사항)">${ch ? champIcon(ch) : `<span class="ci plus">${ic('plus')}</span>`}</button>`;
      if (!s) return `<div class="slot ${side} emp${art}" data-ds="${side}" data-di="${i}">${champ}<button class="sl-body" data-a="tSlot" data-s="${side}" data-i="${i}"><span>${ic('plus')}${LANE_NAME[l]}<em class="m-hide"> 선수 선택</em></span></button></div>`;
      const ln = s.lanes[l], off = s.mainLane !== l;
      return `<div class="slot ${side}${art}" data-ds="${side}" data-di="${i}">${champ}<button class="sl-body" data-a="tSlot" data-s="${side}" data-i="${i}">
        <span class="sl-top"><b>${esc(s.name)}</b>${off ? `<i class="off" title="주라인은 ${LANE_NAME[s.mainLane]}">${LANE_ICON[s.mainLane]}오프</i>` : '<i class="main">주라인</i>'}</span>
        <span class="sl-meta"><span>${LANE_NAME[l]} ${ln.g ? `${pct(ln.w, ln.g)}% · ${ln.g}판` : '기록 없음'}</span><span class="mono">MMR ${Math.round(s.mmr)}</span>${dots(s.recent)}</span>
      </button><span class="sl-score mono">${(+s.p.scores?.[l] || 0).toFixed(1)}</span></div>`;
    };
    const duo = (side) => { const b = bestDuo(d[side], st); return b ? `<span class="${side}">${pname(b.a)} + ${pname(b.b)} <b class="mono">${pct(b.w, b.g)}%</b> <small>${b.g}판</small></span>` : `<span class="mut">${side === 'blue' ? '블루' : '레드'} — 함께한 기록 부족</span>`; };
    return `<div class="h2row td-h"><h1>${ic('today')}${edit ? `경기 수정 <span class="mono">#${st.MI[edit.id]?.no ?? ''}</span>` : '오늘의 내전'}</h1><span class="tag ${full ? 'ok' : ''}">${filled}/10 배치</span><span class="grow"></span>
      ${edit ? '<a class="btn" href="#/matches">취소</a>' : `${hookOn() ? liveBtn(full) : ''}<button class="btn gold" data-a="tAi" ${full ? '' : 'disabled'} title="${full ? '라인은 그대로 두고, 점수 차이가 가장 작아지도록 블루·레드를 나눕니다 (높은 원딜·높은 서폿은 같은 팀 안 됨)' : '10명을 모두 배치하면 쓸 수 있어요'}">${ic('bolt')}AI<span class="m-hide"> 추천</span></button><button class="btn gold gbtn ${boardLive() ? 'bd-on' : ''}" data-a="tBoard" title="라인 지원: 모두 함께 원하는 라인 고르기 → 몰린 라인은 추첨">${ic('users')}<span><span class="n-hide">라인 </span>${boardLive() ? '지원 중' : '지원'}</span></button><button class="btn gold" data-a="tDice">${ic('dice')}<span class="n-hide">라인 </span>주사위</button>${ddMenu(`<button data-a="tSwap">${ic('swap')}진영 교체</button><button class="danger" data-a="tClear">${ic('trash')}비우기</button>`)}`}</div>
    <section class="arena">
      <div class="scorebar"><div class="sb blue"><small>BLUE TEAM</small><b class="mono">${ev.bs.toFixed(1)}</b><span>평균 MMR ${ev.mmrB ? Math.round(ev.mmrB) : '—'}</span></div>
        <div class="sb-mid">${winRing(pb, full, any, filled)}</div>
        <div class="sb red"><small>RED TEAM</small><b class="mono">${ev.rs.toFixed(1)}</b><span>평균 MMR ${ev.mmrR ? Math.round(ev.mmrR) : '—'}</span></div></div>
      <div class="prob"><i style="width:${pb}%"></i></div>
      ${ev.lanes.map((x, i) => { const g = x.bs - x.rs, both = x.b && x.r; return `<div class="lrow" style="--d:${i}">${slot('blue', i)}
        <div class="lmid">${LANE_ICON[x.lane]}<small class="${both ? (g > 0 ? 'blue' : g < 0 ? 'red' : '') : ''} mono">${both ? (g === 0 ? 'EVEN' : (g > 0 ? '◀ ' : '') + Math.abs(g).toFixed(1) + (g < 0 ? ' ▶' : '')) : LANE_NAME[x.lane]}</small></div>
        ${slot('red', i)}</div>`; }).join('')}
      <div class="talk">${ic('mega')}<p>${esc(commentary(ev, st).replace('🎙️ ', ''))}</p></div>
      <div class="syn"><small>SYNERGY</small>${duo('blue')}<i>VS</i>${duo('red')}</div>
    </section>

    <div class="sec-h"><h2>${ic('rank')}경기 결과 기록</h2>${edit ? '' : sr ? `<span class="tag ok">시리즈 ${sr.ms.length + 1}번째 판</span><span class="mut sm">피어리스: 사용된 챔피언 ${Object.keys(seriesUsed(sid)).length}개 잠김</span><label class="mini"><input type="checkbox" data-c="tNew" ${d.newSeries ? 'checked' : ''}> 새 시리즈로 시작</label>` : '<span class="tag">새 시리즈 1번째 판</span>'}</div>
    <div class="panel">
      <div class="winrow"><button class="wbtn blue ${d.winner === 'blue' ? 'on' : ''}" data-a="tWin" data-w="blue"><small>BLUE</small>블루 승리</button><button class="wbtn red ${d.winner === 'red' ? 'on' : ''}" data-a="tWin" data-w="red"><small>RED</small>레드 승리</button></div>
      ${hookOn() && !edit && liveNote() ? `<p class="sm lv-note ${liveNote().bad ? 'bad' : 'mut'}">${esc(liveNote().t)}</p>` : ''}
      <button class="btn block ghost" data-a="tMore">${d.more ? '밴 · KDA · 시간 접기' : '밴 · KDA · 경기 시간 입력 (선택)'}</button>
      ${d.more ? `<div class="more">
        ${['blue', 'red'].map((s) => `<div class="banrow"><small>${s === 'blue' ? 'BLUE BAN' : 'RED BAN'}</small>${d.bans[s].map((b, i) => `<button class="sl-champ" data-a="tBan" data-s="${s}" data-i="${i}">${b ? champIcon(b) : `<span class="ci plus">${ic('plus')}</span>`}</button>`).join('')}</div>`).join('')}
        <div class="kda">${['blue', 'red'].map((s) => `<div>${d[s].map((id, i) => (id ? `<label><span>${LANE_ICON[LANES[i]]} ${pname(id)}</span><input class="inp xs2 mono" id="kda-${id}" inputmode="numeric" placeholder="K/D/A" value="${esc(d.kda[id] || '')}" data-c="tKda" data-id="${id}"></label>` : '')).join('')}</div>`).join('')}</div>
        <label class="mini">경기 시간 <input class="inp" type="datetime-local" value="${esc(d.at)}" data-c="tAt"> <span class="mut">비우면 지금 시각</span></label>
      </div>` : ''}
      <button class="btn pri block big" data-a="tSave">${edit ? '수정 내용 저장' : '경기 결과 저장'}</button>
    </div>
    ${lastSaved && !edit && S.st.MI[lastSaved] ? `<div class="sec-h"><h2>방금 기록한 경기</h2></div>${matchCard(S.store.data.matches[lastSaved])}` : ''}`;
  },
});

// 예상 승률 원형 그래프: 바깥 금테 + 눈금, 블루·레드 두 호. 가운데에는 승률이 더 높은 팀의 승률을 보여 주고 그 팀의 호를 빛나게 한다.
// 10명이 다 차야 빛나는 효과와 '○○ 예상 승률'을 표시하고, 배치 중에는 흐리게 지금까지의 예상만 보여 준다.
const RC = 2 * Math.PI * 50; // 호의 둘레(반지름 50)
function winRing(pb, full, any, filled) {
  const even = pb === 50, hi = even ? '' : pb > 50 ? 'blue' : 'red', hv = even ? 50 : Math.max(pb, 100 - pb);
  const gap = any && pb > 0 && pb < 100 ? 3 : 0, bl = Math.max(0, (RC * pb) / 100 - gap), rl = Math.max(0, (RC * (100 - pb)) / 100 - gap);
  const label = !any ? '예상 승률' : even ? '완전 팽팽' : `${hi === 'blue' ? '블루' : '레드'} 예상 승률`;
  const ticks = Array.from({ length: 40 }, (_, i) => `<line x1="60" y1="2.5" x2="60" y2="${i % 5 ? 5 : 7.5}" transform="rotate(${i * 9} 60 60)"/>`).join('');
  return `<div class="wring ${full ? 'full' : 'part'} ${hi}" role="img" aria-label="${label} ${hv}%">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="wr-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbeec8"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#7a5418"/></linearGradient>
        <radialGradient id="wr-in" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#16213a"/><stop offset="1" stop-color="#070b13"/></radialGradient></defs>
      <circle cx="60" cy="60" r="58.5" fill="none" stroke="url(#wr-gold)" stroke-width="1.2" opacity=".85"/>
      <g class="wr-ticks" stroke="url(#wr-gold)" stroke-width=".8">${ticks}</g>
      <circle cx="60" cy="60" r="50" fill="none" class="wr-track" stroke-width="8"/>
      ${any ? `<circle cx="60" cy="60" r="50" fill="none" class="wr-arc b ${hi === 'blue' ? 'hi' : ''}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${bl.toFixed(2)} ${RC.toFixed(2)}" transform="rotate(-90 60 60) translate(0 0)" style="stroke-dashoffset:${(-gap / 2).toFixed(2)}"/>
      <circle cx="60" cy="60" r="50" fill="none" class="wr-arc r ${hi === 'red' ? 'hi' : ''}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${rl.toFixed(2)} ${RC.toFixed(2)}" transform="rotate(-90 60 60)" style="stroke-dashoffset:${(-(RC * pb) / 100 - gap / 2).toFixed(2)}"/>` : ''}
      <circle cx="60" cy="60" r="42.5" fill="url(#wr-in)" stroke="url(#wr-gold)" stroke-width=".6" stroke-opacity=".5"/>
    </svg>
    <div class="wr-c"><small>${label}</small><b class="mono">${hv}<i>%</i></b><span>${full ? (even ? '누가 이겨도 이상하지 않아요' : `${hi === 'blue' ? '레드' : '블루'} ${100 - hv}%`) : any ? `배치 중 ${filled}/10` : '선수를 배치하세요'}</span></div>
  </div>`;
}

act('tSlot', (d) => {
  const dr = D(), i = +d.i;
  pickPlayer({
    title: `${d.s === 'blue' ? '블루' : '레드'} ${LANE_NAME[LANES[i]]}`, lane: LANES[i], allowClear: !!dr[d.s][i],
    onPick(id) {
      if (id) for (const s of ['blue', 'red']) { const j = dr[s].indexOf(id); if (j >= 0) dr[s][j] = dr[d.s][i]; }
      dr[d.s][i] = id; keep();
    },
  });
});
function usedNow(dr, skip) {
  const used = seriesUsed(seriesFor(dr), edit?.id);
  ['blue', 'red'].forEach((s) => {
    dr.champs[s].forEach((c, i) => { if (c && skip !== `c${s}${i}`) used[c] = '이번 판에서 선택됨'; });
    dr.bans[s].forEach((c, i) => { if (c && skip !== `b${s}${i}`) used[c] = '이번 판 밴'; });
  });
  return used;
}
act('tChamp', (d) => {
  const dr = D(), i = +d.i, id = dr[d.s][i];
  pickChamp({ title: `${id ? S.st.P[id]?.name : LANE_NAME[LANES[i]]} 챔피언`, used: usedNow(dr, `c${d.s}${i}`), current: dr.champs[d.s][i], onPick(n) { dr.champs[d.s][i] = n; keep(); } });
});
act('tBan', (d) => {
  const dr = D(), i = +d.i;
  pickChamp({ title: `${d.s === 'blue' ? '블루' : '레드'} 밴 ${i + 1}`, used: usedNow(dr, `b${d.s}${i}`), current: dr.bans[d.s][i], onPick(n) { dr.bans[d.s][i] = n; keep(); } });
});
act('tWin', (d) => { const dr = D(); dr.winner = dr.winner === d.w ? '' : d.w; keep(); });
act('tMore', () => { D().more = !D().more; keep(); });
act('tNew', (d, el) => { D().newSeries = el.checked; keep(); });
act('tAt', (d, el) => { D().at = el.value; keep(); });
act('tKda', (d, el) => {
  D().kda[d.id] = el.value.trim();
  if (!edit) keep();
});
// ---------- 게임에서 챔피언·밴 불러오기(연동 서버 /live → js/live.js 가 자리 맞추기) ----------
// 밴픽 정보는 라이엇 API에 없어서 로딩 화면(게임 시작)부터 찾을 수 있다. 먼저 눌러 두면 30초마다 다시 확인해 최대 11분 동안 기다린다(밴픽 시작할 때 눌러 두는 용도)
// (기다리는 동안 라이엇 호출은 30초에 2~6번). 찾으면 라인업 동기화(meta/todayDraft)로 모두의 화면에 반영된다.
// 기다리는 상태는 meta/live = { until, by, cid, note, bad, at } 로 공유해서 다른 접속자 화면에도 '밴픽 중 · 누른 사람'이 뜬다.
// 라이엇 확인은 누른 사람의 화면만 한다. 다른 사람이 '밴픽 중'을 누르면 until 을 0으로 바꾸고, 누른 사람의 화면이 그걸 보고 멈춘다.
// (쓰기는 시작·끝에 한 번씩만. 누른 사람이 창을 닫아도 until 이 지나면 저절로 풀린다)
const LV = { busy: false, until: 0, t: 0, start: 0, note: '', bad: false };
const LIVE_WAIT = 11 * 60e3, LIVE_EVERY = 30e3;
const liveDoc = () => S.store?.data?.meta?.live || null;
const remoteLive = () => { const r = liveDoc(); return r && r.cid !== cid && +r.until > S.store.serverNow() ? r : null; };
const liveShare = (part) => S.store.put('meta', 'live', { until: 0, note: '', bad: false, by: nick() || '익명', cid, ...part, at: S.store.serverNow() }).catch(() => {});
const liveEnd = () => { liveStop(); liveShare({ note: LV.note, bad: LV.bad }); };
let rlTimer = 0;
// 결과 안내 한 줄: 내 화면의 결과, 없으면 다른 사람이 누른 밴픽 시작의 결과(20분 동안)
const liveNote = () => {
  if (LV.note) return { t: LV.note, bad: LV.bad };
  const r = liveDoc();
  return r && r.cid !== cid && !+r.until && r.note && S.store.serverNow() - (+r.at || 0) < 20 * 60e3 ? { t: `${r.by} 님의 밴픽 시작 · ${r.note}`, bad: !!r.bad } : null;
};
// 다른 화면에서 meta/live 가 바뀌면(app.js 가 'np:live' 를 보냄): 내가 기다리는 중인데 누가 멈췄으면 나도 멈춘다
addEventListener('np:live', () => {
  const r = liveDoc();
  if ((LV.until || LV.busy) && r && r.cid === cid && !+r.until && r.stop) { liveStop(); LV.note = `${r.stop} 님이 기다리기를 멈췄어요`; LV.bad = false; }
  if (S.page === 'today') refresh();
});
// 머리 버튼(AI 추천 왼쪽): 평소 '밴픽 시작' → 찾는 중 → 게임 전이면 '밴픽 중'(누르면 그만). 결과·오류 안내는 경기 결과 기록 칸 위 한 줄 + 알림
function liveBtn(full) {
  const rl = !LV.until && !LV.busy && remoteLive();
  if (rl) {
    clearTimeout(rlTimer); rlTimer = setTimeout(() => S.page === 'today' && refresh(), Math.max(1000, +rl.until - S.store.serverNow() + 500)); // 시간이 지나면 버튼을 되돌린다
    return `<button class="btn gold lv-on" data-a="tLiveStop" title="${esc(rl.by)} 님이 밴픽 시작을 눌러 두었어요. 로딩 화면이 뜨면 모두의 화면에 챔피언·밴이 채워져요. 누르면 기다리기를 멈춰요">${ic('eye')}밴픽 중<span class="m-hide"> · ${esc(rl.by)}</span></button>`;
  }
  if (LV.until) return `<button class="btn gold lv-on" data-a="tLiveStop" title="밴픽이 끝나기를 기다리는 중이에요. 로딩 화면이 뜨면 자동으로 챔피언·밴을 채워요(최대 11분). 누르면 그만 기다려요">${ic('eye')}밴픽 중</button>`;
  return `<button class="btn gold" data-a="tLive" ${full && !LV.busy ? '' : 'disabled'} title="${full ? '밴픽을 시작할 때 눌러 두면, 로딩 화면이 뜨는 순간 10명의 챔피언과 밴을 자동으로 채워요(최대 11분 기다림). 게임이 이미 시작됐으면 바로 채워요' : '10명을 모두 배치하면 쓸 수 있어요'}">${ic('eye')}${LV.busy ? '찾는 중…' : '밴픽<span class="m-hide"> 시작</span>'}</button>`;
}
const liveStop = () => { clearTimeout(LV.t); LV.t = 0; LV.until = 0; if (LV.busy) LV.stopped = true; }; // 확인 요청 도중에 멈추면 응답이 와도 무시
act('tLive', () => {
  if (LV.busy || LV.until) return;
  const rl = remoteLive(); if (rl) return toast(`${rl.by} 님이 이미 밴픽 시작을 눌러 두었어요`);
  if (!isFull(D())) return toast('양 팀 10명을 모두 배치해 주세요');
  LV.start = 0; LV.note = ''; LV.bad = false; LV.stopped = false;
  liveShare({ until: S.store.serverNow() + LIVE_WAIT + 60e3 });
  liveTry(false);
});
act('tLiveStop', () => {
  if (LV.until || LV.busy) { liveStop(); LV.note = ''; liveShare({}); }
  else if (remoteLive()) S.store.patch('meta', 'live', { until: 0, stop: nick() || '익명', at: S.store.serverNow() }).catch(() => {}); // 누른 사람의 화면이 보고 멈춘다
  toast('기다리기를 멈췄어요'); refresh();
});
async function liveTry(quick) {
  LV.t = 0; LV.busy = true; refresh();
  let res;
  try { const { liveRequest } = await import('./live.js'); res = await liveRequest(draft || D(), quick ? 3 : 0, LV.start); }
  catch (e) { res = { error: e.message || String(e) }; }
  LV.busy = false;
  if (LV.stopped) { LV.stopped = false; return refresh(); }
  if (S.page === 'today' && S.arg[0] === 'edit') { LV.note = ''; liveEnd(); return refresh(); } // 지난 경기 수정 화면으로 옮겼으면 그만
  // 처음 누른 때의 오류는 바로 알리고, 기다리는 중의 잠깐 오류(연결·호출 한도)는 다음 확인에서 다시 시도한다. 키·닉네임 문제는 기다려도 안 되니 멈춘다
  if (res.error === 'not found') res.error = '연동 서버(Worker)가 옛 버전이라 밴픽 시작을 쓸 수 없어요. 관리 화면의 안내대로 Worker를 다시 배포해 주세요';
  if (res.error && (!LV.until || /키|닉네임|옛 버전/.test(res.error))) { LV.note = '불러오기 실패: ' + res.error; LV.bad = true; liveEnd(); toast(LV.note); return refresh(); }
  if (!res.found) {
    if (!LV.until) { LV.until = Date.now() + LIVE_WAIT; toast('밴픽이 끝나고 로딩 화면이 뜨면 자동으로 챔피언을 채울게요'); }
    if (Date.now() + LIVE_EVERY > LV.until) { LV.note = '11분 동안 진행 중인 게임을 찾지 못했어요. 게임이 시작된 뒤 다시 눌러 주세요'; LV.bad = true; liveEnd(); toast(LV.note); }
    else { LV.start += 3; LV.t = setTimeout(() => liveTry(true), LIVE_EVERY); }
    return refresh();
  }
  liveStop();
  const { planLive } = await import('./live.js');
  const dr = D(), plan = planLive(dr, res);
  if (plan.error) { LV.note = plan.error; LV.bad = true; liveShare({ note: LV.note, bad: true }); toast('불러오지 않았어요 · 경기 결과 기록 칸의 안내를 확인해 주세요'); return refresh(); }
  dr.blue = plan.blue; dr.red = plan.red; dr.champs = plan.champs; dr.winner = plan.winner;
  if (plan.bans) dr.bans = plan.bans;
  if (plan.nb) dr.more = true; // 밴을 채웠으면 밴 입력 칸을 펼쳐서 보여 준다
  const msg = `챔피언 ${plan.filled}명${plan.nb ? ` · 밴 ${plan.nb}개` : ''}를 불러왔어요${plan.swap ? ' · 게임 진영에 맞춰 블루/레드를 바꿨어요' : ''}`;
  LV.note = [msg, ...plan.notes].join(' · '); LV.bad = false;
  liveShare({ note: LV.note });
  keep(); toast(msg);
}

// AI 추천: 라인별 두 사람은 그대로, 블루/레드만 다시 나눈다(챔피언 선택도 사람을 따라간다)
act('tAi', () => {
  const dr = D(); if (!isFull(dr)) return toast('양 팀 10명을 모두 배치해 주세요');
  const r = aiBalance(LANES.map((_, i) => [dr.blue[i], dr.red[i]]), S.st);
  if (!r) return;
  if (!r.swaps) return toast(`이미 가장 균형 잡힌 배치예요 · 점수 차 ${r.diff.toFixed(1)}`);
  LANES.forEach((_, i) => {
    if (r.blue[i] === dr.blue[i]) return;
    [dr.blue[i], dr.red[i]] = [dr.red[i], dr.blue[i]];
    [dr.champs.blue[i], dr.champs.red[i]] = [dr.champs.red[i], dr.champs.blue[i]];
  });
  keep(); burst(innerWidth / 2, innerHeight / 3, 60);
  toast(`AI 추천 배치 · 점수 ${r.bs.toFixed(1)} : ${r.rs.toFixed(1)} (차이 ${r.diff.toFixed(1)})`);
});
act('tSwap', () => { const dr = D(); [dr.blue, dr.red] = [dr.red, dr.blue]; [dr.champs.blue, dr.champs.red] = [dr.champs.red, dr.champs.blue]; [dr.bans.blue, dr.bans.red] = [dr.bans.red, dr.bans.blue]; if (dr.winner) dr.winner = dr.winner === 'blue' ? 'red' : 'blue'; keep(); });
act('tClear', () => { if (confirm('라인업과 입력 내용을 모두 비울까요?')) { draft = blank(); keep(); } });
act('tSave', async (d, btn) => {
  const dr = D(), all = [...dr.blue, ...dr.red];
  if (!all.every(Boolean) || new Set(all).size !== 10) return toast('양 팀 10명을 모두 배치해 주세요');
  if (!dr.winner) return toast('승리팀을 선택해 주세요');
  const kda = {};
  for (const id of all) {
    const v = (dr.kda[id] || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    if (v.length === 3) kda[id] = v; else if (v.length) return toast(`${S.st.P[id].name} KDA는 3/2/10 형식으로 입력해 주세요`);
  }
  const ev = evalLineup(dr.blue, dr.red, S.st), old = edit && S.store.data.matches[edit.id];
  const sameLine = old && old.blue.join() === dr.blue.join() && old.red.join() === dr.red.join();
  const at = dr.at ? new Date(dr.at).getTime() : Date.now(), id = old?.id || uid();
  const m = {
    id, at, seq: old?.seq || 0, seriesId: seriesFor(dr) || id, blue: [...dr.blue], red: [...dr.red], winner: dr.winner,
    champs: { blue: [...dr.champs.blue], red: [...dr.champs.red] }, bans: { blue: dr.bans.blue.filter(Boolean), red: dr.bans.red.filter(Boolean) }, kda,
    snap: sameLine && old.snap ? old.snap : { bs: ev.bs, rs: ev.rs, pBlue: +ev.pBlue.toFixed(4) },
    ...(dr.stats || old?.stats ? { stats: dr.stats || old.stats } : {}), ...(dr.dur || old?.dur ? { dur: dr.dur || old.dur } : {}), // 리플레이에서 읽은 상세 기록
  };
  btn.disabled = true;
  try {
    if (old) await history('match-edit', old);
    await S.store.put('matches', id, m);
  } catch (e) { btn.disabled = false; return toast('저장 실패: ' + (e.code || e.message)); }
  toast(old ? '수정했습니다' : `저장했습니다 · ${dr.winner === 'blue' ? '블루' : '레드'} 승리`);
  if (old) { edit = null; return go('#/matches'); }
  burst(innerWidth / 2, innerHeight / 3);
  sysChat(`경기 기록 · ${dr.winner === 'blue' ? '블루' : '레드'} 승리 (${m[dr.winner].map((p) => S.st.P[p]?.name).join(', ')})`);
  notify('match', id); // 디스코드 알림(연동 서버가 설정돼 있을 때만)
  lastSaved = id;
  draft = { ...blank(), blue: dr.blue, red: dr.red }; // 같은 팀으로 다음 판을 바로 기록할 수 있게 라인업은 유지
  keep(); window.scrollTo(0, 0); document.getElementById('main').scrollTop = 0;
});

// ---------- 드래그로 선수 교환 ----------
// 마우스는 끌기 시작하면 바로, 터치는 꾹 누르면(0.3초) 집어 든다. 다른 칸(빈 칸 포함)에 놓으면 두 자리의 선수·챔피언을 맞바꾼다.
const DG = { from: null, src: null, ghost: null, x0: 0, y0: 0, dx: 0, dy: 0, pid: -1, touch: false, on: false, timer: 0, over: null, block: false };
const slotAt = (x, y) => document.elementFromPoint(x, y)?.closest('.arena .slot[data-ds]') || null;
function dgClean() {
  clearTimeout(DG.timer);
  DG.ghost?.remove(); DG.src?.classList.remove('dg-src'); DG.over?.classList.remove('dg-over');
  document.body.classList.remove('dragging');
  Object.assign(DG, { from: null, src: null, ghost: null, on: false, over: null, pid: -1 });
}
function dgLift(x, y) {
  if (!DG.src || !document.body.contains(DG.src)) return dgClean();
  const r = DG.src.getBoundingClientRect();
  DG.on = true; DG.dx = x - r.left; DG.dy = y - r.top;
  DG.ghost = DG.src.cloneNode(true); DG.ghost.classList.add('dg-ghost'); DG.ghost.style.width = r.width + 'px'; DG.ghost.style.height = r.height + 'px';
  document.body.appendChild(DG.ghost); DG.src.classList.add('dg-src'); document.body.classList.add('dragging');
  navigator.vibrate?.(15);
  dgPlace(x, y);
}
function dgPlace(x, y) {
  if (DG.ghost) DG.ghost.style.transform = `translate(${x - DG.dx}px,${y - DG.dy}px) rotate(-2deg) scale(1.04)`;
  const t = slotAt(x, y), ok = t && t !== DG.src ? t : null;
  if (ok !== DG.over) { DG.over?.classList.remove('dg-over'); ok?.classList.add('dg-over'); DG.over = ok; }
}
document.addEventListener('pointerdown', (e) => {
  if (edit || S.page !== 'today' || e.button > 0 || DG.from) return;
  const slot = e.target.closest('.arena .slot[data-ds]');
  if (!slot || slot.classList.contains('emp') || e.target.closest('.sl-champ')) return;
  Object.assign(DG, { from: { s: slot.dataset.ds, i: +slot.dataset.di }, src: slot, x0: e.clientX, y0: e.clientY, pid: e.pointerId, touch: e.pointerType !== 'mouse' });
  if (DG.touch) DG.timer = setTimeout(() => dgLift(DG.x0, DG.y0), 320);
});
document.addEventListener('pointermove', (e) => {
  if (!DG.from || e.pointerId !== DG.pid) return;
  if (!DG.on) {
    const dist = Math.hypot(e.clientX - DG.x0, e.clientY - DG.y0);
    if (DG.touch) { if (dist > 10) dgClean(); return; } // 꾹 누르기 전에 움직이면 그냥 스크롤
    if (dist < 6) return;
    dgLift(e.clientX, e.clientY);
  }
  e.preventDefault(); dgPlace(e.clientX, e.clientY);
});
document.addEventListener('pointerup', (e) => {
  if (!DG.from || e.pointerId !== DG.pid) return;
  if (DG.on) {
    const t = slotAt(e.clientX, e.clientY), f = DG.from;
    DG.block = true; setTimeout(() => (DG.block = false), 60); // 놓는 순간의 클릭(선수 선택 창)이 열리지 않게
    if (t && !(t.dataset.ds === f.s && +t.dataset.di === f.i)) {
      const dr = D(), ts = t.dataset.ds, ti = +t.dataset.di;
      [dr[f.s][f.i], dr[ts][ti]] = [dr[ts][ti], dr[f.s][f.i]];
      [dr.champs[f.s][f.i], dr.champs[ts][ti]] = [dr.champs[ts][ti], dr.champs[f.s][f.i]];
      const r = t.getBoundingClientRect();
      dgClean(); keep(); burst(r.left + r.width / 2, r.top + r.height / 2, 40);
      return;
    }
  }
  dgClean();
});
document.addEventListener('pointercancel', () => DG.from && dgClean());
document.addEventListener('touchmove', (e) => { if (DG.on) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => { if (DG.from && DG.touch) e.preventDefault(); });
document.addEventListener('click', (e) => { if (DG.block) { DG.block = false; e.stopPropagation(); e.preventDefault(); } }, true);
