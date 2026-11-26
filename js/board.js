// 라인 지원: 참가자가 원하는 라인(탑~서폿·상관없음)을 직접 고르고 '선택 완료'를 누른다. 모두 완료하면 자동으로 추첨이 시작되고,
// 2명 넘게 몰린 라인은 무작위로 2명을 뽑아 라인업에 넣는다. 연 사람·관리자는 취소하거나 강제 마감할 수 있다.
// meta/board 문서 하나로 모든 접속자가 같은 지원 현황과 같은 추첨 장면을 같은 시각에 본다(시작 시각은 서버 시계 기준).
import { gname, S, act, go, isAdmin, esc, modal, closeModal, mh, toast, burst, refresh, ic, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
import { recruitIds } from './recruit.js'; // 오늘 내전 모집 참가자(라인 지원 참가자로 미리 골라 둠)
import { setDraftTeams, placedIds } from './today.js';
import { aiBalance } from './stats.js';
import { notify } from './hook.js';
import { sysChat, nick, cid } from './social.js';
// 강제 마감·취소·AI 추천은 게시자(연 사람의 브라우저)와 관리자만 할 수 있다.
// owner가 없는 예전 게시물은 연 사람 닉네임으로 비교한다(닉네임도 없으면 누구나).
const isOwner = (d) => !d || isAdmin() || (d.owner ? d.owner === cid : !d.by || d.by === '익명' || d.by === nick());

const OPTS = [...LANES, 'any'];
const NAME = { ...LANE_NAME, any: '상관없음' };
const COLOR = { ...LANE_COLOR, any: '#d9a441' };
const ANY_ICON = '<svg class="lic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 14.300 9.100 20.800 9.300 15.700 13.300 17.500 19.600 12 16 6.500 19.600 8.300 13.300 3.200 9.300 9.700 9.100z"/></svg>';
const icon = (o) => (o === 'any' ? ANY_ICON : LANE_ICON[o]);

// 소통(1~4: 과묵·조용·수다·샷콜러, 팀 짜기에는 쓰지 않음). 관리 화면 선수 관리에서 고정값(players.talk)을 정할 수 있고,
// 라인 지원 창에서 본인이 그날 기분대로 바꿀 수 있다(meta/board.tk: 1~4 = 오늘만 이 단계, 0 = 오늘은 표시 안 함, 없으면 고정값).
// 오늘의 내전 라인업 칸에 마이크 + 막대로 보인다. 라인 지원을 연 지 16시간이 지나면 그날 바꾼 값은 끝나고 고정값으로 돌아간다.
// (처음 5단계로 저장했던 meta/board.talk 는 쓰지 않는다)
export const TALK = ['과묵', '조용', '수다', '샷콜러'];
const TALK_TTL = 16 * 3600e3;
const tkOk = (n) => Number.isInteger(n) && n >= 1 && n <= TALK.length;
export const talkIcon = (n, cls = '') => `<span class="tk-ico tkl${n} ${cls}" title="소통: ${TALK[n - 1]} (${n}/${TALK.length})" aria-label="소통 ${TALK[n - 1]}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none"/></svg><span class="tb">${TALK.map((_, k) => `<u class="${k < n ? 'on' : ''}"></u>`).join('')}</span></span>`;
export const talkFixed = (id) => { const n = +S.st.P[id]?.p?.talk; return tkOk(n) ? n : 0; };
const tkToday = (d) => (d && d.tk && S.store.serverNow() - (+d.at || 0) <= TALK_TTL ? d.tk : null);
export const talkOf = (id, d = cur()) => { if (!id) return 0; const t = tkToday(d); if (t && id in t) { const n = +t[id]; return tkOk(n) ? n : 0; } return talkFixed(id); };
const talkRow = (d) => {
  const n = talkOf(BD.me, d), fx = talkFixed(BD.me), own = tkToday(d) && BD.me in d.tk;
  const note = fx ? (own ? `오늘만 변경 · 기본 ${TALK[fx - 1]} <button type="button" class="lnk" data-a="bdTalk" data-n="fx">기본으로</button>` : `기본값 ${TALK[fx - 1]} (관리자 지정) · 눌러서 오늘만 변경`) : '선택 · 라인업 칸에 표시';
  return `<div class="lp-talk"><span class="lp-tq">${ic('talk')}<b>오늘 소통</b><small>${note}</small></span><span class="lp-tb">${TALK.map((t, i) => `<button class="btn xs ${n === i + 1 ? 'on' : ''}" data-a="bdTalk" data-n="${i + 1}" aria-pressed="${n === i + 1}">${talkIcon(i + 1)}<span>${t}</span></button>`).join('')}</span></div>`;
};
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
const myPrefs = (d) => (BD.opt && BD.opt.rid === d.rid ? BD.opt.p : prefs(d, BD.me)); // 내가 방금 누른 지망을 저장이 끝나기 전에도 바로 보여 줌
const prefs = (d, id) => { const v = d.picks?.[id]; return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []; };
const RANK = ['1지망', '2지망', '3지망'];
// 완료: done[선수] = true. 모두 완료하면 마지막으로 누른 사람의 쓰기에서 바로 추첨 단계로 넘어간다.
const isDone = (d, id) => !!d.done?.[id];
// 라인 고정: fixed[선수] = 'adc'. 고정한 사람은 지망 없이 완료로 치고, 추첨 전에 그 라인에 먼저 배치한다(한 라인 최대 2명).
// 지원 화면의 라인 카드에는 고정 인원 수만 보여 준다(누가 고정했는지는 최종 라인업에서만 보인다).
const fixOf = (d, id) => (LANES.includes(d.fixed?.[id]) && d.ids.includes(id) ? d.fixed[id] : '');
const fixN = (d, l) => d.ids.filter((id) => fixOf(d, id) === l).length;

// ---------- 1지망 추첨 보정 ----------
// meta/luck.miss[선수] = 1지망 추첨에서 떨어진 횟수(최대 3). 떨어질 때마다 1지망 추첨 가중치 +50%(1 → 1.5 → 2 → 2.5배),
// 1지망에 뽑히면(추첨 당첨이든 경쟁 없이 바로 들어가든) 0으로 초기화. 2·3지망 추첨과 빈 자리 배치는 모두 같은 확률.
export const LUCK_STEP = 0.5, LUCK_MAX = 3;
const luckDoc = () => S.store?.data?.meta?.luck || {};
export const missOf = (id, L = luckDoc()) => Math.max(0, Math.min(LUCK_MAX, Math.floor(+L.miss?.[id] || 0)));
export const weightOf = (n) => 1 + LUCK_STEP * Math.max(0, Math.min(LUCK_MAX, n));
const xw = (w) => `×${+w.toFixed(1)}`;
// 가중치 순차 추첨(뽑힌 사람은 빠지고 남은 사람끼리 다시 가중치 비율로)에서 k명 안에 들 확률을 정확히 계산한다(후보 20명까지).
export function inclusion(ws, k) {
  const n = ws.length;
  if (k >= n) return ws.map(() => 1);
  if (k <= 0) return ws.map(() => 0);
  const memo = new Map();
  const rec = (mask, r) => {
    if (r === 0 || !mask) return null;
    const key = mask * 32 + r; if (memo.has(key)) return memo.get(key);
    let tot = 0; for (let i = 0; i < n; i++) if (mask >> i & 1) tot += ws[i];
    const out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (!(mask >> i & 1)) continue;
      const p = ws[i] / tot; out[i] += p;
      const sub = rec(mask & ~(1 << i), r - 1);
      if (sub) for (let j = 0; j < n; j++) out[j] += p * sub[j];
    }
    memo.set(key, out); return out;
  };
  return rec((1 << n) - 1, k);
}
// 실제 추첨: 남은 후보 가중치 합 안에서 무작위 지점을 골라 한 명씩 뽑는다(암호학적 난수)
export function weightedPick(ids, ws, k) {
  const pool = ids.map((id, i) => ({ id, w: ws[i] })), got = [];
  while (got.length < k && pool.length) {
    const tot = pool.reduce((a, x) => a + x.w, 0);
    let t = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * tot, i = 0;
    for (; i < pool.length - 1; i++) { t -= pool[i].w; if (t < 0) break; }
    got.push(pool.splice(i, 1)[0].id);
  }
  return got;
}
// 지원 중인 판에서 이 선수가 1지망에 들어갈 확률(1지망 라운드는 라인끼리 서로 영향이 없어서 정확히 계산된다)
function firstChance(d, id) {
  const l = prefs(d, id)[0]; if (!LANES.includes(l) || fixOf(d, id)) return null;
  const c = d.ids.filter((x) => !fixOf(d, x) && prefs(d, x)[0] === l), free = Math.max(0, 2 - fixN(d, l));
  const L = luckDoc(), ws = c.map((x) => weightOf(missOf(x, L)));
  return { lane: l, n: c.length, free, p: inclusion(ws, free)[c.indexOf(id)] };
}
const pctTxt = (p) => (p >= 0.9995 ? '100%' : p <= 0.0005 ? '0%' : `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`);
const allDone = (d) => d.ids.length > 0 && d.ids.every((id) => isDone(d, id));

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
// 라인 카드(2026-11-25): 각 라인에 몇 명이 지원했는지(1·2·3지망 인원·몰림 상태·막대)는 보여 주지 않는다(눈치 보지 않고 원하는 라인을 고르게).
// 라인 고정 인원만 모두에게 보인다(몰래 고정한 사람이 없게). 대신 카드에 내 그 라인 기록(판수·승률·라인 점수)과 최근 배정 기록을 보여 준다(나에게만)
function card(d, o) {
  const fx = o === 'any' ? 0 : fixN(d, o), full = o !== 'any' && 2 - fx <= 0;
  const myRank = BD.me ? myPrefs(d).indexOf(o) : -1;
  const state = full ? '<span class="lp-st fix">고정으로 마감</span>' : '';
  return `<button class="lp-card ${myRank >= 0 ? 'mine' : ''} ${o === 'any' ? 'any' : ''} ${full ? 'full' : ''}" data-a="bdPick" data-o="${o}" style="--lc:${COLOR[o]}" ${d.status !== 'open' || (BD.me && isDone(d, BD.me)) ? 'disabled' : ''}>
    <span class="lp-ch"><i class="lp-ico">${icon(o)}</i><b>${NAME[o]}</b>${myRank >= 0 ? `<em class="r${myRank + 1}">${RANK[myRank]}</em>` : ''}</span>
    <span class="lp-meta">${o === 'any' ? '빈 자리에 배치' : '모집 2명'}${o === 'any' ? '' : `<span class="lp-fx${fx ? ' on' : ''}" title="이 라인을 고정한 사람 수(모두에게 보여요)">${ic('lock', 'ie')}고정 ${fx}/2</span>`}${state}</span>
    ${myLane(o)}
  </button>`;
}
// 내 라인 기록(카드 안, 나에게만): 전체 판수·승률·라인 점수 + 최근 10판 중 이 라인 횟수·마지막으로 간 날. '상관없음' 카드는 최근 5판 라인 순서
const REC = { st: null, me: '', v: null };
function myRec() {
  if (REC.st === S.st && REC.me === BD.me) return REC.v;
  const me = BD.me, out = [];
  if (me && S.st?.matches) for (let i = S.st.matches.length - 1; i >= 0 && out.length < 10; i--) { const m = S.st.matches[i], b = m.blue.indexOf(me), r = m.red.indexOf(me); if (b >= 0 || r >= 0) out.push({ lane: LANES[b >= 0 ? b : r], at: m.at, win: m.winner === (b >= 0 ? 'blue' : 'red') }); }
  REC.st = S.st; REC.me = me; REC.v = out; return out;
}
const ago = (t) => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`; };
function myLane(o) {
  const s = BD.me && S.st?.P?.[BD.me];
  if (!s) return '<span class="lp-mine dim">이름을 고르면 내 라인 기록이 보여요</span>';
  const rec = myRec();
  if (o === 'any') return `<span class="lp-mine"><small>내 최근 ${Math.min(5, rec.length)}판 라인</small><span class="lp-seq">${rec.slice(0, 5).map((x) => `<i class="${x.win ? 'w' : 'l'}" style="--lc:${COLOR[x.lane]}" title="${NAME[x.lane]} ${x.win ? '승' : '패'}">${icon(x.lane)}</i>`).join('') || '<em>기록 없음</em>'}</span></span>`;
  const v = s.lanes[o] || { g: 0, w: 0 }, sc = +s.p.scores?.[o] || 0, n = rec.filter((x) => x.lane === o).length, last = rec.find((x) => x.lane === o);
  return `<span class="lp-mine"><span class="lp-rec"><b class="mono">${v.g ? Math.round((v.w / v.g) * 100) + '%' : '—'}</b><small>${v.g ? `${v.g}판 ${v.w}승` : '아직 안 가 봄'}</small><span class="lp-sc" title="라인 점수">${sc}점</span></span><small class="lp-rct">최근 10판 중 <b>${n}</b>번${last ? ` · ${ago(last.at)}` : ''}</small></span>`;
}
// 내 1지망 당첨 확률(나에게만 보인다): 지금 그 라인 1지망 인원·보정 기준, 누가 고르거나 바꿀 때마다 다시 계산
// 내 1지망 보정(나에게만): 확률·경쟁 인원은 라인별 지원 인원을 알려 주게 되므로 보여 주지 않고 보정 단계·가중치만
function chanceHTML(d, id) {
  const m = missOf(id), w = weightOf(m);
  return `<span class="lp-chance"><b>${m ? `1지망 보정 ${m}단계 · 가중치 ${xw(w)}` : '1지망 보정 없음'}</b><small>${m ? '1지망이 몰려 추첨할 때 그만큼 더 잘 뽑혀요' : '1지망 추첨에서 떨어지면 다음에 가중치가 올라가요'}</small></span>`;
}
// 보정 현황(모두에게 보인다): 누가 어느 라인을 골랐는지는 없고 떨어진 횟수와 가중치만
function luckTable() {
  const L = luckDoc(), rows = Object.keys(L.miss || {}).filter((id) => missOf(id, L) && S.st.P[id]).sort((a, b) => missOf(b, L) - missOf(a, L) || nm(a).localeCompare(nm(b), 'ko'));
  return `<details class="lp-luckt"><summary>${ic('target')}<b>1지망 보정 현황</b><small>${rows.length ? `${rows.length}명 보정 중` : '보정 중인 사람 없음'}</small></summary>
    <p class="hint">1지망 추첨에서 떨어질 때마다 다음 1지망 추첨 가중치가 +50%씩 올라가요(최대 3번 · ×2.5). 1지망에 들어가면 0으로 돌아가요. 2·3지망 추첨과 빈 자리 배치는 모두 같은 확률이에요.</p>
    ${rows.length ? `<div class="lp-lrows">${rows.map((id) => `<span class="lp-lr"><b>${esc(nm(id))}</b><small>${missOf(id, L)}번 떨어짐</small><em class="mono">${xw(weightOf(missOf(id, L)))}</em></span>`).join('')}</div>` : ''}</details>`;
}
function openHTML(d) {
  const doneN = d.ids.filter((id) => isDone(d, id)).length, isMe = d.ids.includes(BD.me), mine = isMe ? myPrefs(d) : [], meDone = isMe && isDone(d, BD.me), own = isOwner(d);
  const myFix = isMe ? fixOf(d, BD.me) : '';
  const mem = (id) => {
    const p = prefs(d, id)[0], me = id === BD.me, ok = isDone(d, id);
    const st = ok ? 'done' : p ? 'ok' : '';
    return `<button class="lp-mem ${me ? 'me' : ''} ${st}" data-a="bdMe" data-id="${id}" style="--lc:${ok ? '#4fd08b' : p ? '#d9a441' : '#5a6a84'}" title="${ok ? '선택 완료' : p ? '고르는 중 (아직 완료 안 누름)' : '아직 안 고름'}">${ok ? '<i>✓</i>' : p ? `<i>${me ? icon(p) : '…'}</i>` : '<i class="dot"></i>'}${esc(nm(id))}${missOf(id) ? `<b class="lp-luck" title="1지망 추첨에서 ${missOf(id)}번 연속 떨어져 1지망 당첨 가중치 ${xw(weightOf(missOf(id)))}">${xw(weightOf(missOf(id)))}</b>` : ''}</button>`;
  };
  const myBtn = !isMe ? '<span class="lp-wait">본인 이름을 먼저 눌러 주세요</span>'
    : myFix ? `<button class="btn ghost" data-a="bdUnfix">${ic('unlock')}고정 해제</button>`
    : meDone ? `<button class="btn ghost" data-a="bdUndo">${ic('edit')}다시 고르기</button>`
    : `<button class="btn pri lp-done" data-a="bdDone" ${mine.length ? '' : 'disabled title="라인을 하나 이상 고르세요 (상관없음도 가능)"'}>✓ 선택 완료</button>`;
  const waiting = d.ids.filter((id) => !isDone(d, id));
  const ownBtns = own ? `<div class="lp-own">${waiting.length ? `<button class="btn ghost xs" data-a="bdNudge" title="공용 채팅에 남은 사람 이름을 올려 알려요">${ic('bell')}남은 ${waiting.length}명 부르기</button>` : ''}<button class="btn ghost xs" data-a="bdEditOpen">${ic('users')}참가자 편집</button><button class="btn ghost xs" data-a="bdShut">취소하기</button><button class="btn ghost xs" data-a="bdGo" ${d.ids.some((id) => prefs(d, id).length) ? '' : 'disabled'}>${ic('dice')}강제 마감</button></div>` : '';
  return `<div class="lp-h"><div><small><i class="live"></i>LIVE · 모두 같은 화면</small><h2>${ic('users')}라인 지원</h2></div><span class="grow"></span>
      <button class="btn ghost xs" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button><button class="btn ghost xs" data-a="bdHide" title="닫기 (라인 지원은 계속 열려 있음)">${ic('x')}</button></div>
    <ol class="lp-steps"><li class="${isMe ? 'done' : 'on'}">내 이름 선택</li><li class="${isMe ? (mine.length ? 'done' : 'on') : ''}">라인 1~3지망 선택</li><li class="${meDone ? 'done' : isMe && mine.length ? 'on' : ''}">선택 완료 누르기</li><li>모두 완료 → 자동 추첨</li></ol>
    ${isMe && myFix ? `<div class="lp-my locked"><b>${esc(nm(BD.me))}</b><span class="lp-rk on" style="--lc:${COLOR[myFix]}"><small>${ic('lock', 'ie')}고정</small>${icon(myFix)}${NAME[myFix]}</span><small class="mut">이 라인으로 고정돼 추첨 없이 배치돼요 · 다른 사람에게는 '고정 1'처럼 숫자만 보여요</small></div>` : ''}
    ${isMe && !myFix && !meDone ? `<div class="lp-fixrow">${BD.fixing ? `<span class="lp-fxq">${ic('lock', 'ie')}고정할 라인</span>${LANES.map((l) => `<button class="btn xs lp-fxb" data-a="bdFix" data-o="${l}" style="--lc:${COLOR[l]}" ${fixN(d, l) >= 2 ? 'disabled title="이미 2명이 고정했어요"' : ''}>${icon(l)}${NAME[l]}</button>`).join('')}<button class="btn ghost xs" data-a="bdFixOpen">취소</button>` : '<button class="btn ghost xs lp-fxopen" data-a="bdFixOpen" title="오늘 이 라인으로 가기로 정해졌으면 고정하세요">' + ic('lock') + '라인 고정</button>'}</div>` : ''}
    ${isMe && !myFix ? `<div class="lp-my ${meDone ? 'locked' : ''}"><b>${esc(nm(BD.me))}</b>의 지망${[0, 1, 2].map((r) => `<span class="lp-rk ${mine[r] ? 'on' : ''}" style="--lc:${mine[r] ? COLOR[mine[r]] : '#3a4a64'}"><small>${RANK[r]}</small>${mine[r] ? `${icon(mine[r])}${NAME[mine[r]]}` : '—'}</span>`).join('')}<small class="mut">${meDone ? '완료했어요 · 바꾸려면 아래 \'다시 고르기\'' : '카드를 누른 순서대로 1·2·3지망 · 다시 누르면 빠져요'}</small>${chanceHTML(d, BD.me)}</div>` : ''}
    ${isMe ? talkRow(d) : ''}
    ${isMe && !BD.roster ? `<div class="lp-sec lp-mini"><span>${ic('user')}<b>${esc(nm(BD.me))}</b>(으)로 지원 중</span><button class="btn ghost xs" data-a="bdRoster">참가자 현황 · 대리 지원</button></div>`
      : `<div class="lp-sec"><div class="lp-sh"><b>참가자</b><small>${isMe ? `<b>${esc(nm(BD.me))}</b>(으)로 지원 중 · 다른 이름을 누르면 대리 지원` : '본인 이름을 눌러 주세요'}</small></div>
      <div class="lp-roster">${d.ids.map(mem).join('')}</div></div>`}
    ${own && BD.edit ? `<div class="lp-sec lp-edit"><div class="lp-sh"><b>참가자 편집</b><small>누르면 추가 ↔ 제외 · 빠진 사람의 지망은 지워져요 · ${d.ids.length}명</small><span class="grow"></span><button class="btn ghost xs" data-a="bdEditOpen">닫기</button></div>
      <div class="lp-roster">${S.st.list.map((s) => `<button class="lp-mem ${d.ids.includes(s.id) ? 'done' : ''}" data-a="bdEdit" data-id="${s.id}" style="--lc:${d.ids.includes(s.id) ? '#4fd08b' : '#5a6a84'}">${d.ids.includes(s.id) ? '<i>✓</i>' : '<i class="dot"></i>'}${gname(s.id, s.name)}</button>`).join('')}</div></div>` : ''}
    <div class="lp-grid">${OPTS.map((o) => card(d, o)).join('')}</div>
    ${luckTable()}
    <div class="lp-foot"><div class="lp-count"><b class="mono">${doneN}</b> / <span class="mono">${d.ids.length}</span> 완료<span class="lp-prog"><i style="width:${d.ids.length ? (doneN / d.ids.length) * 100 : 0}%"></i></span><small class="lp-ttl">모두 완료하면 자동으로 추첨이 시작돼요${d.by ? ` · 연 사람 ${esc(d.by)}` : ''}</small></div>
      <div class="lp-act">${myBtn}${ownBtns}</div></div>`;
}
function finalHTML(d) {
  const rk = d.rankOf || {};
  const drawn = new Set((d.steps || []).filter((s) => s.kind === 'roll' && !s.fill).flatMap((s) => s.pick));
  const tag = (id) => (fixOf(d, id) && d.result?.[fixOf(d, id)]?.includes(id) ? '<em class="fx">' + ic('lock', 'ie') + '고정</em>' : rk[id] ? `<em class="r${rk[id]}">${RANK[rk[id] - 1]}${drawn.has(id) ? '·추첨' : ''}</em>` : '<em>배치</em>');
  const cell = (id, side, i) => (id ? `<span class="lf-n ${side}" style="--i:${i}">${esc(nm(id))}${tag(id)}</span>` : '<span class="lf-n empty">빈 자리</span>');
  return `<div class="lp-h"><div><small>RESULT</small><h2>${ic('today')}최종 라인업</h2></div><span class="grow"></span><button class="btn ghost xs" data-a="bdClose" title="닫기">${ic('x')}</button></div>
    <div class="lf"><span></span><b class="blue">BLUE</b><b class="red">RED</b>
      ${LANES.map((l, i) => `<span class="lf-l" style="--lc:${COLOR[l]}">${LANE_ICON[l]}${LANE_NAME[l]}</span>${cell(d.result?.[l]?.[0], 'blue', i * 2)}${cell(d.result?.[l]?.[1], 'red', i * 2 + 1)}`).join('')}</div>
    ${d.ids?.includes(BD.me) ? talkRow(d) : ''}
    ${d.left?.length ? `<p class="mut center">대기: ${d.left.map((x) => esc(nm(x))).join(', ')}</p>` : ''}
    ${(() => { const { win, lose } = luckDelta(d.steps), reset = win.filter((id) => (luckDoc().rid === d.rid ? (luckDoc().last || []).some((c) => c.id === id && c.to === 0) : missOf(id) > 0)); return lose.length || reset.length ? `<p class="lf-luck center">${ic('target')}1지망 보정 · ${lose.length ? `다음 1지망 확률 증가: ${lose.map((x) => { const L = luckDoc(), applied = L.rid === d.rid, c = applied ? (L.last || []).find((y) => y.id === x) : null, max = applied ? c && c.from >= LUCK_MAX : missOf(x) >= LUCK_MAX; return esc(nm(x)) + (max ? '(최대 유지)' : ''); }).join(', ')}` : ''}${lose.length && reset.length ? ' · ' : ''}${reset.length ? `초기화: ${reset.map((x) => esc(nm(x))).join(', ')}` : ''}</p>` : ''; })()}
    <p class="hint center"><em class="lf-tag">N지망</em> 몇 지망으로 들어갔는지 (·추첨: 몰려서 뽑힘) · <em class="lf-tag">배치</em> 상관없음·지망 실패·미지원으로 빈 자리에 들어감 · <em class="lf-tag">${ic('lock', 'ie')}고정</em> 라인 고정으로 추첨 없이 배치 · 진영·자리 교체는 라인업에서 끌어다 놓으면 됩니다</p>
    ${d.ai ? `<p class="lf-ai center">${ic('bolt')}AI 추천 배치 · 점수 <b class="blue">${(+d.ai.bs).toFixed(1)}</b> : <b class="red">${(+d.ai.rs).toFixed(1)}</b> (차이 ${(+d.ai.diff).toFixed(1)})</p>` : ''}
    <div class="lp-foot center">${isOwner(d) ? '' : '<span class="mut sm">AI 추천은 연 사람만 쓸 수 있어요</span>'}${isOwner(d) ? `<button class="btn gold" data-a="bdAi" ${LANES.every((l) => d.result?.[l]?.[0] && d.result?.[l]?.[1]) ? '' : 'disabled title="빈 자리가 있으면 쓸 수 없어요"'}>${ic('bolt')}AI 추천</button>` : ''}<button class="btn pri" data-a="bdLineup">${ic('today')}라인업 확인</button><button class="btn ghost" data-a="bdClose">닫기</button></div>`;
}
// 다시 그리기: 바뀐 게 없으면 화면을 건드리지 않고, 누르고 있는 동안(손가락·마우스가 눌린 사이)에는 미뤘다가 뗀 뒤에 그린다
// (여럿이 동시에 고를 때 누르는 사이에 카드가 새로 그려지면 클릭이 사라져 한 번에 안 눌리던 문제)
function draw() {
  const el = view(), d = cur();
  if (!el || !d || BD.playing === d.rid) return;
  if (BD.hold) { BD.later = true; return; }
  const html = d.status === 'done' ? finalHTML(d) : openHTML(d);
  if (html === BD.html && el.firstElementChild) { BD.prev = { ...(d.picks || {}) }; return; }
  el.classList.remove('drawing');
  if (BD.html && el.firstElementChild) morph(el, html); else el.innerHTML = html;
  BD.html = html;
  BD.prev = { ...(d.picks || {}) };
}
// 바뀐 부분만 바꾸기: 새 화면을 메모리에서 만든 뒤 칸(최대 3단계 안쪽)마다 비교해 달라진 칸만 갈아 끼운다.
// 누가 지원할 때마다 창 전체를 다시 그리면 느린 휴대폰에서 한 번에 수십 ms씩 멈춰서, 여럿이 동시에 고를 때 끊겨 보였다
const keep = (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim());
const attrs = (e) => [...e.attributes].map((a) => a.name + '=' + a.value).join('\u0001');
function morphKids(a, b, depth) {
  const x = [...a.childNodes].filter(keep), y = [...b.childNodes].filter(keep);
  if (x.length !== y.length) { a.replaceChildren(...b.childNodes); return; }
  y.forEach((n, i) => {
    const o = x[i];
    if (n.nodeType === 3 || o.nodeType === 3) { if (n.nodeType !== o.nodeType || n.textContent !== o.textContent) o.replaceWith(n); return; }
    if (o.outerHTML === n.outerHTML) return;
    if (depth > 0 && o.tagName === n.tagName && attrs(o) === attrs(n)) morphKids(o, n, depth - 1); else o.replaceWith(n);
  });
}
function morph(el, html) { const t = document.createElement('template'); t.innerHTML = html; morphKids(el, t.content, 3); }
// 라인 지원 창이 떠 있는 동안 뒤 화면의 움직임(시즌 눈·장식·카드 효과)을 멈춰 고르는 동안 끊기지 않게(body.bd-open, 창을 닫으면 다시 움직임)
{ const mEl = document.getElementById('modal'); if (mEl) new MutationObserver(() => document.body.classList.toggle('bd-open', mEl.classList.contains('on') && !!mEl.querySelector('.lp-sheet'))).observe(mEl, { attributes: true, attributeFilter: ['class'] }); }
for (const [ev, on] of [['pointerdown', 1], ['pointerup', 0], ['pointercancel', 0]]) document.addEventListener(ev, (e) => {
  if (on) { if (e.target.closest?.('#modal.on .lp')) BD.hold = true; return; }
  if (!BD.hold) return;
  BD.hold = false; if (BD.later) { BD.later = false; setTimeout(draw, 0); } // 클릭이 먼저 처리되게 한 박자 뒤
}, true);
function openBoard() {
  const d = cur(); if (!d) return;
  modal('<div class="lp"></div>', 'lp-sheet'); BD.html = '';
  BD.prev = { ...(d.picks || {}) };
  if (d.status === 'play') play(d); else draw();
}

// ---------- 열기·지원 ----------
// 처음 창을 열 때만(비어 있으면) 오늘 내전 모집 참가자(2명 이상) → 배치된 선수 → 최근 내전 참가자 순서로 채운다. 창 안에서 모두 해제하면 빈 채로 둔다
function setup(fresh) {
  const st = S.st, last = st.matches[st.matches.length - 1], rc = recruitIds();
  if (fresh && !BD.sel.length) { const p = placedIds(); BD.sel = rc.length >= 2 ? [...rc] : p.length >= 2 ? p : last ? [...last.blue, ...last.red] : []; }
  const list = [...st.list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const html = `${mh(`${ic('users')}라인 지원 열기`)}
    <p class="mut">오늘 내전에 참가할 사람을 고르세요. 라인 지원을 열면 <b class="good">접속한 모든 사람의 화면에 함께 뜹니다.</b> 각자 원하는 라인을 고르고 <b>선택 완료</b>를 누르면, 모두 완료한 순간 자동으로 추첨해서 라인업에 넣습니다.</p>
    <div class="ph"><b>참가자</b><span class="tag ${BD.sel.length === 10 ? 'ok' : ''}">${BD.sel.length}명</span><span class="grow"></span>${rc.length ? `<button class="btn xs" data-a="bdRecruit">모집 참가자 ${rc.length}명</button>` : ''}${last ? '<button class="btn xs" data-a="bdRecent">최근 내전 참가자</button>' : ''}<button class="btn xs ghost" data-a="bdNone">해제</button></div>
    <div class="chipsel">${list.map((s) => `<button class="${BD.sel.includes(s.id) ? 'on' : ''}" data-a="bdSel" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div>
    <button class="btn pri block big" data-a="bdOpen" ${BD.sel.length >= 2 ? '' : 'disabled'}>${BD.sel.length >= 2 ? `${BD.sel.length}명으로 라인 지원 열기` : '참가자를 2명 이상 고르세요'}</button>`;
  const open = document.querySelector('#modal.on .sheet.lp-setup');
  if (open) { const y = open.querySelector('.chipsel')?.scrollTop || 0; open.innerHTML = html; open.querySelector('.chipsel').scrollTop = y; } else modal(html, 'tall lp-setup');
}
act('tBoard', () => (live(cur()) ? openBoard() : setup(true)));
act('bdSel', (x) => { BD.sel = BD.sel.includes(x.id) ? BD.sel.filter((i) => i !== x.id) : [...BD.sel, x.id]; setup(); });
act('bdRecent', () => { const l = S.st.matches[S.st.matches.length - 1]; if (l) BD.sel = [...l.blue, ...l.red]; setup(); });
act('bdNone', () => { BD.sel = []; setup(); });
act('bdRecruit', () => { const rc = recruitIds(); if (rc.length) BD.sel = [...rc]; setup(); });
act('bdOpen', async () => {
  if (BD.sel.length < 2) return;
  await S.store.syncServerClock?.();
  const d = { rid: Date.now().toString(36) + rnd(1e6).toString(36), status: 'open', at: S.store.serverNow(), ids: [...BD.sel], picks: {}, by: nick() || '익명', owner: cid };
  BD.prev = {};
  bseen = d.rid + d.status; // 내 화면은 직접 연다(내 쓰기가 돌아와도 다시 열지 않게)
  try { await S.store.put('meta', 'board', d); } catch (e) { return toast('게시 실패: ' + (e.code || e.message)); }
  sysChat(`라인 지원이 열렸습니다 · 참가자 ${d.ids.length}명`);
  notify('board', d.rid); // 디스코드 알림
  sfx('start'); openBoard();
});
act('bdMe', (x) => {
  // 이미 다른 기기에서 이 이름으로 고르고 있으면 한 번 확인(실수로 남의 지망을 덮어쓰지 않게). 대리 지원은 확인 후 그대로 가능
  const d = cur(), other = d?.who?.[x.id];
  if (x.id !== BD.me && other && other !== cid && !confirm(`${nm(x.id)} 님은 다른 기기에서 이미 지원 중이에요.\n이 이름으로 대리 지원할까요? (그 사람이 고른 지망을 바꿀 수 있어요)`)) return;
  BD.me = x.id; BD.roster = false; BD.fixing = false; localStorage.setItem('naejeon:bdme:' + S.key, x.id); draw(); });
act('bdRoster', () => { BD.roster = true; draw(); });
act('bdTalk', async (x) => {
  const d = cur(); if (!d || !['open', 'done'].includes(d.status) || !d.ids.includes(BD.me)) return;
  const me = BD.me, rid = d.rid, n = +x.n;
  try {
    await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== rid || !['open', 'done'].includes(r.status)) return null;
      const tk = { ...(tkToday(r) || {}) }, fx = talkFixed(me), now = talkOf(me, r);
      if (x.n === 'fx') delete tk[me]; // 기본(고정값)으로
      else if (now === n) { if (fx) tk[me] = 0; else delete tk[me]; } // 지금 단계를 다시 누르면 오늘은 표시 안 함
      else if (n === fx) delete tk[me]; // 고정값과 같으면 따로 적지 않는다
      else tk[me] = n;
      return { ...r, tk };
    });
  } catch (e) { toast('저장 실패: ' + (e.code || e.message)); }
});
act('bdPick', async (x) => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!live(d)) { toast('2시간 동안 움직임이 없어 라인 지원이 닫혔어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  if (!d.ids.includes(BD.me)) { toast('위쪽 참가자 목록에서 본인 이름을 먼저 눌러 주세요'); view()?.querySelector('.lp-roster')?.classList.add('nudge'); setTimeout(() => view()?.querySelector('.lp-roster')?.classList.remove('nudge'), 900); return; }
  if (fixOf(d, BD.me)) { toast('라인 고정 중이에요. 고정을 풀면 지망을 고를 수 있어요'); return; }
  if (isDone(d, BD.me)) { toast("완료한 뒤에는 바꿀 수 없어요. '다시 고르기'를 누른 뒤 고쳐 주세요"); return; }
  if (x.o !== 'any' && fixN(d, x.o) >= 2 && !prefs(d, BD.me).includes(x.o)) { toast(`${NAME[x.o]} 자리는 고정한 사람으로 이미 꽉 찼어요`); return; }
  const me = BD.me, rid = d.rid;
  // 바로 반영: 저장 결과를 기다리지 않고 내 화면의 지망을 먼저 바꾼다(저장은 누른 순서대로 하나씩)
  const base = myPrefs(d);
  let guess;
  if (base.includes(x.o)) guess = base.filter((v) => v !== x.o);
  else { const lanes = base.filter((v) => v !== 'any'), any = base.includes('any') || x.o === 'any'; guess = [...(x.o === 'any' ? lanes : [...lanes, x.o]), ...(any ? ['any'] : [])]; }
  if (guess.length > 3) { toast('3지망까지 고를 수 있어요. 하나를 빼고 다시 골라 주세요'); return; }
  BD.opt = { rid, p: guess }; BD.optN = (BD.optN || 0) + 1; draw();
  sfx('pick');
  const job = (BD.q || Promise.resolve()).then(() => pickTx(x, me, rid));
  BD.q = job.catch(() => {});
  await job.finally(() => { if (--BD.optN <= 0) { BD.optN = 0; BD.opt = null; draw(); } });
});
async function pickTx(x, me, rid) {
  // 실제 DB(Firestore)에서는 내 칸(picks.내id)만 합쳐 쓰기: 읽기 없이 쓰기 1번, 여럿이 동시에 골라도 서로 다시 시도하지 않음(트랜잭션 충돌 없음)
  // 지망 계산은 내가 보고 있는 최신 상태(+방금 누른 것)로 한다. 체험 모드는 예전처럼 트랜잭션
  if (S.store.mode === 'firebase') {
    const d = cur(); if (!d || d.rid !== rid || d.status !== 'open' || isDone(d, me)) return;
    const curP = BD.sent && BD.sent.rid === rid ? BD.sent.p : prefs(d, me);
    let next;
    if (curP.includes(x.o)) next = curP.filter((v) => v !== x.o);
    else { const lanes = curP.filter((v) => v !== 'any'), any = curP.includes('any') || x.o === 'any'; next = [...(x.o === 'any' ? lanes : [...lanes, x.o]), ...(any ? ['any'] : [])]; }
    if (next.length > 3) return;
    BD.sent = { rid, p: next };
    try { await S.store.patch('meta', 'board', { picks: { [me]: next }, who: { [me]: cid }, upd: S.store.serverNow() }); }
    catch (e) { toast('지원 실패: ' + (e.code || e.message)); }
    finally { if (!BD.optN || BD.optN <= 1) BD.sent = null; }
    return;
  }
  try {
    await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== rid || r.status !== 'open' || isDone(r, me)) return null;
      const picks = { ...(r.picks || {}) }, curP = prefs(r, me);
      let next;
      if (curP.includes(x.o)) next = curP.filter((v) => v !== x.o); // 다시 누르면 빠진다
      else {
        const lanes = curP.filter((v) => v !== 'any'), any = curP.includes('any') || x.o === 'any';
        next = [...(x.o === 'any' ? lanes : [...lanes, x.o]), ...(any ? ['any'] : [])]; // '상관없음'은 항상 마지막
        if (next.length > 3) { toast('3지망까지 고를 수 있어요. 하나를 빼고 다시 골라 주세요'); return null; }
      }
      if (next.length) picks[me] = next; else delete picks[me];
      return { ...r, picks, who: { ...(r.who || {}), [me]: cid }, upd: S.store.serverNow() };
    });
  } catch (e) { toast('지원 실패: ' + (e.code || e.message)); }
}
act('bdDone', async () => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!live(d)) { toast('2시간 동안 움직임이 없어 라인 지원이 닫혔어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  const me = BD.me;
  if (!d.ids.includes(me)) return toast('위쪽 참가자 목록에서 본인 이름을 먼저 눌러 주세요');
  if (!prefs(d, me).length) return toast('라인을 하나 이상 골라 주세요 (상관없음도 돼요)');
  await S.store.syncServerClock?.();
  let res = null;
  try {
    res = await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open' || !prefs(r, me).length) return null;
      const next = { ...r, done: { ...(r.done || {}), [me]: true }, who: { ...(r.who || {}), [me]: cid }, upd: S.store.serverNow() };
      if (!allDone(next)) return next;
      return { ...next, status: 'play', startAt: S.store.serverNow() + 1800, ...plan(next), runner: nick() || '익명' }; // 마지막 완료 → 바로 추첨
    });
  } catch (e) { return toast('완료 실패: ' + (e.code || e.message)); }
  if (!res) return;
  const r = S.store.mode === 'local' ? cur() : res;
  sfx('lock');
  if (r?.status === 'play' && r.rid === d.rid) { BD.runner = r.rid; bseen = r.rid + r.status; play(r); }
});
// 라인 고정/해제: 고정하면 지망을 지우고 완료로 친다(모두 완료되면 바로 추첨). 해제하면 미완료로 돌아간다.
act('bdFixOpen', () => { BD.fixing = !BD.fixing; draw(); });
act('bdFix', async (x) => {
  const d = cur(); if (!d || d.status !== 'open' || !LANES.includes(x.o)) return;
  if (!live(d)) { toast('2시간 동안 움직임이 없어 라인 지원이 닫혔어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  const me = BD.me; if (!d.ids.includes(me)) return toast('위쪽 참가자 목록에서 본인 이름을 먼저 눌러 주세요');
  await S.store.syncServerClock?.();
  let res = null, full = false;
  try {
    res = await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open' || !r.ids.includes(me)) return null;
      if (fixN(r, x.o) >= 2 && fixOf(r, me) !== x.o) { full = true; return null; }
      const picks = { ...(r.picks || {}) }; delete picks[me];
      const next = { ...r, picks, fixed: { ...(r.fixed || {}), [me]: x.o }, done: { ...(r.done || {}), [me]: true }, who: { ...(r.who || {}), [me]: cid }, upd: S.store.serverNow() };
      if (!allDone(next)) return next;
      return { ...next, status: 'play', startAt: S.store.serverNow() + 1800, ...plan(next), runner: nick() || '익명' };
    });
  } catch (e) { return toast('고정 실패: ' + (e.code || e.message)); }
  if (full) return toast(`${NAME[x.o]} 자리는 이미 2명이 고정했어요`);
  if (!res) return;
  BD.fixing = false; sfx('lock'); toast(`${NAME[x.o]} 라인으로 고정했어요`);
  const r = S.store.mode === 'local' ? cur() : res;
  if (r?.status === 'play' && r.rid === d.rid) { BD.runner = r.rid; bseen = r.rid + r.status; play(r); } else draw();
});
act('bdUnfix', async () => {
  const d = cur(); if (!d || d.status !== 'open') return;
  const me = BD.me;
  try {
    await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open' || !fixOf(r, me)) return null;
      const fixed = { ...(r.fixed || {}) }, done = { ...(r.done || {}) }; delete fixed[me]; delete done[me];
      return { ...r, fixed, done, upd: S.store.serverNow() };
    });
  } catch (e) { toast('실패: ' + (e.code || e.message)); }
});
act('bdUndo', async () => {
  const d = cur(); if (!d || d.status !== 'open') return;
  const me = BD.me;
  try {
    await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open' || !isDone(r, me)) return null;
      const done = { ...(r.done || {}) }; delete done[me];
      return { ...r, done, upd: S.store.serverNow() };
    });
  } catch (e) { toast('실패: ' + (e.code || e.message)); }
});
act('bdHide', () => closeModal());
act('bdEditOpen', () => { BD.edit = !BD.edit; draw(); });
// 연 사람·관리자: 진행 중에 참가자 추가/제외(늦게 온 사람 때문에 다시 열지 않아도 되게). 빠진 사람의 지망·고정·완료는 지운다.
// 남은 사람이 모두 완료 상태가 되면 다른 완료와 똑같이 바로 추첨
act('bdEdit', async (x) => {
  const d = cur(); if (!d || d.status !== 'open' || !isOwner(d)) return;
  if (!live(d)) { toast('2시간 동안 움직임이 없어 라인 지원이 닫혔어요. 다시 열어 주세요'); closeModal(); return; }
  const id = x.id, adding = !d.ids.includes(id);
  if (!adding && d.ids.length <= 2) return toast('참가자는 2명 이상이어야 해요');
  if (!adding && (prefs(d, id).length || fixOf(d, id)) && !confirm(`${nm(id)} 님을 빼면 고른 지망이 지워져요. 뺄까요?`)) return;
  await S.store.syncServerClock?.();
  let res = null;
  try {
    res = await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open' || r.ids.includes(id) !== !adding) return null;
      if (!adding && r.ids.length <= 2) return null;
      const drop = (o) => { const n = { ...(o || {}) }; delete n[id]; return n; };
      const next = adding ? { ...r, ids: [...r.ids, id], upd: S.store.serverNow() }
        : { ...r, ids: r.ids.filter((v) => v !== id), picks: drop(r.picks), done: drop(r.done), fixed: drop(r.fixed), who: drop(r.who), upd: S.store.serverNow() };
      if (adding || !allDone(next)) return next;
      return { ...next, status: 'play', startAt: S.store.serverNow() + 1800, ...plan(next), runner: nick() || '익명' };
    });
  } catch (e) { return toast('편집 실패: ' + (e.code || e.message)); }
  if (!res) return;
  toast(adding ? `${nm(id)} 님을 추가했어요` : `${nm(id)} 님을 뺐어요`);
  const r = S.store.mode === 'local' ? cur() : res;
  if (r?.status === 'play' && r.rid === d.rid) { BD.edit = false; BD.runner = r.rid; bseen = r.rid + r.status; play(r); }
});
// 연 사람: 아직 완료하지 않은 사람을 공용 채팅으로 부르기(30초에 한 번)
act('bdNudge', () => {
  const d = cur(); if (!d || d.status !== 'open' || !isOwner(d)) return;
  if (Date.now() - (BD.nudged || 0) < 30e3) return toast('조금 뒤에 다시 부를 수 있어요');
  const w = d.ids.filter((id) => !isDone(d, id)); if (!w.length) return;
  BD.nudged = Date.now();
  sysChat(`🔔 라인 지원: ${w.map(nm).join(', ')} 님의 선택을 기다리고 있어요`);
  toast('공용 채팅으로 불렀어요');
});
act('bdMute', () => { BD.muted = !BD.muted; localStorage.setItem('naejeon:bdmute', BD.muted ? '1' : '0'); document.querySelectorAll('.lp [data-a="bdMute"]').forEach((x) => (x.innerHTML = ic(BD.muted ? 'mute' : 'sound'))); });
act('bdShut', async () => {
  const d = cur(); if (!d) return;
  if (!isOwner(d)) return toast('라인 지원을 연 사람만 취소할 수 있어요');
  if (!confirm('라인 지원을 취소할까요? 지원 내용이 사라집니다.')) return;
  await S.store.put('meta', 'board', { ...d, status: 'closed' }).catch(() => {});
  closeModal();
});
act('bdLineup', () => { closeModal(); go('#/today'); });

// ---------- 추첨 계획: 지망 단계별 추첨 ----------
// 1라운드: 모두 1지망으로. 남은 자리 이하면 바로 확정, 넘치면 무작위로 남은 자리만큼 뽑는다.
// 2·3라운드: 아직 자리가 없는 사람만 2지망 → 3지망으로 넘어가 남은 자리 안에서 같은 방식으로 정한다.
// 라운드마다 라인을 처리하는 순서는 무작위. 끝까지 남은 사람(상관없음·지망 실패·미지원)은 빈 자리에 무작위 배치.
// 블루·레드는 무작위. 이후 교체는 라인업에서 직접 한다.
function plan(d) {
  const P = Object.fromEntries(d.ids.map((id) => [id, prefs(d, id)]));
  const slots = Object.fromEntries(LANES.map((l) => [l, []])), steps = [], rankOf = {}, L = luckDoc();
  let left = [...d.ids];
  // 고정한 사람은 추첨 없이 먼저 그 라인에(한 라인 최대 2명, 넘치면 남는 사람은 일반 배치로)
  for (const id of shuffle(d.ids)) { const l = fixOf(d, id); if (l && slots[l].length < 2) { slots[l].push(id); left = left.filter((x) => x !== id); } }
  for (let r = 0; r < 3; r++) {
    for (const l of shuffle(LANES)) {
      const free = 2 - slots[l].length; if (free <= 0) continue;
      const c = left.filter((id) => P[id][r] === l); if (!c.length) continue;
      const pre = [...slots[l]];
      // 1지망 라운드만 보정 가중치를 쓴다. 쓴 가중치는 단계 기록(w)에 남겨 추첨 장면에서 그대로 보여 준다
      const ws = r === 0 ? c.map((id) => weightOf(missOf(id, L))) : c.map(() => 1);
      const got = c.length <= free ? c : r === 0 ? weightedPick(c, ws, free) : shuffle(c).slice(0, free);
      steps.push({ round: r + 1, lane: l, kind: c.length > free ? 'roll' : 'direct', cands: c, pick: got, pre, ...(r === 0 ? { w: ws } : {}) });
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
  if (!isOwner(d)) return toast('라인 지원을 연 사람만 강제 마감할 수 있어요');
  if (!live(d)) { toast('라인 지원이 만료됐어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  const miss = d.ids.filter((id) => !isDone(d, id)).length;
  if (miss && !confirm(`아직 ${miss}명이 완료를 누르지 않았어요. 지금 고른 지망대로(안 고른 사람은 '상관없음') 강제 마감할까요?`)) return;
  await S.store.syncServerClock?.();
  BD.runner = d.rid; // 내 쓰기가 먼저 돌아와 재생이 시작돼도 내가 라인업을 반영하도록 미리 표시
  let mine = null;
  try {
    mine = await S.store.tx('meta', 'board', (r) => {
      if (!r || r.rid !== d.rid || r.status !== 'open' || !isOwner(r)) return null;
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
    <p class="lp-cap">지망 순서대로, 자리보다 지원자가 많은 라인만 추첨합니다 · 라인 순서는 무작위 · 이름 옆 숫자는 뽑힐 확률(1지망은 보정 반영)</p>
    <div class="ld">${steps.map((s) => `<div class="ld-row" data-lane="${s.lane}" style="--lc:${COLOR[s.lane]}">
      <div class="ld-lane"><i class="lp-ico">${LANE_ICON[s.lane]}</i><b>${LANE_NAME[s.lane]}</b><small>${RANK[(s.round || 1) - 1]} · ${s.cands.length}명 중 ${s.pick.length}명</small></div>
      <div class="ld-cands">${(s.pre || []).map((id) => `<span class="ld-c won pre" title="이미 확정(라인 고정 또는 앞 라운드)">${esc(nm(id))}</span>`).join('')}${(() => { const ws = Array.isArray(s.w) && s.w.length === s.cands.length ? s.w : s.cands.map(() => 1), pr = inclusion(ws, s.pick.length); return s.cands.map((id, i) => `<span class="ld-c" data-id="${id}">${esc(nm(id))}<small class="ld-p">${pctTxt(pr[i])}${ws[i] > 1 ? ` · ${xw(ws[i])}` : ''}</small></span>`).join(''); })()}</div></div>`).join('')}</div>`;
}
function finish(el, d) {
  clearTimers();
  BD.playing = '';
  if (!el || !document.body.contains(el)) return;
  el.classList.remove('drawing');
  const c = cur(); el.innerHTML = finalHTML(c && c.rid === d.rid ? c : d); // 그사이 AI 추천으로 바뀌었으면 최신 배치로
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
  // 서버 시각은 접속할 때 미리 맞추지 않으므로, 다른 사람이 시작한 추첨을 볼 때 여기서 맞춘다(모두 같은 순간에 같은 장면).
  // 시작까지 1.8초 여유가 있어 보통 기다림이 느껴지지 않고, 늦게 들어온 사람도 진행 중인 위치부터 정확히 보인다.
  if (!S.store.serverClockReady?.()) { await S.store.clockSoon?.(1500); if (BD.playing !== d.rid) return; }
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
// AI 추천: 라인별 두 사람은 그대로 두고 블루/레드만 점수 차이가 가장 작게 다시 나눈다(높은 원딜·높은 서폿은 같은 팀 안 됨).
// 결과는 meta/board에 적어 모든 화면에 같이 보이고, 라인업에 이미 반영됐으면 라인업도 바꾼다.
act('bdAi', async () => {
  const d = cur(); if (!d?.result) return;
  if (!isOwner(d)) return toast('라인 지원을 연 사람만 AI 추천을 적용할 수 있어요');
  const r = aiBalance(LANES.map((l) => [d.result[l]?.[0], d.result[l]?.[1]]), S.st);
  if (!r) return toast('빈 자리가 있으면 AI 추천을 쓸 수 없어요');
  const result = Object.fromEntries(LANES.map((l, i) => [l, [r.blue[i], r.red[i]]]));
  const ai = { bs: r.bs, rs: r.rs, diff: r.diff };
  let next = null;
  try { next = await S.store.tx('meta', 'board', (x) => (x && x.rid === d.rid && isOwner(x) ? { ...x, result, ai } : null)); } catch (e) { return toast('AI 추천 실패: ' + (e.code || e.message)); }
  if (!next) return;
  if (S.store.mode === 'local') next = cur(); // 체험 모드의 tx는 true/false만 돌려준다
  if (next.status === 'done') { setDraftTeams(r.blue, r.red); if (S.page === 'today') refresh(); }
  const el = view(); if (el && BD.playing !== d.rid) { el.classList.remove('drawing'); el.innerHTML = finalHTML(next); }
  sfx('lock'); burst(innerWidth / 2, innerHeight / 3, 80);
  toast(r.swaps ? `AI 추천 배치 · 점수 차 ${r.diff.toFixed(1)}` : `이미 가장 균형 잡힌 배치예요 · 점수 차 ${r.diff.toFixed(1)}`);
  sysChat(`AI 추천 배치 · 블루 ${r.blue.map(nm).join('/')} vs 레드 ${r.red.map(nm).join('/')} (점수 차 ${r.diff.toFixed(1)})`);
});
act('bdSkip', () => { BD.skipped = true; finish(view(), BD.d || cur()); });
act('bdClose', () => closeModal());
// 1지망 결과로 보정 횟수를 고친다: 1지망 라인에 들어간 사람 → 0, 1지망 추첨에서 떨어진 사람 → +1(최대 3).
// 같은 판을 두 번 반영하지 않게 meta/luck.rid 에 마지막으로 반영한 판을 적는다. 고정·상관없음·1지망 없음은 그대로.
export function luckDelta(steps) {
  const win = new Set(), lose = new Set();
  for (const s of steps || []) {
    if (s.round !== 1 || s.fill) continue;
    s.pick.forEach((id) => win.add(id));
    s.cands.filter((id) => !s.pick.includes(id)).forEach((id) => lose.add(id));
  }
  return { win: [...win], lose: [...lose].filter((id) => !win.has(id)) };
}
async function applyLuck(d) {
  const { win, lose } = luckDelta(d.steps);
  if (!win.length && !lose.length) return;
  try {
    await S.store.tx('meta', 'luck', (x) => {
      if (x?.rid === d.rid) return null;
      const miss = { ...(x?.miss || {}) }, changes = [];
      for (const id of win) { const from = missOf(id, x || {}); if (from) changes.push({ id, from, to: 0 }); delete miss[id]; }
      for (const id of lose) { const from = missOf(id, x || {}), to = Math.min(LUCK_MAX, from + 1); miss[id] = to; changes.push({ id, from, to }); }
      return { ...(x || {}), miss, rid: d.rid, at: S.store.serverNow(), last: changes };
    });
  } catch (e) { console.warn('[luck]', e); }
}
async function finishRun(d) { // 'play'→'done'을 먼저 바꾼 한 사람만 라인업에 반영한다(중복 반영·중복 채팅 방지)
  let ok = false;
  try { ok = await S.store.tx('meta', 'board', (r) => (r && r.rid === d.rid && r.status === 'play' ? { ...r, status: 'done' } : null)); } catch { return; }
  if (!ok) return;
  const latest = S.store.mode === 'local' ? cur() : ok; // 추첨 재생 중에 AI 추천으로 진영이 바뀌었으면 그 결과를 쓴다
  if (latest?.rid === d.rid && latest.result) d = latest;
  const blue = LANES.map((l) => d.result[l]?.[0] || ''), red = LANES.map((l) => d.result[l]?.[1] || '');
  setDraftTeams(blue, red);
  if (S.page === 'today') refresh();
  await applyLuck(d);
  sysChat('라인 지원 결과 · ' + LANES.map((l) => `${LANE_NAME[l]} ${d.result[l].map(nm).join('/') || '-'}`).join(' · '));
}

// ---------- 다른 사람의 게시판 받기 ----------
let bseen = null;
let tseen = '';
function onBoard(d) {
  const k = d ? d.rid + d.status : '';
  const tk = d ? d.rid + JSON.stringify(d.tk || {}) : ''; // 소통 표시가 바뀌면 오늘의 내전 라인업도 다시 그림
  if (tk !== tseen) { const was = tseen; tseen = tk; if (was && k === bseen && S.page === 'today') refresh(); }
  if (bseen === null) { bseen = k; return; }
  if (k === bseen) { if (d?.status === 'open' || (d?.status === 'done' && view())) draw(); return; }
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
  // 문서를 따로 구독하지 않는다: meta 컬렉션 구독(app.js)이 바뀔 때마다 이 함수를 불러 준다(같은 변경을 두 번 읽지 않게)
}
// 열어 둔 화면에서도 시간이 지나 만료되면 '라인 지원 중' 버튼 표시를 끈다(1분마다 확인)
let liveWas = null;
setInterval(() => { if (!S.store) return; const l = boardLive(); if (liveWas !== null && l !== liveWas && S.page === 'today') refresh(); liveWas = l; }, 60e3);
