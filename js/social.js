// 환영 인트로, 닉네임, 접속자 표시, 공용 채팅
import { S, act, esc, uid, col, settings, toast, modal, closeModal, mh, ic, logo, needAdmin, LANE_ICON, LANE_COLOR, LANE_NAME } from './core.js';
import { xmasOn, inSeason, SEASON } from './season.js'; // 장식 모듈(SEASON.x·n)은 시즌에만 받아진다
import { hookOn, USAGE, loadUsage, won, kfmt } from './hook.js';

// 채팅창 머리의 남은 무료 한도·이번 달 요금(연동 서버가 있고 Blaze 요금제일 때만 보인다)
function renderQuota() {
  const el = document.getElementById('chat-quota'), d = USAGE.d;
  if (!el) return;
  if (!d?.today || !d.month) { el.hidden = true; return; }
  const left = (k) => d.limits[k] - d.today[k];
  const cell = (k, label) => { const v = left(k); return `<span class="${v <= 0 ? 'over' : v < d.limits[k] * 0.2 ? 'low' : ''}">${label} <b class="mono">${v <= 0 ? '초과' : kfmt(v)}</b></span>`; };
  el.hidden = false;
  el.title = `오늘 남은 무료 사용량 (한국 시간 오후 4~5시 초기화)\n읽기 ${Math.max(0, left('read')).toLocaleString('ko-KR')} · 쓰기 ${Math.max(0, left('write')).toLocaleString('ko-KR')} · 삭제 ${Math.max(0, left('delete')).toLocaleString('ko-KR')}\n오늘 요금 ${won(d.today.usd, d.krw)} · 이번 달 ${won(d.month.usd, d.krw)} (예상)`;
  el.innerHTML = `<small>무료 남음</small><div>${cell('read', '읽기')}${cell('write', '쓰기')}</div><em class="${d.month.usd > 0 ? 'paid' : ''}">이번 달 <b class="mono">${won(d.month.usd, d.krw)}</b></em>`;
}

export const cid = localStorage.getItem('naejeon:cid') || (() => { const v = uid(); localStorage.setItem('naejeon:cid', v); return v; })();
export const nick = () => localStorage.getItem('naejeon:nick') || '';
// 10분마다 생존 신호를 보내고, 12분 동안 신호가 없으면 나간 것으로 본다. 탭을 닫으면 그 즉시 나감 표시(at:0)를 보낸다.
const ONLINE_MS = 12 * 60e3, BEAT_MS = 10 * 60e3;
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
// 접속자 아이콘: 닉네임이 선수 이름(또는 롤 닉네임)과 같으면 그 선수의 주 라인 아이콘, 아니면 사람 아이콘
const squash = (s) => String(s || '').replace(/\s/g, '').toLowerCase();
function playerOf(nick) {
  const k = squash(nick), list = S.st?.list || [];
  return list.find((s) => squash(s.name) === k) || list.find((s) => squash(String(s.p.riotId || '').split('#')[0]) === k) || list.find((s) => s.name.length >= 2 && k.includes(squash(s.name)));
}
const face = (nick) => { const l = playerOf(nick)?.mainLane, c = LANE_COLOR[l]; if (xmasOn() && SEASON.x) return SEASON.x.xmasFace(nick, l ? LANE_NAME[l] : ''); return `<i class="face" style="--lc:${c || `hsl(${hue(nick)} 45% 62%)`}" title="${l ? LANE_NAME[l] : ''}">${c ? LANE_ICON[l] : ic('user')}</i>`; };

// ---------- 접속자 ----------
// 강퇴: meta/kicks 문서에 { 접속기기id: 해제시각 } 으로 적는다. 가벼운 잠금이라 브라우저 저장소를 지우면 다시 들어올 수 있다.
const KICK_MS = 10 * 60e3;
const kickedUntil = (id = cid) => +(S.store.data.meta?.kicks?.[id] || 0);
const isKicked = (id = cid) => kickedUntil(id) > Date.now();
// 신호를 보낼 때마다 모든 접속자가 그 문서를 다시 읽는다. 롤과 창을 오갈 때(화면이 다시 보일 때)는 5분에 한 번까지만 보낸다.
// 표시 기준은 12분이고 10분마다 정기 신호가 가므로 접속 중 표시는 그대로다. 나감 표시(at:0)를 보낸 뒤에는 바로 다시 보낸다.
let lastBeat = 0, byeSent = false;
const VISIBLE_BEAT_MS = 5 * 60e3;
function beat(off) {
  if (!nick()) return;
  if (off) { byeSent = true; return S.store.bye('presence', cid, 'at', 0); } // 탭 닫기·숨김 직전에도 끝까지 전송되는 방식
  if (isKicked() || S.store.isPaused?.()) return; // 사용량 자동 쉬기 중에는 접속 신호도 보내지 않는다
  const at = Date.now();
  byeSent = false; lastBeat = at;
  S.store.put('presence', cid, { nick: nick(), at }).catch(() => { if (lastBeat === at) lastBeat = 0; }); // 실패하면 다음에 바로 다시 보낸다
}
const beatIfStale = () => { if (byeSent || Date.now() - lastBeat >= VISIBLE_BEAT_MS) beat(); };
const online = () => col('presence').filter((p) => p.nick && Date.now() - p.at < ONLINE_MS && !isKicked(p.id)).sort((a, b) => (a.id === cid ? -1 : b.id === cid ? 1 : a.nick.localeCompare(b.nick, 'ko')));
// 입장·퇴장 알림(왼쪽 아래). 처음 화면을 그릴 때 이미 있던 사람은 알리지 않는다.
let prevOn = null, prSig = '';
function feed(name, kind) {
  let box = document.getElementById('joinfeed');
  if (!box) { box = document.createElement('div'); box.id = 'joinfeed'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'jf ' + kind;
  el.innerHTML = `<i style="--h:${hue(name)}"></i><span><b>${esc(name)}</b> 님이 ${kind === 'join' ? '입장했습니다' : '나갔습니다'}</span><em>${kind === 'join' ? 'JOIN' : 'LEFT'}</em>`;
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 500); }, 4200);
}
// 접속자 작은 창: 나를 맨 위, 나머지는 가나다순
const PR = { open: false };
function prPop(list) {
  const rows = [...list].sort((a, b) => (b.id === cid) - (a.id === cid) || a.nick.localeCompare(b.nick, 'ko', { numeric: true }));
  return `<div class="prpop" role="dialog" aria-label="접속자 목록"><div class="prpop-h"><b>접속 중</b><small class="mono">${list.length}명</small></div>
    <div class="prpop-l">${rows.map((p) => `<button class="${p.id === cid ? 'me' : ''}" ${p.id === cid ? 'data-a="nickEdit" title="닉네임 변경"' : `data-cid="${esc(p.id)}" data-nick="${esc(p.nick)}" title="우클릭: 관리자 메뉴"`}>${face(p.nick)}<span>${esc(p.nick)}</span>${p.id === cid ? '<small>나</small>' : ''}</button>`).join('')}</div></div>`;
}
const prSet = (on) => { if (PR.open === on) return; PR.open = on; prSig = ''; renderPresence(); };
addEventListener('pointerdown', (e) => { if (PR.open && !e.target.closest('#presence')) prSet(false); }, { passive: true });
addEventListener('keydown', (e) => { if (PR.open && e.key === 'Escape') prSet(false); });
export function renderPresence() {
  const el = document.getElementById('presence'); if (!el) return;
  const list = online(), now = new Map(list.map((p) => [p.id, p.nick]));
  if (prevOn) {
    for (const [id, name] of now) if (id !== cid && !prevOn.has(id)) feed(name, 'join');
    for (const [id, name] of prevOn) if (id !== cid && !now.has(id)) feed(name, 'leave');
  }
  const bump = prevOn && prevOn.size !== now.size;
  prevOn = now;
  const sig = list.map((p) => p.id + ':' + p.nick).join('|') + (S.st?.list?.length ? '#p' : '') + (xmasOn() ? '#x' : '') + (PR.open ? '#o' : '');
  if (sig === prSig && el.firstChild) return; // 목록이 그대로면 다시 그리지 않는다
  prSig = sig;
  const cnt = String(list.length).padStart(2, '0'), more = list.length - 5;
  // 얼굴은 최대 5개까지 겹쳐 보여 주고, 누르면 위로 작은 창(접속자 목록)이 뜬다. 모바일은 위쪽 막대에 3개 + 눌러서 아래 창
  el.innerHTML = `<div class="prh" data-a="presList" title="접속자 보기">${ic('users')}<b>접속 중</b><span class="pav">${list.slice(0, 3).map((p) => face(p.nick)).join('')}</span><span class="pcount ${bump ? 'bump' : ''}" title="현재 접속자 ${list.length}명"><i></i><b class="mono">${cnt}</b><small>ONLINE</small></span></div>
    <button class="prf" data-a="presList" aria-expanded="${PR.open}" title="접속자 모두 보기">${list.length ? `<span class="prs">${list.slice(0, 5).map((p) => face(p.nick)).join('')}${more > 0 ? `<i class="pmore mono">+${more}</i>` : ''}</span><small>${PR.open ? '닫기' : '모두 보기'}</small>` : '<small class="mut">아직 아무도 없어요</small>'}</button>
    ${PR.open ? prPop(list) : ''}`;
  const c = document.getElementById('chat-on'); if (c) c.textContent = list.length;
}
function askNick(first) {
  const el = modal(`${mh(first ? '소환사명을 정해 주세요' : '닉네임 변경')}
    <p class="mut">접속자 목록과 채팅에 표시됩니다. 실명이 아니어도 됩니다.</p>
    <form class="row" id="nickf"><input class="inp grow" id="nickv" maxlength="12" placeholder="닉네임 (최대 12자)" value="${esc(nick())}" autocomplete="off"><button class="btn pri">확인</button></form>`);
  const inp = el.querySelector('#nickv'); inp.focus(); inp.select();
  el.querySelector('#nickf').onsubmit = (e) => { e.preventDefault(); if (setNick(inp.value)) closeModal(); };
}
function setNick(v) {
  v = v.trim().slice(0, 12);
  if (!v) { toast('닉네임을 입력해 주세요'); return false; }
  localStorage.setItem('naejeon:nick', v); beat(); renderPresence(); renderChat(true);
  return true;
}
act('nickEdit', () => { prSet(false); askNick(false); });
act('presList', () => { // PC: 위로 작은 창을 열고 닫는다. 모바일: 아래에서 올라오는 창
  if (matchMedia('(min-width: 861px)').matches) return prSet(!PR.open);
  const list = online();
  modal(`${mh(`접속 중 · ${list.length}명`)}<div class="pr-sheet">${list.map((p) => `<button class="${p.id === cid ? 'me' : ''}" ${p.id === cid ? 'data-a="nickEdit"' : ''}>${face(p.nick)}<b>${esc(p.nick)}</b>${p.id === cid ? `<small>나 · 눌러서 닉네임 변경</small>` : `<small>접속 중${playerOf(p.nick) ? ` · ${LANE_NAME[playerOf(p.nick).mainLane] || ''}` : ''}</small>`}</button>`).join('') || '<p class="mut">아직 아무도 없어요</p>'}</div>`, 'pres-sheet');
});

// ---------- 채팅 ----------
// 스티커는 분류별로 묶는다. [키, 글자, 색]. 키는 채팅 기록에 저장되므로 한 번 정한 키는 바꾸지 않는다.
// season:true 분류(크리스마스)는 시즌 기간(11/16~12/26)에만 고르는 칸에 나온다. 이미 보낸 스티커는 시즌이 끝나도 그대로 보인다.
const STK_CATS = [
  { id: 'hi', name: '인사', items: [['gg', 'GG', 'gold'], ['wp', 'WP', 'teal'], ['again', '한 판 더', 'blue'], ['sorry', '미안합니다', 'blue'], ['ty', '수고했어', 'teal'], ['plz', '잘 부탁해', 'gold']] },
  { id: 'call', name: '게임 콜', items: [['omw', '가는 중', 'teal'], ['danger', '위험!', 'red'], ['help', '도와줘', 'blue'], ['?', '?', 'yellow'], ['drake', '용 먹자', 'teal'], ['ff', '15 ㄱ?', 'red']] },
  { id: 'gj', name: '칭찬', items: [['carry', '캐리했다', 'gold'], ['nice', '명장면', 'gold'], ['gap', '격이 다르다', 'gold'], ['bus', '버스 탑승', 'teal'], ['master', '장인 인정', 'yellow'], ['clutch', '한타 지배자', 'blue']] },
  { id: 'lol', name: '드립', items: [['jg', '정글 차이', 'red'], ['throw', '던졌다', 'red'], ['troll', '트롤 검거', 'yellow'], ['lane', '라인전 차이', 'red'], ['cold', '손이 안 풀림', 'blue'], ['ping', '핑 탓이다', 'yellow']] },
  { id: 'xmas', name: '🎄 크리스마스', season: true, items: [['x-merry', '🎄 메리 크리스마스', 'xmas'], ['x-santa', '🎅 산타 등장', 'xmas'], ['x-gift', '🎁 선물 배달', 'xmas'], ['x-snow', '❄️ 눈 오는 날 내전', 'xmas'], ['x-rudolph', '🦌 루돌프 정글', 'xmas'], ['x-solo', '🥲 솔로 크리스마스', 'xmas'], ['x-carol', '🔔 캐롤 각', 'xmas'], ['x-star', '⭐ 트리 꼭대기 별', 'xmas'], ['x-coal', '⛏ 석탄 받을 플레이', 'xmas']] },
];
const STICKERS = STK_CATS.flatMap((c) => c.items);
const EMOJI = ['😂', '🔥', '👍', '😭', '🤡', '💀', '🫡', '🙏', '👀', '🎉', '😎', '🥲'];
const EMOJI_XMAS = ['🎄', '🎅', '🤶', '🎁', '❄️', '⛄', '🔔', '🦌', '✨', '🍪'];
const STK = Object.fromEntries(STICKERS.map((s) => [s[0], s]));
let stkTab = '';
const stkCats = () => { const on = STK_CATS.filter((c) => !c.season || inSeason()); return [...on.filter((c) => c.season), ...on.filter((c) => !c.season)]; }; // 시즌 한정 분류를 맨 앞에
function trayHTML() {
  const cats = stkCats(), cur = cats.find((c) => c.id === stkTab) || cats.find((c) => c.season) || cats[0]; // 시즌에는 크리스마스 칸이 먼저 열린다
  stkTab = cur.id;
  return `<div class="stk-tabs" role="tablist">${cats.map((c) => `<button class="${c.id === cur.id ? 'on' : ''} ${c.season ? 'xm' : ''}" data-a="chatStkTab" data-t="${c.id}" role="tab" aria-selected="${c.id === cur.id}">${c.name}${c.season ? '<em>한정</em>' : ''}</button>`).join('')}</div>
    <div class="stk-grid ${cur.season ? 'xm' : ''}">${cur.items.map(([k, t, c]) => `<button class="sticker ${c}" data-a="chatStk" data-k="${k}">${esc(t)}</button>`).join('')}</div>
    <div class="emo-row">${(cur.season ? EMOJI_XMAS : EMOJI).map((e) => `<button data-a="chatEmo" data-e="${e}">${e}</button>`).join('')}</div>`;
}
act('chatStkTab', (d) => { stkTab = d.t; const el = document.getElementById('chattray'); if (el) el.innerHTML = trayHTML(); });
let unread = 0, lastSeenAt = +localStorage.getItem('naejeon:chatseen') || 0, lastChatAt = 0, tray = false;
let chatQ = Promise.resolve(); // 채팅 전송 순서 유지용(서버 시각을 맞추는 동안 다음 메시지가 앞지르지 않게)
const isOpen = () => !document.body.classList.contains('chat-closed');
// 채팅창이 처음에 열려 있을지: 넓은 화면은 지난번 상태를 기억하고, 좁은 화면은 접힌 채로 시작(app.js 가 store 에도 알려 채팅을 몇 개 받을지 정한다)
export const chatStartsOpen = () => matchMedia('(min-width: 1281px)').matches && localStorage.getItem('naejeon:chatclosed') !== '1';
// 닫힌 채팅창의 '안 읽은 채팅': 채팅창이 닫혀 있으면 최신 1개만 실시간으로 받으므로(store chatFull), 숫자는
// 접속할 때 서버에서 센 수(마지막으로 본 뒤의 채팅 수, 읽기 1번) + 그 뒤로 새로 도착한 다른 사람 메시지 수로 계산한다.
const UN = { base: 0, at: 0, ids: new Set() };
function unreadReset(at) { UN.base = 0; UN.at = at; UN.ids.clear(); }
// 채팅창을 열 것 같으면(버튼에 손가락·마우스를 올림) 미리 20개를 받기 시작하고, 닫은 뒤 1분이 지나면 다시 1개로 줄인다
let chatIdle = 0;
const chatWant = () => { clearTimeout(chatIdle); S.store.chatFull?.(true); };
const chatRest = () => { clearTimeout(chatIdle); chatIdle = setTimeout(() => { if (!isOpen()) S.store.chatFull?.(false); }, 60e3); };
const msgs = () => col('chat').filter((m) => !m.deleted && m.at > (+settings().chatClearedAt || 0)).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
// 도배 막기: 3초에 3개, 1분에 20개까지(스티커·주사위 포함). 넘으면 보내지 않고 입력한 글은 그대로 둔다(자동 알림 sysChat 은 제외).
// 메시지 하나마다 접속한 모든 사람에게 읽기가 생기므로, 엔터를 꾹 누르거나 장난으로 도배해도 사용량이 튀지 않게 한다.
const sentAt = [];
function chatWait() {
  const n = performance.now();
  while (sentAt.length && sentAt[0] <= n - 60e3) sentAt.shift();
  const in3 = sentAt.filter((t) => t > n - 3e3);
  if (in3.length >= 3) return in3[0] + 3e3 - n;
  if (sentAt.length >= 20) return sentAt[0] + 60e3 - n;
  return 0;
}
function send(kind, text) {
  if (isKicked()) { toast('강퇴 상태에서는 채팅을 보낼 수 없습니다'); return false; }
  if (!nick()) { askNick(true); return false; }
  const wait = chatWait();
  if (wait > 0) { toast(`채팅이 너무 빨라요. ${Math.ceil(wait / 1000)}초 뒤에 다시 보내 주세요`); return false; }
  sentAt.push(performance.now());
  // 기기 시계 차이로 메시지 순서가 뒤섞이지 않게 서버 시각을 기준으로 하고,
  // 같은 기기에서 연속 전송해도 타임스탬프가 겹치지 않게 한다.
  // 서버 시각은 필요할 때만 맞춘다(30분 안에 맞췄으면 바로, 아니면 최대 2.5초 기다림). 보내는 순서는 그대로 지킨다.
  const t = String(text).slice(0, 200), who = nick();
  chatQ = chatQ.then(() => S.store.clockSoon?.()).then(() => {
    const now = Math.max(S.store.serverNow?.() ?? Date.now(), lastChatAt + 1);
    lastChatAt = now;
    const id = now.toString(36) + Math.random().toString(36).slice(2, 6);
    return S.store.put('chat', id, { at: now, cid, nick: who, k: kind, t }).catch((e) => toast('전송 실패: ' + (e.code || e.message)));
  });
  return true;
}
export function sendLobbyChat(text) {
  if (!send('m', text)) return false;
  if (!isOpen()) document.getElementById('chatfab')?.click();
  return true;
}
// 다른 화면에서 쓰는 알림 메시지 (경기 저장, 주사위 결과 등)
export function sysChat(text) {
  const t = String(text).slice(0, 200), who = nick() || '익명';
  chatQ = chatQ.then(() => S.store.clockSoon?.()).then(() => {
    const now = Math.max(S.store.serverNow?.() ?? Date.now(), lastChatAt + 1);
    lastChatAt = now;
    return S.store.put('chat', now.toString(36) + Math.random().toString(36).slice(2, 6), { at: now, cid, nick: who, k: 'sys', t }).catch(() => {});
  });
}
function buildChat() {
  document.getElementById('chat').innerHTML = `
    <header><div class="ch-t"><span class="ch-k"><i class="live"></i>LIVE</span><b>Lobby<i>Chat</i></b><small><span id="chat-on">0</span>명 접속 중</small></div><div class="ch-side"><div class="ch-btns"><button class="btn ghost xs" data-a="chatClear" title="채팅 전체 삭제 (관리자)" aria-label="채팅 전체 삭제">${ic('trash')}</button><button class="btn ghost xs chatx" data-a="chatToggle" title="채팅창 접기" aria-label="채팅창 접기">${ic('fold')}</button></div><div id="chat-quota" hidden></div></div></header>
    <div id="chatlog"></div>
    <div id="chattray" hidden>${trayHTML()}</div>
    <form id="chatform"><button type="button" class="cbtn2" data-a="chatTray" title="스티커">${ic('star')}</button><button type="button" class="cbtn2" data-a="chatRoll" title="주사위 1~100">${ic('dice')}</button>
      <input id="chatinp" class="inp grow" maxlength="200" placeholder="메시지 입력…" autocomplete="off" enterkeyhint="send"><button class="cbtn2 go" title="전송">${ic('send')}</button></form>`;
  // 휴대폰: 전송 버튼을 눌러도 입력칸이 포커스를 잃지 않게 해서 키보드가 내려가지 않는다(연달아 입력 가능).
  // 버튼을 누를 때 포커스가 버튼으로 옮겨 가는 것을 막고, 그래도 빠지면 보낸 직후 입력칸으로 되돌린다(누른 동작 안이라 키보드가 유지됨)
  const form = document.getElementById('chatform'), inp = document.getElementById('chatinp'), go = form.querySelector('.go');
  let keep = false;
  go.addEventListener('pointerdown', () => { keep = document.activeElement === inp; }, { passive: true });
  go.addEventListener('mousedown', (e) => { if (document.activeElement === inp) e.preventDefault(); });
  form.onsubmit = (e) => {
    e.preventDefault();
    const typing = keep || document.activeElement === inp; keep = false;
    const v = inp.value.trim();
    if (v && send('m', v)) inp.value = '';
    if (typing && document.activeElement !== inp) inp.focus({ preventScroll: true });
  };
  const fab = document.getElementById('chatfab');
  fab.title = '채팅창 펼치기';
  fab.innerHTML = `<span class="cf-ring"></span><span class="cf-core">${ic('chat')}<i class="cf-line"></i></span><em>CHAT</em><span id="chatbadge" hidden></span>`;
  const lz = document.createElement('div'); lz.id = 'chatlaser'; lz.innerHTML = '<i class="a"></i><i class="b"></i><u></u>'; document.body.appendChild(lz);
  // 넓은 화면은 지난번 상태를 기억하고, 좁은 화면은 접힌 채로 시작한다
  if (!chatStartsOpen()) document.body.classList.add('chat-closed');
  for (const ev of ['pointerenter', 'pointerdown', 'focus']) fab.addEventListener(ev, () => { if (!isOpen()) { chatWant(); chatRest(); } }, { passive: true });
  // 닫힌 채로 시작하면, 마지막으로 본 뒤에 쌓인 채팅 수를 서버에서 한 번 센다(문서를 내려받지 않음)
  if (!isOpen()) {
    const since = Math.max(lastSeenAt, +settings().chatClearedAt || 0); unreadReset(S.store.serverNow?.() ?? Date.now());
    if (lastSeenAt && S.store.countSince) S.store.countSince('chat', 'at', since).then((n) => { if (!isOpen()) { UN.base = n; renderChat(); } }).catch(() => {});
  }
}
// 새로 도착한 메시지만 떠오르는 효과를 준다(다시 그릴 때마다 전체가 다시 떠오르며 깜빡이지 않게)
let renderedAt = 0;
const setBadge = () => { const b = document.getElementById('chatbadge'); if (b) { b.hidden = !unread; b.textContent = unread > 99 ? '99+' : unread; } };
export function renderChat(force) {
  const log = document.getElementById('chatlog'); if (!log) return;
  // 채팅창이 닫혀 있으면(휴대폰 기본) 목록은 그리지 않고 안 읽은 숫자만 센다. 열 때 chatToggle 이 renderChat(true)로 그린다(첫 화면이 멈칫하지 않게)
  if (!isOpen()) { for (const m of msgs()) if (m.at > UN.at && m.cid !== cid) UN.ids.add(m.id); unread = UN.base + UN.ids.size; return setBadge(); }
  const list = msgs(), atBottom = force || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  const since = force ? Infinity : renderedAt, fresh = (m) => renderedAt && m.at > since;
  let prevDay = '', prevWho = '', html = '';
  for (const m of list) {
    const d = new Date(m.at), day = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, tm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (day !== prevDay) { html += `<div class="cday"><span>${day}</span></div>`; prevDay = day; prevWho = ''; }
    if (m.k === 'sys') { html += `<div class="csys ${fresh(m) ? 'new' : ''}">${esc(m.t)}<small>${tm}</small></div>`; prevWho = ''; continue; }
    const me = m.cid === cid, who = m.cid + m.nick, head = who !== prevWho;
    prevWho = who;
    const linkedText = esc(m.t).replace(/https?:\/\/[^\s<]+/g, (url) => `<a class="chatlink" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    const body = m.k === 's' && STK[m.t] ? `<span class="sticker big ${STK[m.t][2]}">${esc(STK[m.t][1])}</span>` : m.k === 'r' ? `<span class="croll">${ic('dice')}<b>${esc(m.t)}</b><small>1~100</small></span>` : `<span class="cb ${/^\p{Extended_Pictographic}{1,3}$/u.test(m.t) ? 'emo' : ''}">${linkedText}</span>`;
    html += `<div class="cm ${me ? 'me' : ''} ${head ? 'head' : ''} ${fresh(m) ? 'new' : ''}">${head && !me ? `<b class="cn" style="--h:${hue(m.nick)}">${esc(m.nick)}</b>` : ''}<div class="cl">${body}<small>${tm}</small>${me ? `<button class="cdel" data-a="chatDel" data-id="${m.id}" title="내 메시지 지우기" aria-label="메시지 지우기">${ic('x')}</button>` : ''}</div></div>`;
  }
  log.innerHTML = html || `<div class="cempty">${ic('chat')}<p>첫 메시지를 남겨 보세요.<br>스티커와 주사위도 있어요.</p></div>`;
  if (atBottom) log.scrollTop = log.scrollHeight;
  const last = list[list.length - 1]?.at || 0;
  renderedAt = Math.max(renderedAt, last, 1);
  lastSeenAt = Math.max(lastSeenAt, last); localStorage.setItem('naejeon:chatseen', lastSeenAt); unread = 0; unreadReset(Math.max(lastSeenAt, S.store.serverNow?.() ?? Date.now()));
  setBadge();
}
// 접기/펼치기: 레이저 선이 그어진 뒤 위아래로 갈라지며 열리고, 닫을 때는 선으로 모였다가 사라진다(#chatlaser + #chat clip-path)
let chatAnim = 0;
act('chatToggle', () => {
  const b = document.body, chat = document.getElementById('chat'), lz = document.getElementById('chatlaser');
  const closing = isOpen(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, T = reduce ? 0 : closing ? 560 : 760;
  clearTimeout(chatAnim); chat.classList.remove('opening', 'closing'); lz.classList.remove('opening', 'closing');
  const done = () => { chat.classList.remove('opening', 'closing'); lz.classList.remove('opening', 'closing'); b.classList.remove('chat-closing'); if (closing) b.classList.add('chat-closed'); };
  if (closing) chatRest(); else chatWant(); // 열면 최근 20개를 받고(기기 캐시가 먼저 보임), 닫고 1분 뒤에는 최신 1개만
  if (!closing) b.classList.remove('chat-closed', 'chat-closing');
  else b.classList.add('chat-closing'); // 채팅창이 접히는 동안 본문도 함께 넓어진다(끝난 뒤 한 번에 튀지 않게)
  if (matchMedia('(min-width: 1281px)').matches) localStorage.setItem('naejeon:chatclosed', closing ? '1' : '0');
  if (!T) { done(); if (!closing) renderChat(true); return; } // 움직임 줄이기 설정: 바로 열고 내용을 그린다
  if (!closing) renderChat(true); // 펼치기 전에 내용을 먼저 그려 둔다(펼쳐진 뒤 다시 그리지 않음)
  void chat.offsetWidth;
  chat.classList.add(closing ? 'closing' : 'opening'); lz.classList.add(closing ? 'closing' : 'opening');
  chatAnim = setTimeout(done, T);
});
act('chatTray', () => { tray = !tray; document.getElementById('chattray').hidden = !tray; renderChat(true); });
act('chatStk', (d) => send('s', d.k));
act('chatEmo', (d) => { const i = document.getElementById('chatinp'); i.value += d.e; i.focus(); });
act('chatRoll', () => send('r', 1 + Math.floor(Math.random() * 100)));
// 내가 쓴 글만 지울 수 있다. DB 문서는 지우지 않고 삭제 표시만 한다(다른 사람 화면에서도 바로 사라진다).
act('chatDel', (d) => {
  const m = S.store.data.chat?.[d.id];
  if (!m || m.cid !== cid || !confirm('이 메시지를 지울까요?')) return;
  S.store.patch('chat', d.id, { deleted: true }).catch((e) => toast('삭제 실패: ' + (e.code || e.message)));
});

// ---------- 환영 인트로 ----------
function embers(canvas) {
  const g = canvas.getContext('2d'); let run = true;
  const fit = () => { canvas.width = innerWidth; canvas.height = innerHeight; }; fit();
  const ps = Array.from({ length: 90 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: 0.6 + Math.random() * 2.200, v: 0.3 + Math.random() * 1.200, d: Math.random() * 6, c: Math.random() < 0.25 ? '63,208,224' : '246,227,168' }));
  (function loop(t) {
    if (!run) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    ps.forEach((p) => { p.y -= p.v; p.x += Math.sin(t / 900 + p.d) * 0.4; if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; } g.beginPath(); g.fillStyle = `rgba(${p.c},${0.25 + 0.5 * Math.abs(Math.sin(t / 700 + p.d))})`; g.shadowColor = `rgba(${p.c},.9)`; g.shadowBlur = 8; g.arc(p.x, p.y, p.r, 0, 7); g.fill(); });
    requestAnimationFrame(loop);
  })(0);
  return () => { run = false; };
}
function splash() {
  const el = document.getElementById('splash');
  if (sessionStorage.getItem('naejeon:welcomed') && nick()) { el.remove(); return; }
  const first = !nick(), name = settings().leagueName || '친구 내전 리그';
  el.innerHTML = `<canvas></canvas><div class="sp-rays"></div>
    <div class="sp-box"><div class="sp-mark"><i class="sp-glow"></i>${logo(true, 148)}<i class="sp-shine"></i></div>
      <div class="sp-word">${[...'NAEJEON'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}${[...'POT'].map((c, i) => `<i style="--i:${i + 7}">${c}</i>`).join('')}</div>
      <p class="sp-sub">${first ? '소환사의 협곡에 오신 것을 환영합니다' : `${esc(nick())} 님, 다시 오셨군요`}</p>
      <p class="sp-league">${esc(name)}</p>
      ${first ? `<form id="spf"><input id="spn" class="inp" maxlength="12" placeholder="닉네임을 입력하세요" autocomplete="off"><button class="btn pri">입장</button></form>` : '<div class="sp-bar"><i></i></div>'}
    </div><small class="sp-skip">${first ? '닉네임은 접속자 목록과 채팅에 표시됩니다' : '화면을 누르면 바로 입장합니다'}</small>`;
  el.classList.add('on'); el.classList.remove('boot');
  SEASON.x?.splashScene(el); // 시즌 장식 기간이면 밤하늘·달·산타 썰매 배경
  SEASON.n?.nySplash(el); // 새해(1/1~1/15)면 불꽃놀이·풍등 배경
  // 기본 불씨 캔버스는 시즌 배경(크리스마스·새해)에서는 가려지므로 아예 돌리지 않는다(보이지 않는 캔버스를 계속 그리면 인트로가 끊긴다)
  const stop = el.classList.contains('xs') || el.classList.contains('ny') ? () => {} : embers(el.querySelector('canvas'));
  const close = () => { if (el.dataset.done) return; el.dataset.done = 1; sessionStorage.setItem('naejeon:welcomed', '1'); el.classList.add('out'); setTimeout(() => { stop(); el.remove(); }, 850); };
  if (first) {
    setTimeout(() => el.querySelector('#spn')?.focus(), 1900);
    el.querySelector('#spf').onsubmit = (e) => { e.preventDefault(); if (setNick(el.querySelector('#spn').value)) close(); };
  } else { setTimeout(close, el.classList.contains('xs') || el.classList.contains('ny') ? 5600 : 3600); el.addEventListener('click', close); } // 시즌 장식 땐 썰매가 지나갈 만큼 조금 더 보여 준다
}

export function initSocial() {
  buildChat(); renderPresence(); renderChat(true); splash(); onMeta();
  if (hookOn()) { // 사용량은 5분마다(탭이 보일 때만) 새로 받는다
    addEventListener('usage', renderQuota);
    loadUsage(false);
    setInterval(() => { if (document.visibilityState === 'visible') loadUsage(false); }, 5 * 60e3);
  }
  // 접속자 우클릭(모바일은 길게 누르기) → 관리자 메뉴
  document.getElementById('presence').addEventListener('contextmenu', (e) => { const b = e.target.closest('[data-cid]'); if (!b) return; e.preventDefault(); openCtx(e.clientX, e.clientY, b.dataset.cid, b.dataset.nick); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#ctx')) closeCtx(); });
  beat();
  setInterval(beat, BEAT_MS);
  addEventListener('xmaschange', renderPresence);
  setInterval(renderPresence, 10e3); // 신호가 끊긴 사람을 목록에서 내린다
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beatIfStale(); });
  // 글을 쓰기 시작하면(채팅·게시판·경매 채팅 입력칸) 미리 서버 시각을 맞춰 둔다. 보낼 때 기다리지 않게
  document.addEventListener('focusin', (e) => { if (e.target.matches?.('#chatinp, #tkb, [data-i="cmT"]')) S.store.clockSoon?.(); });
  addEventListener('pagehide', () => beat(true));
  addEventListener('pageshow', (e) => { if (e.persisted) beat(); });
}

// ---------- 관리자: 채팅 전체 삭제 · 강퇴 ----------
// 채팅 전체 삭제는 문서를 지우지 않고 "이 시각 이전 글은 숨김" 기준 시각만 설정에 적는다(모두의 화면에서 한 번에 사라진다).
act('chatClear', () => needAdmin(async () => {
  if (!confirm('채팅창의 모든 메시지를 지울까요? 모든 사람의 화면에서 사라집니다.')) return;
  try { await S.store.clockSoon?.(); await S.store.patch('meta', 'settings', { chatClearedAt: S.store.serverNow?.() ?? Date.now() }); toast('채팅을 모두 지웠습니다'); } catch (e) { toast('삭제 실패: ' + (e.code || e.message)); }
}));
function closeCtx() { document.getElementById('ctx')?.remove(); }
function openCtx(x, y, id, name) {
  closeCtx();
  const m = document.createElement('div');
  m.id = 'ctx'; m.innerHTML = `<small>${esc(name)}</small><button data-a="kick" data-id="${esc(id)}" data-nick="${esc(name)}">${ic('kick')}강퇴 (10분)</button>`;
  document.body.appendChild(m);
  m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
}
act('kick', (d) => { closeCtx(); needAdmin(async () => {
  if (!confirm(`${d.nick} 님을 강퇴할까요? 10분 동안 접속할 수 없습니다.`)) return;
  try { await S.store.patch('meta', 'kicks', { [d.id]: Date.now() + KICK_MS }); sysChat(`${d.nick} 님이 강퇴되었습니다`); toast('강퇴했습니다'); } catch (e) { toast('강퇴 실패: ' + (e.code || e.message)); }
}); });
// 설정·강퇴 목록(meta)이 바뀔 때마다 호출된다
let kickTimer = 0;
export function onMeta() {
  renderChat(); renderPresence();
  const left = kickedUntil() - Date.now(), el = document.getElementById('kicked');
  clearTimeout(kickTimer);
  if (left <= 0) { if (el) { el.remove(); beat(); } return; }
  if (!el) {
    const k = document.createElement('div');
    k.id = 'kicked'; k.innerHTML = `<div>${ic('kick')}<b>강퇴되었습니다</b><p>관리자가 접속을 제한했습니다.<br><span></span></p></div>`;
    document.body.appendChild(k); beat(true);
  }
  document.querySelector('#kicked span').textContent = `약 ${Math.ceil(left / 60e3)}분 뒤에 다시 들어올 수 있습니다.`;
  kickTimer = setTimeout(onMeta, Math.min(left + 500, 30e3));
}
