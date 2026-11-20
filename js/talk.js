// 익명 게시판: 글쓴이는 누구든 '익명'으로만 보인다(이름·닉네임·기기 정보를 아예 저장하지 않는다).
// 글마다 비밀번호를 정하고, 그 비밀번호로 본인이 고치거나 지운다(글·댓글 모두). 비밀번호는 원문이 아니라 해시만 저장한다.
// 지운 글은 문서를 없애지 않고 deleted:true 로 표시한다(사이트 공통 규칙).
import { S, page, act, esc, uid, col, refresh, toast, modal, closeModal, mh, ic, sha, needAdmin } from './core.js';
import { sysChat } from './social.js';
import { notify as hookNotify } from './hook.js';

const MAX_TITLE = 60, MAX_BODY = 2000, COOLDOWN = 20e3;
const TK = { title: '', body: '', pw: '', open: false, loading: false, busy: false, seen: null, mine: new Set() };
const lastKey = () => 'naejeon:talklast:' + S.key;
const hashPw = (id, pw) => sha(`post:${id}:${pw}`);
function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(t); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
// 실시간으로는 최근 5개만 받는다(store.js POST_LIMIT). 나머지 글은 접어 두고, 누를 때만 읽는다. '더 보기'로 읽은 이전 글은 OLD 에 따로 둔다
const OLD = {};
const CNT = { n: null, at: 0, busy: false }; // 전체 글 수(서버에서 세기, 1분에 한 번까지)
const posts = () => { const live = col('posts'), ids = new Set(live.map((p) => p.id)); return [...live, ...Object.values(OLD).filter((p) => !ids.has(p.id))].filter((p) => !p.deleted && p.body).sort((a, b) => b.at - a.at); };
const allLoaded = () => { const live = col('posts'), ids = new Set(live.map((p) => p.id)); return [...live, ...Object.values(OLD).filter((p) => !ids.has(p.id))]; };
function recount(force) {
  if (CNT.busy || (!force && Date.now() - CNT.at < 60e3)) return;
  CNT.busy = true; CNT.at = Date.now();
  S.store.count('posts', 'deleted', false).then((n) => { CNT.n = n; }).catch(() => {}).finally(() => { CNT.busy = false; if (S.page === 'talk') refresh(); });
}
export const postsChanged = () => { CNT.at = 0; }; // 새 글·삭제가 생기면 다음 화면에서 다시 센다
async function syncOld(id) { if (OLD[id]) { const p = await S.store.get('posts', id).catch(() => null); if (p) OLD[id] = p; } }

// ---------- 내가 쓴 글의 새 댓글(내 페이지) ----------
// 이 기기에서 쓴 글 id와 '마지막으로 본 댓글 수'만 이 브라우저에 기억한다(서버에는 글쓴이 정보를 저장하지 않는 원칙 그대로).
const myKey = () => 'naejeon:myposts:' + S.key;
const myPosts = () => { try { return JSON.parse(localStorage.getItem(myKey())) || {}; } catch { return {}; } };
const saveMy = (m) => { const keep = Object.keys(m).sort().slice(-20); try { localStorage.setItem(myKey(), JSON.stringify(Object.fromEntries(keep.map((k) => [k, m[k]])))); } catch {} };
export function markPostSeen(id, cn) { const m = myPosts(); if (!(id in m)) return; m[id] = Math.max(0, +cn || 0); saveMy(m); }
const MP = {}; // 실시간 목록(최근 5개)에 없는 내 글은 2분에 한 번만 직접 읽는다
export function myPostAlerts(onLoad) {
  const m = myPosts(), ids = Object.keys(m).sort().reverse().slice(0, 5), live = Object.fromEntries(allLoaded().map((p) => [p.id, p]));
  const out = [];
  for (const id of ids) {
    let p = live[id];
    if (!p) {
      const c = MP[id];
      if (!c || (!c.busy && Date.now() - c.at > 120e3)) { MP[id] = { busy: true, at: 0, p: c?.p }; S.store.get('posts', id).catch(() => undefined).then((x) => { MP[id] = { at: Date.now(), p: x === undefined ? c?.p : x }; onLoad?.(); }); }
      p = MP[id].p;
      if (p === undefined) continue;
    }
    if (!p || p.deleted) { delete m[id]; saveMy(m); continue; }
    const cn = cmCount(p);
    out.push({ id, title: p.title || String(p.body || '').slice(0, 30), at: +p.at || 0, cn, fresh: Math.max(0, cn - (+m[id] || 0)) });
  }
  return out;
}

// ---------- 공감 / 비공감 ----------
// 글 문서의 rx 에 { 표시값: 1 | -1 } 로 모은다. 표시값은 '글 id + 이 기기 id'의 해시 앞부분이라 누가 눌렀는지 알 수 없고, 한 기기는 글마다 한 번만 반영된다.
// 내가 누른 것은 화면 강조용으로 이 브라우저에도 기억한다. 같은 버튼을 다시 누르면 취소, 반대 버튼을 누르면 바뀐다.
const myRxKey = () => 'naejeon:rx:' + S.key;
const myRx = () => { try { return JSON.parse(localStorage.getItem(myRxKey())) || {}; } catch { return {}; } };
const rxCount = (p) => { const v = Object.values(p.rx || {}); return { up: v.filter((x) => x === 1).length, down: v.filter((x) => x === -1).length }; };
const THUMB = (down) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${down ? ' style="transform:scaleY(-1)"' : ''}><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-7.5a2 2 0 0 1 3.4 1.6L13.7 9H19a2 2 0 0 1 2 2.3l-1.3 7.5a2 2 0 0 1-2 1.7H7"/></svg>`;
function rxBar(p) {
  const c = rxCount(p), me = myRx()[p.id] || 0;
  return `<div class="tk-rx"><button class="tk-rb up ${me === 1 ? 'on' : ''}" data-a="tkRx" data-id="${p.id}" data-v="1" aria-pressed="${me === 1}" title="공감">${THUMB(false)}<span>공감</span>${c.up ? `<b class="mono">${c.up}</b>` : ''}</button><button class="tk-rb down ${me === -1 ? 'on' : ''}" data-a="tkRx" data-id="${p.id}" data-v="-1" aria-pressed="${me === -1}" title="비공감">${THUMB(true)}${c.down ? `<b class="mono">${c.down}</b>` : ''}</button></div>`;
}
const rxBusy = new Set();
act('tkRx', async (d) => {
  if (rxBusy.has(d.id)) return;
  const v = +d.v, mine = myRx(), was = mine[d.id] || 0, next = was === v ? 0 : v;
  const cid = localStorage.getItem('naejeon:cid') || 'anon', h = (await sha(`rx:${d.id}:${cid}`)).slice(0, 16);
  rxBusy.add(d.id);
  try {
    await S.store.tx('posts', d.id, (p) => {
      if (!p || p.deleted) return null;
      const rx = { ...(p.rx || {}) };
      if (next) rx[h] = next; else delete rx[h];
      return { ...p, rx };
    });
    await syncOld(d.id);
    if (next) mine[d.id] = next; else delete mine[d.id];
    try { localStorage.setItem(myRxKey(), JSON.stringify(mine)); } catch {}
    refresh();
  } catch (e) { toast('반영 실패: ' + (e.code || e.message)); }
  rxBusy.delete(d.id);
});

// ---------- 댓글 ----------
// comments/{id} = { pid(글 id), at, body, pw(해시), deleted }. 글쓴이 정보는 저장하지 않는다(모두 '익명').
// 댓글 수는 글 문서의 cn 에 같이 적어 두어, 목록에서는 댓글을 읽지 않고 숫자만 보여 준다.
// 댓글은 펼칠 때 처음 5개, '댓글 더 보기'로 10개씩 읽는다(읽은 만큼만 읽기 사용량). 문서 id 가 시간 순이라 id 순서 = 작성 순서.
const CM_MAX = 500, CM_COOL = 10e3, CM_FIRST = 5, CM_STEP = 10;
const CM = {}; // 글 id → { open, list: [], done, loading, text, pw, busy }
const cmOf = (pid) => (CM[pid] ||= { open: false, list: [], done: false, loading: false, text: '', pw: '', busy: false });
const cmCount = (p) => Math.max(0, +p.cn || 0);
const cmPw = (id, pw) => sha(`comment:${id}:${pw}`);
async function cmLoad(pid, n) {
  const c = cmOf(pid); if (c.loading || c.done) return;
  c.loading = true; refresh();
  try {
    const after = c.list.length ? c.list[c.list.length - 1].id : '';
    const docs = await S.store.byField('comments', 'pid', pid, after, n);
    const ids = new Set(c.list.map((x) => x.id));
    c.list = [...c.list, ...docs.filter((d) => !ids.has(d.id))].sort((a, b) => (a.id < b.id ? -1 : 1));
    if (docs.length < n) c.done = true;
  } catch (e) { toast('댓글을 불러오지 못했어요: ' + (e.code || e.message)); }
  c.loading = false; refresh();
}
function cmBox(p) {
  const c = cmOf(p.id), n = cmCount(p), shown = c.list.filter((x) => !x.deleted), left = Math.max(0, n - shown.length);
  const btn = `<button class="tk-cb ${c.open ? 'on' : ''}" data-a="cmToggle" data-id="${p.id}" aria-expanded="${c.open}">${ic('talk')}<span>댓글</span>${n ? `<b class="mono">${n}</b>` : ''}</button>`;
  if (!c.open) return { btn, box: '' };
  const box = `<div class="tk-cm">
      ${shown.map((x) => `<div class="tk-c"><i class="tk-cav">${ic('user')}</i><div class="tk-cb2"><div class="tk-ch"><b>익명</b><small class="mut" title="${new Date(x.at).toLocaleString('ko')}">${ago(x.at)}${x.edited ? ' · 수정됨' : ''}</small><span class="grow"></span><button class="btn ghost xs" data-a="cmEdit" data-pid="${p.id}" data-id="${x.id}" title="댓글 수정">${ic('edit')}</button><button class="btn ghost xs" data-a="cmDel" data-pid="${p.id}" data-id="${x.id}" title="댓글 삭제">${ic('trash')}</button></div><p>${esc(x.body)}</p></div></div>`).join('')}
      ${c.loading ? '<p class="mut sm tk-cl">불러오는 중…</p>' : !c.done && left > 0 ? `<button class="btn ghost xs block tk-cmore" data-a="cmMore" data-id="${p.id}">댓글 더 보기 (${left}개)</button>` : ''}
      ${!shown.length && c.done ? '<p class="mut sm tk-cl">첫 댓글을 남겨 보세요.</p>' : ''}
      <form class="tk-cf" data-pid="${p.id}" onsubmit="return false">
        <textarea class="inp" id="cmt-${p.id}" maxlength="${CM_MAX}" rows="1" placeholder="익명으로 댓글 달기" data-i="cmT" data-id="${p.id}">${esc(c.text)}</textarea>
        <input class="inp tk-cpw" id="cmp-${p.id}" type="password" maxlength="20" placeholder="비밀번호" value="${esc(c.pw)}" data-i="cmP" data-id="${p.id}" autocomplete="new-password">
        <button type="button" class="btn pri xs" data-a="cmPost" data-id="${p.id}" ${c.busy ? 'disabled' : ''}>${ic('send')}등록</button>
      </form></div>`;
  return { btn, box };
}
act('cmToggle', (d) => { const c = cmOf(d.id); c.open = !c.open; if (c.open) { const p = allLoaded().find((x) => x.id === d.id); if (p) markPostSeen(d.id, cmCount(p)); } refresh(); if (c.open && !c.list.length && !c.done) cmLoad(d.id, CM_FIRST); });
act('cmMore', (d) => cmLoad(d.id, CM_STEP));
act('cmT', (d, el) => { cmOf(d.id).text = el.value; });
act('cmP', (d, el) => { cmOf(d.id).pw = el.value; });
const cmLast = () => 'naejeon:cmlast:' + S.key;
act('cmPost', async (d) => {
  const pid = d.id, c = cmOf(pid), body = c.text.trim().slice(0, CM_MAX), pw = c.pw;
  const post = S.store.data.posts?.[pid] || OLD[pid];
  if (!post || post.deleted) return toast('지워진 글이에요');
  if (!body) return toast('댓글 내용을 적어 주세요');
  if (pw.length < 4) return toast('수정·삭제용 비밀번호를 4자 이상 정해 주세요');
  const wait = +localStorage.getItem(cmLast()) + CM_COOL - Date.now();
  if (wait > 0) return toast(`${Math.ceil(wait / 1000)}초 뒤에 다시 달 수 있어요`);
  c.busy = true; refresh();
  try {
    await S.store.clockSoon?.(); // 글 시각은 서버 시각 기준(필요할 때만 맞춤)
    const id = Date.now().toString(36) + uid(), doc = { pid, at: S.store.serverNow?.() || Date.now(), body, pw: await cmPw(id, pw), deleted: false };
    await S.store.put('comments', id, doc);
    await S.store.tx('posts', pid, (p) => (p ? { ...p, cn: cmCount(p) + 1 } : null)).catch(() => {});
    await syncOld(pid);
    { const m = myPosts(); if (pid in m) { m[pid] = (+m[pid] || 0) + 1; saveMy(m); } } // 내 글에 내가 단 댓글은 새 댓글로 치지 않는다
    localStorage.setItem(cmLast(), String(Date.now()));
    c.list = [...c.list, { ...doc, id }]; c.text = '';
    toast('익명으로 댓글을 달았어요');
  } catch (e) { toast('댓글 등록 실패: ' + (e.code || e.message)); }
  c.busy = false; refresh();
});
async function cmRemove(pid, id, by) {
  try {
    await S.store.patch('comments', id, { deleted: true, deletedBy: by, deletedAt: Date.now() });
    await S.store.tx('posts', pid, (p) => (p ? { ...p, cn: Math.max(0, cmCount(p) - 1) } : null)).catch(() => {});
    await syncOld(pid);
    const c = cmOf(pid); c.list = c.list.filter((x) => x.id !== id);
    closeModal(); toast('댓글을 지웠어요'); refresh();
  } catch (e) { toast('삭제 실패: ' + (e.code || e.message)); }
}
act('cmDel', (d) => {
  const x = cmOf(d.pid).list.find((y) => y.id === d.id); if (!x) return;
  const el = modal(`${mh(`${ic('trash')}댓글 삭제`)}
    <p class="mut">댓글을 달 때 정한 비밀번호를 입력하세요.</p>
    <form class="row" id="cmdf"><input class="inp grow" id="cmdp" type="password" autocomplete="off" placeholder="비밀번호"><button class="btn pri">삭제</button></form>
    <p class="hint">비밀번호를 잊었다면 관리자에게 부탁하세요. <button class="btn ghost xs" data-a="cmAdminDel" data-pid="${d.pid}" data-id="${x.id}">관리자로 삭제</button></p>`);
  const inp = el.querySelector('#cmdp'); inp.focus();
  el.querySelector('#cmdf').onsubmit = async (e) => {
    e.preventDefault(); if (!inp.value) return;
    if ((await cmPw(x.id, inp.value)) !== x.pw) { inp.value = ''; inp.focus(); return toast('비밀번호가 맞지 않아요'); }
    cmRemove(d.pid, x.id, 'author');
  };
});
// 댓글 수정: 댓글을 달 때 정한 비밀번호가 맞으면 내용만 바꾼다(edited 에 고친 시각)
act('cmEdit', (d) => {
  const x = cmOf(d.pid).list.find((y) => y.id === d.id); if (!x) return;
  const el = modal(`${mh(`${ic('edit')}댓글 수정`)}
    <form class="col" id="cmef"><textarea class="inp" id="cmeb" maxlength="${CM_MAX}" rows="3">${esc(x.body)}</textarea>
      <div class="row"><input class="inp grow" id="cmep" type="password" autocomplete="off" placeholder="댓글을 달 때 정한 비밀번호"><button class="btn pri">${ic('save')}저장</button></div></form>`);
  const tb = el.querySelector('#cmeb'), inp = el.querySelector('#cmep'); tb.focus(); tb.setSelectionRange(tb.value.length, tb.value.length);
  let busy = false;
  el.querySelector('#cmef').onsubmit = async (e) => {
    e.preventDefault(); if (busy) return;
    const body = tb.value.trim().slice(0, CM_MAX);
    if (!body) return toast('댓글 내용을 적어 주세요');
    if (body === x.body) return toast('바뀐 내용이 없어요');
    if (!inp.value) return inp.focus();
    if ((await cmPw(x.id, inp.value)) !== x.pw) { inp.value = ''; inp.focus(); return toast('비밀번호가 맞지 않아요'); }
    busy = true;
    try {
      const edited = S.store.serverNow?.() || Date.now();
      await S.store.patch('comments', x.id, { body, edited });
      Object.assign(x, { body, edited });
      closeModal(); toast('댓글을 고쳤어요'); refresh();
    } catch (err) { busy = false; toast('수정 실패: ' + (err.code || err.message)); }
  };
});
act('cmAdminDel', (d) => needAdmin(() => { if (confirm('관리자 권한으로 이 댓글을 지울까요?')) cmRemove(d.pid, d.id, 'admin'); }));

page('talk', {
  render() {
    const list = posts(), shown = list;
    recount(false);
    const total = CNT.n ?? list.length, more = Math.max(0, total - list.length);
    const fresh = (p) => TK.seen && !TK.seen.has(p.id); // 처음 연 화면 이후에 새로 올라온 글만 떠오르는 효과
    const form = TK.open ? `<form class="panel tk-form" id="tkf" onsubmit="return false">
        <div class="tk-who">${ic('user')}<b>익명</b><small>글쓴이는 항상 '익명'으로 표시됩니다</small></div>
        <input id="tkt" class="inp" maxlength="${MAX_TITLE}" placeholder="제목 (선택)" value="${esc(TK.title)}" data-i="tkT" autocomplete="off">
        <textarea id="tkb" class="inp tk-body" maxlength="${MAX_BODY}" placeholder="하고 싶은 말을 자유롭게 적어 주세요. 다른 사람을 불쾌하게 하는 글은 관리자가 지울 수 있어요." data-i="tkB">${esc(TK.body)}</textarea>
        <div class="tk-row"><label class="tk-pw">${ic('lock')}<input id="tkp" class="inp" type="password" maxlength="20" placeholder="수정·삭제용 비밀번호 (4자 이상)" value="${esc(TK.pw)}" data-i="tkP" autocomplete="new-password"></label>
          <small class="mut tk-len">${TK.body.length}/${MAX_BODY}</small><span class="grow"></span>
          <button type="button" class="btn ghost" data-a="tkCancel">취소</button><button type="button" class="btn pri" data-a="tkPost" ${TK.busy ? 'disabled' : ''}>${ic('send')}글 올리기</button></div>
        <p class="hint">비밀번호는 글을 고치거나 지울 때 필요해요. 잊어버리면 지울 수 없으니 기억해 두세요.</p>
      </form>`
      : `<button class="panel tk-open" data-a="tkOpen">${ic('user')}<span>익명으로 글 쓰기…</span>${ic('edit')}</button>`;
    return `<div class="h2row"><h1>${ic('talk')}익명 게시판</h1><span class="tag">${total}개</span></div>
      <p class="hint">누가 썼는지 아무도 모릅니다. 글쓴이 정보는 저장되지 않고 모두 <b>익명</b>으로 보입니다.</p>
      ${form}
      <div class="tk-list">${shown.map((p) => `<article class="panel tk-post ${fresh(p) ? 'new' : ''}">
          <header><i class="tk-av">${ic('user')}</i><b>익명</b><small class="mut" title="${new Date(p.at).toLocaleString('ko')}">${ago(p.at)}${p.edited ? ' · 수정됨' : ''}</small><span class="grow"></span>
            <button class="btn ghost xs" data-a="tkEdit" data-id="${p.id}" title="글 수정">${ic('edit')}</button><button class="btn ghost xs" data-a="tkDel" data-id="${p.id}" title="글 삭제">${ic('trash')}</button></header>
          ${p.title ? `<h3>${esc(p.title)}</h3>` : ''}<p class="tk-text">${esc(p.body)}</p>
          ${(() => { const c = cmBox(p); return `<div class="tk-foot">${rxBar(p)}${c.btn}</div>${c.box}`; })()}
        </article>`).join('') || '<div class="panel empty">아직 글이 없어요. 첫 글을 남겨 보세요!</div>'}</div>
      ${more > 0 ? `<button class="btn block ghost" data-a="tkMore" ${TK.loading ? 'disabled' : ''}>${TK.loading ? '불러오는 중…' : `접힌 이전 글 ${more}개 펼치기`}</button>` : ''}`;
  },
  after() { TK.seen = new Set(posts().map((p) => p.id)); },
});
act('tkOpen', () => { TK.open = true; refresh(); setTimeout(() => document.getElementById('tkb')?.focus(), 50); });
act('tkCancel', () => { TK.open = false; refresh(); });
act('tkT', (d, el) => { TK.title = el.value; });
act('tkB', (d, el) => { TK.body = el.value; const n = document.querySelector('.tk-len'); if (n) n.textContent = `${el.value.length}/${MAX_BODY}`; });
act('tkP', (d, el) => { TK.pw = el.value; });
// 이전 글 10개씩: 지금까지 받은 글 중 가장 오래된 것보다 전 글을 한 번 읽는다(지운 글이 섞이면 조금 더 읽음)
act('tkMore', async () => {
  if (TK.loading) return; TK.loading = true; refresh();
  try {
    let got = 0;
    for (let i = 0; i < 4 && got < 10; i++) {
      const oldest = Math.min(...allLoaded().map((p) => +p.at || Infinity));
      const docs = await S.store.older('posts', Number.isFinite(oldest) ? oldest : Date.now() + 1, 10);
      docs.forEach((p) => { OLD[p.id] = p; if (!p.deleted && p.body) got++; });
      if (docs.length < 10) break;
    }
  } catch (e) { toast('불러오기 실패: ' + (e.code || e.message)); }
  TK.loading = false; refresh();
});
act('tkPost', async () => {
  const title = TK.title.trim().slice(0, MAX_TITLE), body = TK.body.trim().slice(0, MAX_BODY), pw = TK.pw;
  if (!body) return toast('내용을 적어 주세요');
  if (pw.length < 4) return toast('수정·삭제용 비밀번호를 4자 이상 정해 주세요');
  const wait = +localStorage.getItem(lastKey()) + COOLDOWN - Date.now();
  if (wait > 0) return toast(`${Math.ceil(wait / 1000)}초 뒤에 다시 올릴 수 있어요`);
  TK.busy = true; refresh();
  try {
    const id = Date.now().toString(36) + uid();
    TK.mine.add(id); // 내가 쓴 글은 나에게 알리지 않는다
    { const m = myPosts(); m[id] = 0; saveMy(m); }
    await S.store.clockSoon?.();
    await S.store.put('posts', id, { at: S.store.serverNow?.() || Date.now(), title, body, pw: await hashPw(id, pw), deleted: false });
    localStorage.setItem(lastKey(), String(Date.now()));
    Object.assign(TK, { title: '', body: '', pw: '', open: false });
    toast('익명으로 글을 올렸어요');
    sysChat('익명 게시판에 새 글이 올라왔어요');
    hookNotify('post', id); // 디스코드 알림(글쓴이 정보 없이 제목·앞부분만, 연동 서버가 글을 직접 확인)
  } catch (e) { toast('올리기 실패: ' + (e.code || e.message)); }
  TK.busy = false; refresh();
});
async function remove(id, by) {
  try { await S.store.patch('posts', id, { deleted: true, deletedBy: by, deletedAt: Date.now() }); if (OLD[id]) OLD[id] = { ...OLD[id], deleted: true }; recount(true); closeModal(); toast('글을 지웠어요'); }
  catch (e) { toast('삭제 실패: ' + (e.code || e.message)); }
}
act('tkDel', (d) => {
  const p = S.store.data.posts?.[d.id] || OLD[d.id]; if (!p) return;
  const el = modal(`${mh(`${ic('trash')}글 삭제`)}
    <p class="mut">글을 쓸 때 정한 비밀번호를 입력하세요.</p>
    <form class="row" id="tkdf"><input class="inp grow" id="tkdp" type="password" autocomplete="off" placeholder="비밀번호"><button class="btn pri">삭제</button></form>
    <p class="hint">비밀번호를 잊었다면 관리자에게 부탁하세요. <button class="btn ghost xs" data-a="tkAdminDel" data-id="${p.id}">관리자로 삭제</button></p>`);
  const inp = el.querySelector('#tkdp'); inp.focus();
  el.querySelector('#tkdf').onsubmit = async (e) => {
    e.preventDefault();
    if (!inp.value) return;
    if ((await hashPw(p.id, inp.value)) !== p.pw) { inp.value = ''; inp.focus(); return toast('비밀번호가 맞지 않아요'); }
    remove(p.id, 'author');
  };
});
// 글 수정: 글을 쓸 때 정한 비밀번호가 맞으면 제목·내용을 바꾼다(edited 에 고친 시각). 공감·댓글은 그대로
act('tkEdit', (d) => {
  const p = S.store.data.posts?.[d.id] || OLD[d.id]; if (!p || p.deleted) return;
  const el = modal(`${mh(`${ic('edit')}글 수정`)}
    <form class="col" id="tkef"><input class="inp" id="tket" maxlength="${MAX_TITLE}" placeholder="제목 (선택)" value="${esc(p.title || '')}" autocomplete="off">
      <textarea class="inp tk-body" id="tkeb" maxlength="${MAX_BODY}">${esc(p.body)}</textarea>
      <div class="row"><input class="inp grow" id="tkep" type="password" autocomplete="off" placeholder="글을 쓸 때 정한 비밀번호"><button class="btn pri">${ic('save')}저장</button></div></form>`);
  const tt = el.querySelector('#tket'), tb = el.querySelector('#tkeb'), inp = el.querySelector('#tkep'); tb.focus(); tb.setSelectionRange(tb.value.length, tb.value.length);
  let busy = false;
  el.querySelector('#tkef').onsubmit = async (e) => {
    e.preventDefault(); if (busy) return;
    const title = tt.value.trim().slice(0, MAX_TITLE), body = tb.value.trim().slice(0, MAX_BODY);
    if (!body) return toast('내용을 적어 주세요');
    if (title === (p.title || '') && body === p.body) return toast('바뀐 내용이 없어요');
    if (!inp.value) return inp.focus();
    if ((await hashPw(p.id, inp.value)) !== p.pw) { inp.value = ''; inp.focus(); return toast('비밀번호가 맞지 않아요'); }
    busy = true;
    try {
      const edited = S.store.serverNow?.() || Date.now();
      await S.store.patch('posts', p.id, { title, body, edited });
      if (OLD[p.id]) OLD[p.id] = { ...OLD[p.id], title, body, edited };
      closeModal(); toast('글을 고쳤어요'); refresh();
    } catch (err) { busy = false; toast('수정 실패: ' + (err.code || err.message)); }
  };
});
act('tkAdminDel', (d) => needAdmin(() => { if (confirm('관리자 권한으로 이 글을 지울까요?')) remove(d.id, 'admin'); }));

// ---------- 새 글 알림 ----------
// 접속 중인 사람에게 화면 위쪽에 알림 카드를 띄운다(게시판을 보고 있어도 띄운다. 내가 쓴 글, 접속 전의 글은 제외).
let known = null;
export function watchPosts(initial) {
  const list = col('posts').filter((p) => !p.deleted && p.body);
  if (initial || known === null) { known = new Set(list.map((p) => p.id)); return; }
  const fresh = list.filter((p) => !known.has(p.id));
  fresh.forEach((p) => known.add(p.id));
  const now = S.store.serverNow?.() || Date.now();
  fresh.filter((p) => !TK.mine.has(p.id) && now - (+p.at || 0) < 10 * 60e3).slice(-3).forEach(notify);
}
function notify(p) {
  let box = document.getElementById('postfeed');
  if (!box) { box = document.createElement('div'); box.id = 'postfeed'; document.body.appendChild(box); }
  const el = document.createElement('a');
  el.className = 'pf'; el.href = '#/talk';
  const text = (p.title || p.body).replace(/\s+/g, ' ').slice(0, 60);
  el.innerHTML = `<i class="pf-ic">${ic('talk')}</i><span><b>익명 게시판에 새 글이 올라왔어요</b><small>${esc(text)}${(p.title || p.body).length > 60 ? '…' : ''}</small></span><em>보기</em>`;
  const bye = () => { el.classList.add('bye'); setTimeout(() => el.remove(), 400); };
  el.addEventListener('click', bye);
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(bye, 9000);
  try { navigator.vibrate?.(30); } catch {}
}
