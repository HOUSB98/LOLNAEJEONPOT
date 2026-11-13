// 환영 인트로, 닉네임, 접속자 표시, 공용 채팅
import { S, act, esc, uid, col, settings, toast, modal, closeModal, mh, ic, logo, needAdmin } from './core.js';

const cid = localStorage.getItem('naejeon:cid') || (() => { const v = uid(); localStorage.setItem('naejeon:cid', v); return v; })();
export const nick = () => localStorage.getItem('naejeon:nick') || '';
// 10분마다 생존 신호를 보내고, 12분 동안 신호가 없으면 나간 것으로 본다. 탭을 닫으면 그 즉시 나감 표시(at:0)를 보낸다.
const ONLINE_MS = 12 * 60e3, BEAT_MS = 10 * 60e3;
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

// ---------- 접속자 ----------
// 강퇴: meta/kicks 문서에 { 접속기기id: 해제시각 } 으로 적는다. 가벼운 잠금이라 브라우저 저장소를 지우면 다시 들어올 수 있다.
const KICK_MS = 10 * 60e3;
const kickedUntil = (id = cid) => +(S.store.data.meta?.kicks?.[id] || 0);
const isKicked = (id = cid) => kickedUntil(id) > Date.now();
function beat(off) {
  if (!nick()) return;
  if (off) return S.store.bye('presence', cid, 'at', 0); // 탭 닫기·숨김 직전에도 끝까지 전송되는 방식
  if (isKicked()) return;
  S.store.put('presence', cid, { nick: nick(), at: Date.now() }).catch(() => {});
}
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
export function renderPresence() {
  const el = document.getElementById('presence'); if (!el) return;
  const list = online(), now = new Map(list.map((p) => [p.id, p.nick]));
  if (prevOn) {
    for (const [id, name] of now) if (id !== cid && !prevOn.has(id)) feed(name, 'join');
    for (const [id, name] of prevOn) if (id !== cid && !now.has(id)) feed(name, 'leave');
  }
  const bump = prevOn && prevOn.size !== now.size;
  prevOn = now;
  const sig = list.map((p) => p.id + ':' + p.nick).join('|');
  if (sig === prSig && el.firstChild) return; // 목록이 그대로면 다시 그리지 않는다
  prSig = sig;
  const cnt = String(list.length).padStart(2, '0');
  el.innerHTML = `<div class="prh">${ic('users')}<b>접속 중</b><span class="pcount ${bump ? 'bump' : ''}" title="현재 접속자 ${list.length}명"><i></i><b class="mono">${cnt}</b><small>ONLINE</small></span></div>
    <div class="prl">${list.map((p) => `<button class="${p.id === cid ? 'me' : ''}" ${p.id === cid ? 'data-a="nickEdit" title="닉네임 변경"' : `data-cid="${esc(p.id)}" data-nick="${esc(p.nick)}" title="우클릭: 관리자 메뉴"`}><i style="--h:${hue(p.nick)}"></i>${esc(p.nick)}${p.id === cid ? '<small>나</small>' : ''}</button>`).join('') || '<span class="mut sm">아직 아무도 없어요</span>'}</div>`;
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
act('nickEdit', () => askNick(false));

// ---------- 채팅 ----------
const STICKERS = [
  ['gg', 'GG', 'gold'], ['wp', 'WP', 'teal'], ['?', '?', 'yellow'], ['omw', '가는 중', 'teal'], ['danger', '위험!', 'red'], ['help', '도와줘', 'blue'],
  ['carry', '캐리했다', 'gold'], ['bus', '버스 탑승', 'teal'], ['jg', '정글 차이', 'red'], ['throw', '던졌다', 'red'], ['again', '한 판 더', 'blue'], ['nice', '명장면', 'gold'],
  ['troll', '트롤 검거', 'yellow'], ['sorry', '미안합니다', 'blue'], ['ff', '15 ㄱ?', 'red'], ['gap', '격이 다르다', 'gold'],
];
const EMOJI = ['😂', '🔥', '👍', '😭', '🤡', '💀', '🫡', '🙏', '👀', '🎉', '😎', '🥲'];
const STK = Object.fromEntries(STICKERS.map((s) => [s[0], s]));
let unread = 0, lastSeenAt = +localStorage.getItem('naejeon:chatseen') || 0, lastChatAt = 0, tray = false;
const isOpen = () => !document.body.classList.contains('chat-closed');
const msgs = () => col('chat').filter((m) => !m.deleted && m.at > (+settings().chatClearedAt || 0)).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
function send(kind, text) {
  if (isKicked()) return toast('강퇴 상태에서는 채팅을 보낼 수 없습니다');
  if (!nick()) return askNick(true);
  // 기기 시계 차이로 메시지 순서가 뒤섞이지 않게 서버 시각을 기준으로 하고,
  // 같은 기기에서 연속 전송해도 타임스탬프가 겹치지 않게 한다.
  const now = Math.max(S.store.serverNow?.() ?? Date.now(), lastChatAt + 1);
  lastChatAt = now;
  const id = now.toString(36) + Math.random().toString(36).slice(2, 6);
  S.store.put('chat', id, { at: now, cid, nick: nick(), k: kind, t: String(text).slice(0, 200) }).catch((e) => toast('전송 실패: ' + (e.code || e.message)));
}
// 다른 화면에서 쓰는 알림 메시지 (경기 저장, 주사위 결과 등)
export function sysChat(text) {
  const now = Math.max(S.store.serverNow?.() ?? Date.now(), lastChatAt + 1);
  lastChatAt = now;
  S.store.put('chat', now.toString(36) + Math.random().toString(36).slice(2, 6), { at: now, cid, nick: nick() || '익명', k: 'sys', t: String(text).slice(0, 200) }).catch(() => {});
}
function buildChat() {
  document.getElementById('chat').innerHTML = `
    <header><div class="ch-t"><span class="ch-k"><i class="live"></i>LIVE</span><b>Lobby<i>Chat</i></b><small><span id="chat-on">0</span>명 접속 중</small></div><div class="ch-btns"><button class="btn ghost xs" data-a="chatClear" title="채팅 전체 삭제 (관리자)" aria-label="채팅 전체 삭제">${ic('trash')}</button><button class="btn ghost xs chatx" data-a="chatToggle" title="채팅창 접기" aria-label="채팅창 접기">${ic('fold')}</button></div></header>
    <div id="chatlog"></div>
    <div id="chattray" hidden>
      <div class="stk-grid">${STICKERS.map(([k, t, c]) => `<button class="sticker ${c}" data-a="chatStk" data-k="${k}">${esc(t)}</button>`).join('')}</div>
      <div class="emo-row">${EMOJI.map((e) => `<button data-a="chatEmo" data-e="${e}">${e}</button>`).join('')}</div>
    </div>
    <form id="chatform"><button type="button" class="cbtn2" data-a="chatTray" title="스티커">${ic('star')}</button><button type="button" class="cbtn2" data-a="chatRoll" title="주사위 1~100">${ic('dice')}</button>
      <input id="chatinp" class="inp grow" maxlength="200" placeholder="메시지 입력…" autocomplete="off"><button class="cbtn2 go" title="전송">${ic('send')}</button></form>`;
  document.getElementById('chatform').onsubmit = (e) => {
    e.preventDefault();
    const inp = document.getElementById('chatinp'), v = inp.value.trim();
    if (!v) return;
    send('m', v); inp.value = '';
  };
  const fab = document.getElementById('chatfab');
  fab.title = '채팅창 펼치기';
  fab.innerHTML = `<span class="cf-ring"></span><span class="cf-core">${ic('chat')}<i class="cf-line"></i></span><em>CHAT</em><span id="chatbadge" hidden></span>`;
  const lz = document.createElement('div'); lz.id = 'chatlaser'; lz.innerHTML = '<i class="a"></i><i class="b"></i><u></u>'; document.body.appendChild(lz);
  // 넓은 화면은 지난번 상태를 기억하고, 좁은 화면은 접힌 채로 시작한다
  if (!matchMedia('(min-width: 1281px)').matches || localStorage.getItem('naejeon:chatclosed') === '1') document.body.classList.add('chat-closed');
}
export function renderChat(force) {
  const log = document.getElementById('chatlog'); if (!log) return;
  const list = msgs(), atBottom = force || log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  let prevDay = '', prevWho = '', html = '';
  for (const m of list) {
    const d = new Date(m.at), day = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, tm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (day !== prevDay) { html += `<div class="cday"><span>${day}</span></div>`; prevDay = day; prevWho = ''; }
    if (m.k === 'sys') { html += `<div class="csys">${esc(m.t)}<small>${tm}</small></div>`; prevWho = ''; continue; }
    const me = m.cid === cid, who = m.cid + m.nick, head = who !== prevWho;
    prevWho = who;
    const body = m.k === 's' && STK[m.t] ? `<span class="sticker big ${STK[m.t][2]}">${esc(STK[m.t][1])}</span>` : m.k === 'r' ? `<span class="croll">${ic('dice')}<b>${esc(m.t)}</b><small>1~100</small></span>` : `<span class="cb ${/^\p{Extended_Pictographic}{1,3}$/u.test(m.t) ? 'emo' : ''}">${esc(m.t)}</span>`;
    html += `<div class="cm ${me ? 'me' : ''} ${head ? 'head' : ''}">${head && !me ? `<b class="cn" style="--h:${hue(m.nick)}">${esc(m.nick)}</b>` : ''}<div class="cl">${body}<small>${tm}</small>${me ? `<button class="cdel" data-a="chatDel" data-id="${m.id}" title="내 메시지 지우기" aria-label="메시지 지우기">${ic('x')}</button>` : ''}</div></div>`;
  }
  log.innerHTML = html || `<div class="cempty">${ic('chat')}<p>첫 메시지를 남겨 보세요.<br>스티커와 주사위도 있어요.</p></div>`;
  if (atBottom) log.scrollTop = log.scrollHeight;
  const last = list[list.length - 1]?.at || 0;
  if (isOpen()) { lastSeenAt = last; localStorage.setItem('naejeon:chatseen', last); unread = 0; }
  else unread = list.filter((m) => m.at > lastSeenAt && m.cid !== cid).length;
  const b = document.getElementById('chatbadge'); if (b) { b.hidden = !unread; b.textContent = unread > 99 ? '99+' : unread; }
}
// 접기/펼치기: 레이저 선이 그어진 뒤 위아래로 갈라지며 열리고, 닫을 때는 선으로 모였다가 사라진다(#chatlaser + #chat clip-path)
let chatAnim = 0;
act('chatToggle', () => {
  const b = document.body, chat = document.getElementById('chat'), lz = document.getElementById('chatlaser');
  const closing = isOpen(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, T = reduce ? 0 : closing ? 560 : 760;
  clearTimeout(chatAnim); chat.classList.remove('opening', 'closing'); lz.classList.remove('opening', 'closing');
  const done = () => { chat.classList.remove('opening', 'closing'); lz.classList.remove('opening', 'closing'); if (closing) b.classList.add('chat-closed'); else renderChat(true); };
  if (!closing) b.classList.remove('chat-closed');
  if (matchMedia('(min-width: 1281px)').matches) localStorage.setItem('naejeon:chatclosed', closing ? '1' : '0');
  if (!T) return done();
  void chat.offsetWidth;
  chat.classList.add(closing ? 'closing' : 'opening'); lz.classList.add(closing ? 'closing' : 'opening');
  chatAnim = setTimeout(done, T);
  if (!closing) renderChat(true);
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
    <div class="sp-box">${logo(true, 148)}
      <div class="sp-word"><span>NAEJEON</span><i>POT</i></div>
      <p class="sp-sub">${first ? '소환사의 협곡에 오신 것을 환영합니다' : `${esc(nick())} 님, 다시 오셨군요`}</p>
      <p class="sp-league">${esc(name)}</p>
      ${first ? `<form id="spf"><input id="spn" class="inp" maxlength="12" placeholder="닉네임을 입력하세요" autocomplete="off"><button class="btn pri">입장</button></form>` : '<div class="sp-bar"><i></i></div>'}
    </div><small class="sp-skip">${first ? '닉네임은 접속자 목록과 채팅에 표시됩니다' : '화면을 누르면 바로 입장합니다'}</small>`;
  el.classList.add('on');
  const stop = embers(el.querySelector('canvas'));
  const close = () => { if (el.dataset.done) return; el.dataset.done = 1; sessionStorage.setItem('naejeon:welcomed', '1'); el.classList.add('out'); setTimeout(() => { stop(); el.remove(); }, 900); };
  if (first) {
    setTimeout(() => el.querySelector('#spn')?.focus(), 1900);
    el.querySelector('#spf').onsubmit = (e) => { e.preventDefault(); if (setNick(el.querySelector('#spn').value)) close(); };
  } else { setTimeout(close, 3600); el.addEventListener('click', close); }
}

export function initSocial() {
  buildChat(); renderPresence(); renderChat(true); splash(); onMeta();
  // 접속자 우클릭(모바일은 길게 누르기) → 관리자 메뉴
  document.getElementById('presence').addEventListener('contextmenu', (e) => { const b = e.target.closest('[data-cid]'); if (!b) return; e.preventDefault(); openCtx(e.clientX, e.clientY, b.dataset.cid, b.dataset.nick); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#ctx')) closeCtx(); });
  beat();
  setInterval(beat, BEAT_MS);
  setInterval(renderPresence, 10e3); // 신호가 끊긴 사람을 목록에서 내린다
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); });
  addEventListener('pagehide', () => beat(true));
  addEventListener('pageshow', (e) => { if (e.persisted) beat(); });
}

// ---------- 관리자: 채팅 전체 삭제 · 강퇴 ----------
// 채팅 전체 삭제는 문서를 지우지 않고 "이 시각 이전 글은 숨김" 기준 시각만 설정에 적는다(모두의 화면에서 한 번에 사라진다).
act('chatClear', () => needAdmin(async () => {
  if (!confirm('채팅창의 모든 메시지를 지울까요? 모든 사람의 화면에서 사라집니다.')) return;
  try { await S.store.patch('meta', 'settings', { chatClearedAt: S.store.serverNow?.() ?? Date.now() }); toast('채팅을 모두 지웠습니다'); } catch (e) { toast('삭제 실패: ' + (e.code || e.message)); }
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
