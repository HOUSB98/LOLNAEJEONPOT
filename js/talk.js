// 익명 게시판: 글쓴이는 누구든 '익명'으로만 보인다(이름·닉네임·기기 정보를 아예 저장하지 않는다).
// 글마다 비밀번호를 정하고, 그 비밀번호로 본인이 지운다. 비밀번호는 원문이 아니라 해시만 저장한다.
// 지운 글은 문서를 없애지 않고 deleted:true 로 표시한다(사이트 공통 규칙).
import { S, page, act, esc, uid, col, refresh, toast, modal, closeModal, mh, ic, sha, needAdmin } from './core.js';
import { sysChat } from './social.js';

const MAX_TITLE = 60, MAX_BODY = 2000, PAGE = 30, COOLDOWN = 20e3;
const TK = { title: '', body: '', pw: '', open: false, shown: PAGE, busy: false, seen: null };
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
const posts = () => col('posts').filter((p) => !p.deleted && p.body).sort((a, b) => b.at - a.at);

page('talk', {
  render() {
    const list = posts(), shown = list.slice(0, TK.shown);
    const fresh = (p) => TK.seen && !TK.seen.has(p.id); // 처음 연 화면 이후에 새로 올라온 글만 떠오르는 효과
    const form = TK.open ? `<form class="panel tk-form" id="tkf" onsubmit="return false">
        <div class="tk-who">${ic('user')}<b>익명</b><small>글쓴이는 항상 '익명'으로 표시됩니다</small></div>
        <input id="tkt" class="inp" maxlength="${MAX_TITLE}" placeholder="제목 (선택)" value="${esc(TK.title)}" data-i="tkT" autocomplete="off">
        <textarea id="tkb" class="inp tk-body" maxlength="${MAX_BODY}" placeholder="하고 싶은 말을 자유롭게 적어 주세요. 다른 사람을 불쾌하게 하는 글은 관리자가 지울 수 있어요." data-i="tkB">${esc(TK.body)}</textarea>
        <div class="tk-row"><label class="tk-pw">${ic('lock')}<input id="tkp" class="inp" type="password" maxlength="20" placeholder="삭제용 비밀번호 (4자 이상)" value="${esc(TK.pw)}" data-i="tkP" autocomplete="new-password"></label>
          <small class="mut tk-len">${TK.body.length}/${MAX_BODY}</small><span class="grow"></span>
          <button type="button" class="btn ghost" data-a="tkCancel">취소</button><button type="button" class="btn pri" data-a="tkPost" ${TK.busy ? 'disabled' : ''}>${ic('send')}글 올리기</button></div>
        <p class="hint">비밀번호는 글을 지울 때 필요해요. 잊어버리면 지울 수 없으니 기억해 두세요.</p>
      </form>`
      : `<button class="panel tk-open" data-a="tkOpen">${ic('user')}<span>익명으로 글 쓰기…</span>${ic('edit')}</button>`;
    return `<div class="h2row"><h1>${ic('talk')}익명 게시판</h1><span class="tag">${list.length}개</span></div>
      <p class="hint">누가 썼는지 아무도 모릅니다. 글쓴이 정보는 저장되지 않고 모두 <b>익명</b>으로 보입니다.</p>
      ${form}
      <div class="tk-list">${shown.map((p) => `<article class="panel tk-post ${fresh(p) ? 'new' : ''}">
          <header><i class="tk-av">${ic('user')}</i><b>익명</b><small class="mut" title="${new Date(p.at).toLocaleString('ko')}">${ago(p.at)}</small><span class="grow"></span>
            <button class="btn ghost xs" data-a="tkDel" data-id="${p.id}" title="글 삭제">${ic('trash')}</button></header>
          ${p.title ? `<h3>${esc(p.title)}</h3>` : ''}<p class="tk-text">${esc(p.body)}</p>
        </article>`).join('') || '<div class="panel empty">아직 글이 없어요. 첫 글을 남겨 보세요!</div>'}</div>
      ${list.length > TK.shown ? `<button class="btn block ghost" data-a="tkMore">이전 글 더 보기 (${list.length - TK.shown}개)</button>` : ''}`;
  },
  after() { TK.seen = new Set(posts().map((p) => p.id)); },
});
act('tkOpen', () => { TK.open = true; refresh(); setTimeout(() => document.getElementById('tkb')?.focus(), 50); });
act('tkCancel', () => { TK.open = false; refresh(); });
act('tkT', (d, el) => { TK.title = el.value; });
act('tkB', (d, el) => { TK.body = el.value; const n = document.querySelector('.tk-len'); if (n) n.textContent = `${el.value.length}/${MAX_BODY}`; });
act('tkP', (d, el) => { TK.pw = el.value; });
act('tkMore', () => { TK.shown += PAGE; refresh(); });
act('tkPost', async () => {
  const title = TK.title.trim().slice(0, MAX_TITLE), body = TK.body.trim().slice(0, MAX_BODY), pw = TK.pw;
  if (!body) return toast('내용을 적어 주세요');
  if (pw.length < 4) return toast('삭제용 비밀번호를 4자 이상 정해 주세요');
  const wait = +localStorage.getItem(lastKey()) + COOLDOWN - Date.now();
  if (wait > 0) return toast(`${Math.ceil(wait / 1000)}초 뒤에 다시 올릴 수 있어요`);
  TK.busy = true; refresh();
  try {
    const id = Date.now().toString(36) + uid();
    await S.store.put('posts', id, { at: S.store.serverNow?.() || Date.now(), title, body, pw: await hashPw(id, pw), deleted: false });
    localStorage.setItem(lastKey(), String(Date.now()));
    Object.assign(TK, { title: '', body: '', pw: '', open: false });
    toast('익명으로 글을 올렸어요');
    sysChat('익명 게시판에 새 글이 올라왔어요');
  } catch (e) { toast('올리기 실패: ' + (e.code || e.message)); }
  TK.busy = false; refresh();
});
async function remove(id, by) {
  try { await S.store.patch('posts', id, { deleted: true, deletedBy: by, deletedAt: Date.now() }); closeModal(); toast('글을 지웠어요'); }
  catch (e) { toast('삭제 실패: ' + (e.code || e.message)); }
}
act('tkDel', (d) => {
  const p = S.store.data.posts?.[d.id]; if (!p) return;
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
act('tkAdminDel', (d) => needAdmin(() => { if (confirm('관리자 권한으로 이 글을 지울까요?')) remove(d.id, 'admin'); }));
