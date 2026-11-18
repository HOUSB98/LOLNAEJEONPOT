// 라인 지원: 참가자가 원하는 라인(탑~서폿·상관없음)을 직접 고르고 '선택 완료'를 누른다. 모두 완료하면 자동으로 추첨이 시작되고,
// 2명 넘게 몰린 라인은 무작위로 2명을 뽑아 라인업에 넣는다. 연 사람·관리자는 취소하거나 강제 마감할 수 있다.
// meta/board 문서 하나로 모든 접속자가 같은 지원 현황과 같은 추첨 장면을 같은 시각에 본다(시작 시각은 서버 시계 기준).
import { S, act, isAdmin, esc, modal, closeModal, mh, toast, burst, refresh, ic, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
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
function card(d, o) {
  const rankN = [0, 1, 2].map((r) => d.ids.filter((id) => !fixOf(d, id) && prefs(d, id)[r] === o).length), n = rankN[0];
  const fx = o === 'any' ? 0 : fixN(d, o), cap = 2 - fx, full = o !== 'any' && cap <= 0;
  const prevN = Object.values(BD.prev).filter((v) => (Array.isArray(v) ? v[0] : v) === o).length;
  const myRank = BD.me ? prefs(d, BD.me).indexOf(o) : -1;
  const state = o === 'any' ? '' : full ? '<span class="lp-st fix">고정으로 마감</span>' : n > cap ? `<span class="lp-st hot">1지망 ${n - cap}명 초과 · 추첨</span>` : n === cap ? '<span class="lp-st ok">딱 맞음</span>' : `<span class="lp-st low">${cap - n}자리 남음</span>`;
  return `<button class="lp-card ${myRank >= 0 ? 'mine' : ''} ${o === 'any' ? 'any' : ''} ${full ? 'full' : ''}" data-a="bdPick" data-o="${o}" style="--lc:${COLOR[o]}" ${d.status !== 'open' || (BD.me && isDone(d, BD.me)) ? 'disabled' : ''}>
    <span class="lp-ch"><i class="lp-ico">${icon(o)}</i><b>${NAME[o]}</b>${myRank >= 0 ? `<em class="r${myRank + 1}">${RANK[myRank]}</em>` : ''}</span>
    <span class="lp-meta">${o === 'any' ? '빈 자리에 배치' : '모집 2명'}${fx ? `<span class="lp-fx">🔒 고정 ${fx}</span>` : ''}${state}</span>
    <span class="lp-bar"><i style="width:${o === 'any' ? 0 : Math.min(100, (fx + n) * 50)}%"></i></span>
    <span class="lp-cnt ${n !== prevN ? 'bump' : ''}"><small>1지망</small><b class="mono">${n}</b>명<i class="lp-dots">${Array.from({ length: fx }, () => '<u class="fx" title="고정"></u>').join('')}${Array.from({ length: Math.max(n, o === 'any' ? 0 : cap) }, (_, i) => `<u class="${i < n ? 'on' : ''}"></u>`).join('')}</i></span>
    <span class="lp-sub">2지망 <b>${rankN[1]}</b> · 3지망 <b>${rankN[2]}</b></span>
  </button>`;
}
// 내 1지망 당첨 확률(나에게만 보인다): 지금 그 라인 1지망 인원·보정 기준, 누가 고르거나 바꿀 때마다 다시 계산
function chanceHTML(d, id) {
  const m = missOf(id), w = weightOf(m), c = firstChance(d, id);
  const boost = m ? `보정 ${m}단계 · 가중치 ${xw(w)}` : '보정 없음';
  if (!c) return `<span class="lp-chance"><b>${boost}</b><small>${prefs(d, id)[0] === 'any' ? '1지망이 상관없음이라 1지망 추첨이 없어요' : '1지망을 고르면 당첨 확률이 보여요'}</small></span>`;
  const tag = c.n <= c.free ? '경쟁 없음 · 확정' : `${c.n}명 중 ${c.free}명`;
  return `<span class="lp-chance" style="--lc:${COLOR[c.lane]}">1지망 ${icon(c.lane)}${NAME[c.lane]} 당첨 확률 <b class="mono">${pctTxt(c.p)}</b><small>${tag} · ${boost}</small></span>`;
}
// 보정 현황(모두에게 보인다): 누가 어느 라인을 골랐는지는 없고 떨어진 횟수와 가중치만
function luckTable() {
  const L = luckDoc(), rows = Object.keys(L.miss || {}).filter((id) => missOf(id, L) && S.st.P[id]).sort((a, b) => missOf(b, L) - missOf(a, L) || nm(a).localeCompare(nm(b), 'ko'));
  return `<details class="lp-luckt"><summary>${ic('target')}<b>1지망 보정 현황</b><small>${rows.length ? `${rows.length}명 보정 중` : '보정 중인 사람 없음'}</small></summary>
    <p class="hint">1지망 추첨에서 떨어질 때마다 다음 1지망 추첨 가중치가 +50%씩 올라가요(최대 3번 · ×2.5). 1지망에 들어가면 0으로 돌아가요. 2·3지망 추첨과 빈 자리 배치는 모두 같은 확률이에요.</p>
    ${rows.length ? `<div class="lp-lrows">${rows.map((id) => `<span class="lp-lr"><b>${esc(nm(id))}</b><small>${missOf(id, L)}번 떨어짐</small><em class="mono">${xw(weightOf(missOf(id, L)))}</em></span>`).join('')}</div>` : ''}</details>`;
}
function openHTML(d) {
  const doneN = d.ids.filter((id) => isDone(d, id)).length, isMe = d.ids.includes(BD.me), mine = isMe ? prefs(d, BD.me) : [], meDone = isMe && isDone(d, BD.me), own = isOwner(d);
  const myFix = isMe ? fixOf(d, BD.me) : '';
  const mem = (id) => {
    const p = prefs(d, id)[0], me = id === BD.me, ok = isDone(d, id);
    const st = ok ? 'done' : p ? 'ok' : '';
    return `<button class="lp-mem ${me ? 'me' : ''} ${st}" data-a="bdMe" data-id="${id}" style="--lc:${ok ? '#4fd08b' : p ? '#d9a441' : '#5a6a84'}" title="${ok ? '선택 완료' : p ? '고르는 중 (아직 완료 안 누름)' : '아직 안 고름'}">${ok ? '<i>✓</i>' : p ? `<i>${me ? icon(p) : '…'}</i>` : '<i class="dot"></i>'}${esc(nm(id))}${missOf(id) ? `<b class="lp-luck" title="1지망 추첨에서 ${missOf(id)}번 연속 떨어져 1지망 당첨 가중치 ${xw(weightOf(missOf(id)))}">${xw(weightOf(missOf(id)))}</b>` : ''}</button>`;
  };
  const myBtn = !isMe ? '<span class="lp-wait">본인 이름을 먼저 눌러 주세요</span>'
    : myFix ? `<button class="btn ghost" data-a="bdUnfix">🔓 고정 해제</button>`
    : meDone ? `<button class="btn ghost" data-a="bdUndo">${ic('edit')}다시 고르기</button>`
    : `<button class="btn pri lp-done" data-a="bdDone" ${mine.length ? '' : 'disabled title="라인을 하나 이상 고르세요 (상관없음도 가능)"'}>✓ 선택 완료</button>`;
  const ownBtns = own ? `<div class="lp-own"><button class="btn ghost xs" data-a="bdShut">취소하기</button><button class="btn ghost xs" data-a="bdGo" ${d.ids.some((id) => prefs(d, id).length) ? '' : 'disabled'}>${ic('dice')}강제 마감</button></div>` : '';
  return `<div class="lp-h"><div><small><i class="live"></i>LIVE · 모두 같은 화면</small><h2>${ic('users')}라인 지원</h2></div><span class="grow"></span>
      <button class="btn ghost xs" data-a="bdMute" title="효과음">${ic(BD.muted ? 'mute' : 'sound')}</button><button class="btn ghost xs" data-a="bdHide" title="닫기 (라인 지원은 계속 열려 있음)">${ic('x')}</button></div>
    <ol class="lp-steps"><li class="${isMe ? 'done' : 'on'}">내 이름 선택</li><li class="${isMe ? (mine.length ? 'done' : 'on') : ''}">라인 1~3지망 선택</li><li class="${meDone ? 'done' : isMe && mine.length ? 'on' : ''}">선택 완료 누르기</li><li>모두 완료 → 자동 추첨</li></ol>
    ${isMe && myFix ? `<div class="lp-my locked"><b>${esc(nm(BD.me))}</b><span class="lp-rk on" style="--lc:${COLOR[myFix]}"><small>🔒 고정</small>${icon(myFix)}${NAME[myFix]}</span><small class="mut">이 라인으로 고정돼 추첨 없이 배치돼요 · 다른 사람에게는 '고정 1'처럼 숫자만 보여요</small></div>` : ''}
    ${isMe && !myFix && !meDone ? `<div class="lp-fixrow">${BD.fixing ? `<span class="lp-fxq">🔒 고정할 라인</span>${LANES.map((l) => `<button class="btn xs lp-fxb" data-a="bdFix" data-o="${l}" style="--lc:${COLOR[l]}" ${fixN(d, l) >= 2 ? 'disabled title="이미 2명이 고정했어요"' : ''}>${icon(l)}${NAME[l]}</button>`).join('')}<button class="btn ghost xs" data-a="bdFixOpen">취소</button>` : '<button class="btn ghost xs lp-fxopen" data-a="bdFixOpen" title="오늘 이 라인으로 가기로 정해졌으면 고정하세요">🔒 라인 고정</button>'}</div>` : ''}
    ${isMe && !myFix ? `<div class="lp-my ${meDone ? 'locked' : ''}"><b>${esc(nm(BD.me))}</b>의 지망${[0, 1, 2].map((r) => `<span class="lp-rk ${mine[r] ? 'on' : ''}" style="--lc:${mine[r] ? COLOR[mine[r]] : '#3a4a64'}"><small>${RANK[r]}</small>${mine[r] ? `${icon(mine[r])}${NAME[mine[r]]}` : '—'}</span>`).join('')}<small class="mut">${meDone ? '완료했어요 · 바꾸려면 아래 \'다시 고르기\'' : '카드를 누른 순서대로 1·2·3지망 · 다시 누르면 빠져요'}</small>${chanceHTML(d, BD.me)}</div>` : ''}
    ${isMe && !BD.roster ? `<div class="lp-sec lp-mini"><span>${ic('user')}<b>${esc(nm(BD.me))}</b>(으)로 지원 중</span><button class="btn ghost xs" data-a="bdRoster">참가자 현황 · 대리 지원</button></div>`
      : `<div class="lp-sec"><div class="lp-sh"><b>참가자</b><small>${isMe ? `<b>${esc(nm(BD.me))}</b>(으)로 지원 중 · 다른 이름을 누르면 대리 지원` : '본인 이름을 눌러 주세요'}</small></div>
      <div class="lp-roster">${d.ids.map(mem).join('')}</div></div>`}
    <div class="lp-grid">${OPTS.map((o) => card(d, o)).join('')}</div>
    ${luckTable()}
    <div class="lp-foot"><div class="lp-count"><b class="mono">${doneN}</b> / <span class="mono">${d.ids.length}</span> 완료<span class="lp-prog"><i style="width:${d.ids.length ? (doneN / d.ids.length) * 100 : 0}%"></i></span><small class="lp-ttl">모두 완료하면 자동으로 추첨이 시작돼요${d.by ? ` · 연 사람 ${esc(d.by)}` : ''}</small></div>
      <div class="lp-act">${myBtn}${ownBtns}</div></div>`;
}
function finalHTML(d) {
  const rk = d.rankOf || {};
  const drawn = new Set((d.steps || []).filter((s) => s.kind === 'roll' && !s.fill).flatMap((s) => s.pick));
  const tag = (id) => (fixOf(d, id) && d.result?.[fixOf(d, id)]?.includes(id) ? '<em class="fx">🔒 고정</em>' : rk[id] ? `<em class="r${rk[id]}">${RANK[rk[id] - 1]}${drawn.has(id) ? '·추첨' : ''}</em>` : '<em>배치</em>');
  const cell = (id, side, i) => (id ? `<span class="lf-n ${side}" style="--i:${i}">${esc(nm(id))}${tag(id)}</span>` : '<span class="lf-n empty">빈 자리</span>');
  return `<div class="lp-h"><div><small>RESULT</small><h2>${ic('today')}최종 라인업</h2></div><span class="grow"></span><button class="btn ghost xs" data-a="bdClose" title="닫기">${ic('x')}</button></div>
    <div class="lf"><span></span><b class="blue">BLUE</b><b class="red">RED</b>
      ${LANES.map((l, i) => `<span class="lf-l" style="--lc:${COLOR[l]}">${LANE_ICON[l]}${LANE_NAME[l]}</span>${cell(d.result?.[l]?.[0], 'blue', i * 2)}${cell(d.result?.[l]?.[1], 'red', i * 2 + 1)}`).join('')}</div>
    ${d.left?.length ? `<p class="mut center">대기: ${d.left.map((x) => esc(nm(x))).join(', ')}</p>` : ''}
    ${(() => { const { win, lose } = luckDelta(d.steps), reset = win.filter((id) => (luckDoc().rid === d.rid ? (luckDoc().last || []).some((c) => c.id === id && c.to === 0) : missOf(id) > 0)); return lose.length || reset.length ? `<p class="lf-luck center">${ic('target')}1지망 보정 · ${lose.length ? `다음 1지망 확률 증가: ${lose.map((x) => { const L = luckDoc(), applied = L.rid === d.rid, c = applied ? (L.last || []).find((y) => y.id === x) : null, max = applied ? c && c.from >= LUCK_MAX : missOf(x) >= LUCK_MAX; return esc(nm(x)) + (max ? '(최대 유지)' : ''); }).join(', ')}` : ''}${lose.length && reset.length ? ' · ' : ''}${reset.length ? `초기화: ${reset.map((x) => esc(nm(x))).join(', ')}` : ''}</p>` : ''; })()}
    <p class="hint center"><em class="lf-tag">N지망</em> 몇 지망으로 들어갔는지 (·추첨: 몰려서 뽑힘) · <em class="lf-tag">배치</em> 상관없음·지망 실패·미지원으로 빈 자리에 들어감 · <em class="lf-tag">🔒 고정</em> 라인 고정으로 추첨 없이 배치 · 진영·자리 교체는 라인업에서 끌어다 놓으면 됩니다</p>
    ${d.ai ? `<p class="lf-ai center">${ic('bolt')}AI 추천 배치 · 점수 <b class="blue">${(+d.ai.bs).toFixed(1)}</b> : <b class="red">${(+d.ai.rs).toFixed(1)}</b> (차이 ${(+d.ai.diff).toFixed(1)})</p>` : ''}
    <div class="lp-foot center">${isOwner(d) ? '' : '<span class="mut sm">AI 추천은 연 사람만 쓸 수 있어요</span>'}${isOwner(d) ? `<button class="btn gold" data-a="bdAi" ${LANES.every((l) => d.result?.[l]?.[0] && d.result?.[l]?.[1]) ? '' : 'disabled title="빈 자리가 있으면 쓸 수 없어요"'}>${ic('bolt')}AI 추천</button>` : ''}<button class="btn pri" data-a="bdLineup">${ic('today')}라인업 확인</button><button class="btn ghost" data-a="bdClose">닫기</button></div>`;
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
    <p class="mut">오늘 내전에 참가할 사람을 고르세요. 라인 지원을 열면 <b class="good">접속한 모든 사람의 화면에 함께 뜹니다.</b> 각자 원하는 라인을 고르고 <b>선택 완료</b>를 누르면, 모두 완료한 순간 자동으로 추첨해서 라인업에 넣습니다.</p>
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
  const d = { rid: Date.now().toString(36) + rnd(1e6).toString(36), status: 'open', at: S.store.serverNow(), ids: [...BD.sel], picks: {}, by: nick() || '익명', owner: cid };
  BD.prev = {};
  bseen = d.rid + d.status; // 내 화면은 직접 연다(내 쓰기가 돌아와도 다시 열지 않게)
  try { await S.store.put('meta', 'board', d); } catch (e) { return toast('게시 실패: ' + (e.code || e.message)); }
  sysChat(`라인 지원이 열렸습니다 · 참가자 ${d.ids.length}명`);
  notify('board', d.rid); // 디스코드 알림
  sfx('start'); openBoard();
});
act('bdMe', (x) => { BD.me = x.id; BD.roster = false; BD.fixing = false; localStorage.setItem('naejeon:bdme:' + S.key, x.id); draw(); });
act('bdRoster', () => { BD.roster = true; draw(); });
act('bdPick', async (x) => {
  const d = cur(); if (!d || d.status !== 'open') return;
  if (!live(d)) { toast('2시간 동안 움직임이 없어 라인 지원이 닫혔어요. 다시 열어 주세요'); closeModal(); if (S.page === 'today') refresh(); return; }
  if (!d.ids.includes(BD.me)) { toast('위쪽 참가자 목록에서 본인 이름을 먼저 눌러 주세요'); view()?.querySelector('.lp-roster')?.classList.add('nudge'); setTimeout(() => view()?.querySelector('.lp-roster')?.classList.remove('nudge'), 900); return; }
  if (fixOf(d, BD.me)) { toast('라인 고정 중이에요. 고정을 풀면 지망을 고를 수 있어요'); return; }
  if (isDone(d, BD.me)) { toast("완료한 뒤에는 바꿀 수 없어요. '다시 고르기'를 누른 뒤 고쳐 주세요"); return; }
  if (x.o !== 'any' && fixN(d, x.o) >= 2 && !prefs(d, BD.me).includes(x.o)) { toast(`${NAME[x.o]} 자리는 고정한 사람으로 이미 꽉 찼어요`); return; }
  const me = BD.me, rid = d.rid;
  sfx('pick');
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
      return { ...r, picks, upd: S.store.serverNow() };
    });
  } catch (e) { toast('지원 실패: ' + (e.code || e.message)); }
});
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
      const next = { ...r, done: { ...(r.done || {}), [me]: true }, upd: S.store.serverNow() };
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
      const next = { ...r, picks, fixed: { ...(r.fixed || {}), [me]: x.o }, done: { ...(r.done || {}), [me]: true }, upd: S.store.serverNow() };
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
act('bdMute', () => { BD.muted = !BD.muted; localStorage.setItem('naejeon:bdmute', BD.muted ? '1' : '0'); document.querySelectorAll('.lp [data-a="bdMute"]').forEach((x) => (x.innerHTML = ic(BD.muted ? 'mute' : 'sound'))); });
act('bdShut', async () => {
  const d = cur(); if (!d) return;
  if (!isOwner(d)) return toast('라인 지원을 연 사람만 취소할 수 있어요');
  if (!confirm('라인 지원을 취소할까요? 지원 내용이 사라집니다.')) return;
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
function onBoard(d) {
  const k = d ? d.rid + d.status : '';
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
