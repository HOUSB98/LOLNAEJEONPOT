// 환영 인트로, 닉네임, 접속자 표시, 공용 채팅
import { S, act, esc, uid, col, settings, toast, modal, closeModal, mh, ic, logo } from './core.js';

const cid = localStorage.getItem('naejeon:cid') || (() => { const v = uid(); localStorage.setItem('naejeon:cid', v); return v; })();
export const nick = () => localStorage.getItem('naejeon:nick') || '';
const ONLINE_MS = 5 * 60e3, BEAT_MS = 2 * 60e3;
const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

// ---------- 접속자 ----------
function beat(off) {
  if (!nick()) return;
  S.store.put('presence', cid, { nick: nick(), at: off ? 0 : Date.now() }).catch(() => {});
}
const online = () => col('presence').filter((p) => Date.now() - p.at < ONLINE_MS).sort((a, b) => (a.id === cid ? -1 : b.id === cid ? 1 : a.nick.localeCompare(b.nick, 'ko')));
export function renderPresence() {
  const el = document.getElementById('presence'); if (!el) return;
  const list = online();
  el.innerHTML = `<div class="prh">${ic('users')}<b>접속 중</b><span class="mono">${list.length}</span></div>
    <div class="prl">${list.map((p) => `<button class="${p.id === cid ? 'me' : ''}" ${p.id === cid ? 'data-a="nickEdit" title="닉네임 변경"' : 'disabled'}><i style="--h:${hue(p.nick)}"></i>${esc(p.nick)}${p.id === cid ? '<small>나</small>' : ''}</button>`).join('') || '<span class="mut sm">아직 아무도 없어요</span>'}</div>`;
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
let unread = 0, lastSeenAt = +localStorage.getItem('naejeon:chatseen') || 0, lastSend = 0, tray = false;
const isOpen = () => document.body.classList.contains('chat-open') || matchMedia('(min-width: 1281px)').matches;
const msgs = () => col('chat').sort((a, b) => a.at - b.at);
function send(kind, text) {
  if (!nick()) return askNick(true);
  const now = Date.now();
  if (now - lastSend < 600) return;
  lastSend = now;
  const id = now.toString(36) + Math.random().toString(36).slice(2, 6);
  S.store.put('chat', id, { at: now, cid, nick: nick(), k: kind, t: String(text).slice(0, 200) }).catch((e) => toast('전송 실패: ' + (e.code || e.message)));
}
// 다른 화면에서 쓰는 알림 메시지 (경기 저장, 주사위 결과 등)
export function sysChat(text) {
  const now = Date.now();
  S.store.put('chat', now.toString(36) + Math.random().toString(36).slice(2, 6), { at: now, cid, nick: nick() || '익명', k: 'sys', t: String(text).slice(0, 200) }).catch(() => {});
}
function buildChat() {
  document.getElementById('chat').innerHTML = `
    <header><div class="ch-t"><span class="ch-k"><i class="live"></i>LIVE</span><b>Lobby<i>Chat</i></b><small><span id="chat-on">0</span>명 접속 중 · 모두가 함께 보는 채팅</small></div><button class="btn ghost xs chatx" data-a="chatToggle">${ic('x')}</button></header>
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
  document.getElementById('chatfab').innerHTML = `${ic('chat')}<span id="chatbadge" hidden></span>`;
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
    html += `<div class="cm ${me ? 'me' : ''} ${head ? 'head' : ''}">${head && !me ? `<b class="cn" style="--h:${hue(m.nick)}">${esc(m.nick)}</b>` : ''}<div class="cl">${body}<small>${tm}</small></div></div>`;
  }
  log.innerHTML = html || `<div class="cempty">${ic('chat')}<p>첫 메시지를 남겨 보세요.<br>스티커와 주사위도 있어요.</p></div>`;
  if (atBottom) log.scrollTop = log.scrollHeight;
  const last = list[list.length - 1]?.at || 0;
  if (isOpen()) { lastSeenAt = last; localStorage.setItem('naejeon:chatseen', last); unread = 0; }
  else unread = list.filter((m) => m.at > lastSeenAt && m.cid !== cid).length;
  const b = document.getElementById('chatbadge'); if (b) { b.hidden = !unread; b.textContent = unread > 99 ? '99+' : unread; }
}
act('chatToggle', () => { document.body.classList.toggle('chat-open'); renderChat(true); });
act('chatTray', () => { tray = !tray; document.getElementById('chattray').hidden = !tray; renderChat(true); });
act('chatStk', (d) => send('s', d.k));
act('chatEmo', (d) => { const i = document.getElementById('chatinp'); i.value += d.e; i.focus(); });
act('chatRoll', () => send('r', 1 + Math.floor(Math.random() * 100)));

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
  buildChat(); renderPresence(); renderChat(true); splash();
  beat();
  setInterval(() => { if (document.visibilityState === 'visible') beat(); renderPresence(); }, BEAT_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); });
  addEventListener('pagehide', () => beat(true));
}
