// 팀 경매: 팀장이 한정 포인트로 선수를 한 명씩 입찰. 타이머·입찰은 DB 트랜잭션으로 모든 접속자에게 동기화된다.
import { S, page, act, esc, uid, col, pname, go, refresh, toast, needAdmin, ic, champIcon, sigChamp, LANES, LANE_NAME, LANE_ICON, LANE_COLOR } from './core.js';
import { dayKey } from './stats.js';
import { setDraftTeams } from './today.js';
import { sendLobbyChat } from './social.js';

const AU = { name: '', role: {}, points: 1000, unit: 10, sec: 20, ext: 8, hcap: {}, hide: true, chat: '', amt: '', as: 0 };
const LOT_START_DELAY_MS = 15_000;
const tok = () => uid() + uid();
const hostKey = (id) => `naejeon:auhost:${S.key}:${id}`;
const room = (id) => S.store.data.auctions?.[id];
const say = (r, s) => { r.log = [...(r.log || []), { t: Date.now(), s }].slice(-40); };
const openTeams = (r) => r.teams.map((t, i) => i).filter((i) => r.teams[i].members.length < r.cfg.size - 1);
const nm = (id) => S.st.P[id]?.name || '?';

function finish(r) { r.status = 'done'; r.cur = null; say(r, '🏁 경매가 끝났습니다.'); return r; }
function nextItem(r, now) {
  let open = openTeams(r);
  if (!open.length) return finish(r);
  if (!r.pool.length && r.unsold.length && r.round < 2) { r.pool = r.unsold; r.unsold = []; r.round++; say(r, '🔁 유찰된 선수를 다시 경매합니다.'); }
  if (open.length === 1 || !r.pool.length) {
    const left = [...r.pool, ...r.unsold]; r.pool = []; r.unsold = [];
    while (left.length && (open = openTeams(r)).length) {
      const ti = open.sort((a, b) => r.teams[b].points - r.teams[a].points || r.teams[a].members.length - r.teams[b].members.length)[0];
      const pid = left.shift(); r.teams[ti].members.push({ pid, price: 0 }); say(r, `🎁 ${nm(pid)} → ${r.teams[ti].name} (자동 배정)`);
    }
    r.unsold = left;
    return finish(r);
  }
  r.cur = { pid: r.pool.shift(), bid: 0, team: -1, startsAt: now + LOT_START_DELAY_MS, endsAt: now + LOT_START_DELAY_MS + r.cfg.sec * 1000 };
  return r;
}
function settle(r, now) {
  const c = r.cur;
  if (c.team >= 0) { const t = r.teams[c.team]; t.points -= c.bid; t.members.push({ pid: c.pid, price: c.bid }); say(r, `✅ ${nm(c.pid)} → ${t.name} · ${c.bid}P 낙찰`); }
  else { r.unsold.push(c.pid); say(r, `💨 ${nm(c.pid)} 유찰`); }
  return nextItem(r, now);
}
const tx = (id, fn) => S.store.tx('auctions', id, (r) => (r && !r.deleted ? fn(JSON.parse(JSON.stringify(r)), Date.now()) : null)).catch((e) => { toast('오류: ' + (e.code || e.message)); return false; });

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
  return `<h1>🔨 팀 경매</h1>
  <p class="hint">팀장이 한정된 포인트로 팀원을 한 명씩 입찰해 팀을 짭니다. 방을 만들면 팀장별 링크가 나오고, 모든 참가자가 같은 화면을 실시간으로 봅니다.</p>
  ${rooms.length ? `<div class="panel"><div class="ph"><b>경매 방</b></div>${rooms.map((r) => `<a class="kv link" href="#/auction/${r.id}"><span>${esc(r.name)} <small class="mut">${new Date(r.createdAt).toLocaleDateString('ko')}</small></span><b>${{ lobby: '대기 중', running: '🔴 진행 중', paused: '일시정지', done: '완료' }[r.status]} · ${r.teams.length}팀</b></a>`).join('')}</div>` : ''}
  <h2>새 경매 만들기</h2>
  <div class="panel">
    <label class="fld"><span>방 이름</span><input id="auName" class="inp" value="${esc(AU.name)}" placeholder="예: 11월 2주차 내전" data-i="auF" data-k="name"></label>
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
      <label class="fld"><span>경매 시간(초)</span><input id="auS" class="inp" type="number" value="${AU.sec}" data-i="auF" data-k="sec"></label>
      <label class="fld"><span>입찰 시 최소 남은 시간(초)</span><input id="auE" class="inp" type="number" value="${AU.ext}" data-i="auF" data-k="ext"></label>
    </div>
    <label class="mini"><input type="checkbox" data-c="auHide" ${AU.hide ? 'checked' : ''}> 경매 순서 비공개 (무작위)</label>
    <button class="btn pri block big" data-a="auCreate">경매 방 만들기</button>
  </div>`;
}

function roomView(id, token) {
  const r = room(id), st = S.st;
  if (!r || r.deleted || r.status === 'deleted') return `<div class="panel empty">이 경매 방은 삭제되어 더 이상 참여할 수 없습니다. <a href="#/auction">경매 목록으로</a></div>`;
  const me = myRole(r, token), c = r.cur, base = location.origin + location.pathname + location.search + '#/auction/' + r.id;
  const bidTeam = me.host ? Math.min(AU.as, r.teams.length - 1) : me.team;
  const info = (pid) => { const s = st.P[pid]; return s ? `<div class="item"><div class="ov big"><b>${s.ovr}</b><small>OVR</small></div><div><h1>${esc(s.name)}</h1><div class="mut">${LANE_ICON[s.mainLane]} ${LANE_NAME[s.mainLane]} · ${esc(s.p.soloTier || '티어 정보 없음')} · ${s.g ? `내전 ${s.wr}% (${s.g}판)` : '내전 기록 없음'}</div>
      <div class="lanes5 sm">${LANES.map((l) => `<div class="${l === s.mainLane ? 'main' : ''}"><small>${LANE_ICON[l]}</small><b>${s.p.scores?.[l] ?? 0}</b></div>`).join('')}</div></div></div>` : ''; };
  const teams = r.teams.map((t, i) => `<div class="panel ateam ${c && c.team === i ? 'lead' : ''} ${me.team === i ? 'mine' : ''}">
    <div class="ph"><b>${esc(t.name)}</b>${me.team === i ? '<span class="tag ok">내 팀</span>' : ''}<span class="grow"></span><b class="pts">${t.points}P</b></div>
    <div class="kv"><span>👑 ${pname(t.captain)}</span><small class="mut">팀장</small></div>
    ${t.members.map((m) => `<div class="kv"><span>${pname(m.pid)} <small class="mut">${LANE_ICON[st.P[m.pid]?.mainLane] || ''}</small></span><b>${m.price}P</b></div>`).join('')}
    ${Array(Math.max(0, r.cfg.size - 1 - t.members.length)).fill('<div class="kv emp"><span>빈 자리</span></div>').join('')}</div>`).join('');
  let stage = '';
  if (r.status === 'lobby') {
    stage = `<div class="panel stage"><h2>대기 중</h2><p class="mut">팀장에게 각자의 링크를 보내고, 모두 들어오면 시작하세요.</p>
      ${me.host ? `<div class="links"><div class="kv"><span>👀 관전 링크</span><span class="grow"></span><button class="btn xs" data-a="auCopy" data-u="${esc(base)}">복사</button><button class="btn xs" data-a="auSendLink" data-u="${esc(base)}" data-label="관전 링크">채팅 전송</button></div>
        ${r.teams.map((t) => `<div class="kv"><span>👑 ${pname(t.captain)} 팀장 링크</span><span class="grow"></span><button class="btn xs" data-a="auCopy" data-u="${esc(base + '/' + t.token)}">복사</button><button class="btn xs" data-a="auSendLink" data-u="${esc(base + '/' + t.token)}" data-label="${esc(nm(t.captain) + ' 팀장 링크')}">채팅 전송</button></div>`).join('')}</div>
        <button class="btn pri block big" data-a="auStart" data-id="${r.id}">▶ 경매 시작</button>` : `<p>${me.team >= 0 ? `👑 <b>${esc(r.teams[me.team].name)}</b> 팀장으로 접속했습니다. 진행자가 시작하면 입찰할 수 있습니다.` : '👀 관전 중입니다.'}</p>`}</div>`;
  } else if (r.status === 'done') {
    stage = `<div class="panel stage"><h2>🏁 경매 완료</h2>${r.unsold.length ? `<p class="mut">예비: ${r.unsold.map(pname).join(', ')}</p>` : ''}
      ${r.teams.length === 2 ? `<button class="btn pri block big" data-a="auToDraft" data-id="${r.id}">⚔️ 이 팀으로 오늘의 내전 라인업 채우기</button><p class="hint">첫 번째 팀이 블루, 두 번째 팀이 레드로 들어가고 라인은 점수 기준으로 자동 배치됩니다(이후 수정 가능).</p>` : ''}</div>`;
  } else if (c) {
    const lead = c.team >= 0 ? r.teams[c.team] : null, bt = r.teams[bidTeam];
    const can = bidTeam >= 0 && r.status === 'running' && bt.members.length < r.cfg.size - 1 && c.team !== bidTeam;
    const min = c.bid + r.cfg.unit;
    const b = (add) => `<button class="btn bid" data-a="auBid" data-id="${r.id}" data-v="${c.bid + add}" ${can && c.bid + add <= bt.points ? '' : 'disabled'}>+${add}<small>${c.bid + add}P</small></button>`;
    stage = `<div class="panel stage ${r.status}">
      <div class="sub"><span class="tag">${r.round === 2 ? '재경매' : '경매'} · 남은 매물 ${r.pool.length}</span><span class="grow"></span><span id="au-timer" class="timer">--</span></div>
      ${info(c.pid)}
      <div class="bidnow"><small>현재 입찰</small><b>${c.bid}P</b><span>${lead ? `👑 ${esc(lead.name)}` : '입찰 없음'}</span></div>
      ${bidTeam >= 0 ? `<div class="bidbar">
        ${me.host ? `<select class="inp" data-c="auAs">${r.teams.map((t, i) => `<option value="${i}" ${i === bidTeam ? 'selected' : ''}>${esc(t.name)} 대리 입찰</option>`).join('')}</select>` : ''}
        <div class="bids">${b(r.cfg.unit)}${b(r.cfg.unit * 5)}${b(r.cfg.unit * 10)}</div>
        <div class="row"><input id="auAmt" class="inp grow" type="number" inputmode="numeric" placeholder="직접 입력 (${min}P 이상)" value="${esc(AU.amt)}" data-i="auAmt"><button class="btn pri" data-a="auBid" data-id="${r.id}" data-v="amt" ${can ? '' : 'disabled'}>입찰</button></div>
        <p class="hint">${bt.members.length >= r.cfg.size - 1 ? '팀이 가득 찼습니다.' : c.team === bidTeam ? '현재 최고 입찰 팀입니다.' : `${esc(bt.name)} 잔여 ${bt.points}P`}</p></div>` : '<p class="mut">👀 관전 중 — 팀장 링크로 들어오면 입찰할 수 있습니다.</p>'}
      ${me.host ? `<div class="row"><button class="btn" data-a="auPause" data-id="${r.id}">${r.status === 'paused' ? '▶ 재개' : '⏸ 일시정지'}</button></div>` : ''}</div>`;
  }
  const queue = r.pool, hideUpcoming = r.cfg.hide && r.status !== 'done';
  const queueView = hideUpcoming ? `<span class="chip mut">매물 이름 비공개 · ${queue.length}명</span>` : queue.map((p) => `<span class="chip">${pname(p)}</span>`).join('') || '<span class="chip mut">없음</span>';
  const unsoldView = hideUpcoming ? `<span class="chip mut">유찰 선수 이름 비공개 · ${r.unsold.length}명</span>` : r.unsold.map((p) => `<span class="chip mut">${pname(p)}</span>`).join('');
  return `<div class="h2row"><a class="btn xs" href="#/auction">← 목록</a><h1>🔨 ${esc(r.name)}</h1><span class="grow"></span>${me.host ? `<span class="tag ok">진행자</span><button class="btn xs ghost" data-a="auDel" data-id="${r.id}">방 삭제</button>` : ''}</div>
  <div class="agrid"><div>${stage}
    <div class="panel"><div class="ph"><b>대기 매물 ${r.pool.length}</b><small class="mut">${hideUpcoming ? '다음 매물 비공개' : '경매 순서 공개'}</small></div><div class="chips">${queueView}</div>
      ${r.unsold.length ? `<div class="ph"><b>유찰 ${r.unsold.length}</b></div><div class="chips">${unsoldView}</div>` : ''}</div>
    <div class="panel"><div class="ph"><b>💬 채팅 · 기록</b></div>
      <div class="chat" id="au-chat">${[...(r.log || []).map((x) => ({ ...x, sys: 1 })), ...(r.chat || [])].sort((a, b) => a.t - b.t).slice(-60).map((x) => (x.sys ? `<div class="sys">${esc(x.s)}</div>` : `<div><b>${esc(x.w)}</b> ${esc(x.s)}</div>`)).join('') || '<div class="sys">아직 기록이 없습니다.</div>'}</div>
      <form class="row" id="au-chatf" data-id="${r.id}"><input id="auChat" class="inp grow" maxlength="100" placeholder="메시지 입력" value="${esc(AU.chat)}" data-i="auChatI" autocomplete="off"><button class="btn">전송</button></form></div>
  </div><div class="ateams">${teams}</div></div>`;
}

let timer = 0;
function tick() {
  if (S.page !== 'auction' || !S.arg[0]) { clearInterval(timer); timer = 0; return; }
  const r = room(S.arg[0]), el = document.getElementById('au-timer');
  if (!r || r.deleted || r.status === 'deleted') { clearInterval(timer); timer = 0; return; }
  if (!r.cur || !el) return;
  const now = Date.now(), c = r.cur;
  if (r.status === 'paused') { el.textContent = `⏸ ${Math.ceil((c.left || 0) / 1000)}초`; return; }
  if (now < c.startsAt) { el.textContent = `곧 시작 ${Math.ceil((c.startsAt - now) / 1000)}`; el.className = 'timer'; return; }
  const left = c.endsAt - now;
  el.textContent = left > 0 ? `⏱ ${Math.ceil(left / 1000)}초` : '낙찰 처리 중…';
  el.className = 'timer' + (left < 5000 ? ' hot' : '');
  const me = myRole(r, S.arg[1]);
  if (left <= (me.host || me.team >= 0 ? 0 : -2500) && !tick.busy) { // 시간이 끝나면 접속자 중 누구든 정산(중복 실행돼도 안전)
    tick.busy = true;
    tx(r.id, (x, t) => (x.status === 'running' && x.cur && x.cur.pid === c.pid && t >= x.cur.endsAt ? settle(x, t) : null)).finally(() => setTimeout(() => (tick.busy = false), 800));
  }
}
page('auction', {
  render: (id, token) => (id ? roomView(id, token) : lobbyList()),
  after() {
    if (!S.arg[0]) return;
    if (!timer) timer = setInterval(tick, 250);
    tick();
    const ch = document.getElementById('au-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
    const f = document.getElementById('au-chatf');
    if (f) f.onsubmit = (e) => {
      e.preventDefault();
      const s = AU.chat.trim(), r = room(f.dataset.id); if (!s || !r) return;
      const me = myRole(r, S.arg[1]), w = me.host ? '진행자' : me.team >= 0 ? `👑${nm(r.teams[me.team].captain)}` : '관전자';
      AU.chat = '';
      tx(r.id, (x, t) => { x.chat = [...(x.chat || []), { t, w, s }].slice(-40); return x; });
    };
  },
});
act('auF', (d, el) => { AU[d.k] = d.k === 'name' ? el.value : Math.max(0, +el.value || 0); });
act('auHc', (d, el) => { AU.hcap[d.id] = +el.value || 0; });
act('auHide', (d, el) => { AU.hide = el.checked; });
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
act('auSendLink', (d) => { if (d.u && sendLobbyChat(`🔗 ${d.label || '경매 링크'}: ${d.u}`)) toast('공용 채팅에 링크를 보냈습니다'); });
act('auCreate', async () => {
  const caps = Object.keys(AU.role).filter((k) => AU.role[k] === 2), parts = Object.keys(AU.role).filter((k) => AU.role[k] === 1);
  if (caps.length < 2) return toast('팀장을 2명 이상 지정해 주세요 (이름 옆 왕관 누르기)');
  if (!parts.length) return toast('경매에 나올 참가자를 선택해 주세요');
  if (AU.unit < 1 || AU.sec < 5) return toast('입찰 단위는 1 이상, 경매 시간은 5초 이상이어야 합니다');
  for (let i = parts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [parts[i], parts[j]] = [parts[j], parts[i]]; }
  const id = uid(), host = tok();
  const r = {
    id, name: AU.name.trim() || `${dayKey(Date.now()).slice(5)} 경매`, createdAt: Date.now(), status: 'lobby', host,
    cfg: { points: AU.points, unit: AU.unit, sec: AU.sec, ext: AU.ext, size: 5, hide: AU.hide },
    teams: caps.map((pid) => ({ name: nm(pid) + ' 팀', captain: pid, token: tok(), points: Math.max(0, AU.points - (AU.hcap[pid] || 0)), members: [] })),
    pool: parts, unsold: [], round: 1, cur: null, log: [], chat: [],
  };
  await S.store.put('auctions', id, r);
  localStorage.setItem(hostKey(id), host);
  AU.role = {}; AU.name = '';
  go(`#/auction/${id}/${host}`);
});
act('auStart', (d) => tx(d.id, (r, now) => { if (r.status !== 'lobby') return null; r.status = 'running'; say(r, '▶ 경매를 시작합니다!'); return nextItem(r, now); }));
act('auPause', (d) => tx(d.id, (r, now) => {
  if (!r.cur) return null;
  if (r.status === 'running') { r.status = 'paused'; r.cur.left = Math.max(1000, r.cur.endsAt - now); }
  else if (r.status === 'paused') { r.status = 'running'; r.cur.endsAt = now + r.cur.left; r.cur.startsAt = Math.min(r.cur.startsAt, now); }
  return r;
}));
act('auBid', async (d) => {
  const r0 = room(d.id); if (!r0?.cur) return;
  const me = myRole(r0, S.arg[1]), ti = me.host ? Math.min(AU.as, r0.teams.length - 1) : me.team, pid = r0.cur.pid;
  const v = d.v === 'amt' ? Math.floor(+AU.amt) : +d.v;
  if (!v || v < r0.cur.bid + r0.cfg.unit) return toast(`${r0.cur.bid + r0.cfg.unit}P 이상 입찰해야 합니다`);
  if (v % r0.cfg.unit) return toast(`입찰 단위는 ${r0.cfg.unit}P입니다`);
  if (v > r0.teams[ti].points) return toast('포인트가 부족합니다');
  const ok = await tx(d.id, (r, now) => {
    const c = r.cur, t = r.teams[ti];
    if (r.status !== 'running' || !c || c.pid !== pid || now < c.startsAt || now >= c.endsAt) return null;
    if (c.team === ti || v < c.bid + r.cfg.unit || v > t.points || t.members.length >= r.cfg.size - 1) return null;
    c.bid = v; c.team = ti; c.endsAt = Math.max(c.endsAt, now + r.cfg.ext * 1000);
    say(r, `💰 ${t.name} ${v}P`);
    return r;
  });
  if (ok) { AU.amt = ''; } else toast('입찰이 반영되지 않았습니다 (시간 종료 또는 더 높은 입찰)');
});
act('auToDraft', (d) => {
  const r = room(d.id); if (!r) return;
  const ids = (t) => bestLanes([t.captain, ...t.members.map((m) => m.pid)].slice(0, 5));
  setDraftTeams(ids(r.teams[0]), ids(r.teams[1]));
  toast('라인업을 채웠습니다'); go('#/today');
});
act('auDel', (d) => {
  if (!confirm('이 경매 방을 삭제할까요? 진행 중인 경매는 모든 참가자에게 즉시 종료됩니다.')) return;
  tx(d.id, (r) => { r.deleted = true; r.status = 'deleted'; r.cur = null; say(r, '⛔ 경매 방이 삭제되어 진행이 종료되었습니다.'); return r; })
    .then((ok) => { if (ok) go('#/auction'); else toast('경매 방을 삭제하지 못했습니다'); });
});
