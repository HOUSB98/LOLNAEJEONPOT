// 오늘 내전 모집: 시간을 정하고 카톡으로 모집 글을 보내면, 친구들이 사이트에서 자기 이름을 눌러 참가한다(라인 지원과는 따로 세지만, 라인 지원을 열 때 참가자를 미리 골라 둔다).
// 저장: meta/recruit = { when(내전 시작 시각 ms), by(시작한 닉네임), at, list: { 선수 id: { n: 선수 이름, pid, by: 누른 기기, at } } }
//   참가는 선수 이름을 눌러서 한다(선수 기준이라 PC·휴대폰에서 각각 눌러도 한 명으로 셈, 친구 대신 눌러 줄 수도 있음).
//   내가 마지막으로 참가시킨 이름은 이 기기에 기억해(naejeon:rcme) 모집 칸에서 노란 테두리로 보여 준다. 예전 방식(기기 id) 항목도 그대로 보인다.
//   meta는 모두가 이미 실시간으로 받고 있는 묶음이라 따로 구독이 늘지 않는다(누가 참가할 때마다 접속자마다 읽기 1).
//   시작 시각 + 6시간이 지나면 끝난 모집으로 보고 보여 주지 않는다(문서는 지우지 않고 다음 모집이 덮어쓴다).
// 카톡 카드에는 시간만 넣는다(카카오 카드는 보낸 뒤에 바뀌지 않음). '참가하러 가기'를 누르면 사이트에서 실시간 인원을 본다.
import { S, act, esc, ic, toast, modal, closeModal, mh, refresh, moreHooks } from './core.js';
import { cid, nick } from './social.js';
import { kakaoWarm, shareKakao } from './kakao.js';
import { KAKAO_JS_KEY } from './config.js';

const NEED = 10, LIVE_MS = 6 * 3600e3;
const doc = () => S.store?.data?.meta?.recruit || null;
export const recruitOn = (d = doc()) => !!(d && +d.when && Date.now() < +d.when + LIVE_MS);
const people = (d = doc()) => Object.entries(d?.list || {}).map(([id, v]) => ({ id, pid: v?.pid || '', n: (v?.pid && S.st?.P?.[v.pid]?.name) || v?.n || '?', at: +v?.at || 0 })).sort((a, b) => a.at - b.at);
// 라인 지원 창이 참가자를 미리 골라 둘 때 쓰는 선수 id 목록(진행 중인 모집, 지금 선수 목록에 있는 사람만)
export const recruitIds = () => (recruitOn() ? people().map((p) => p.pid).filter((id) => id && S.st?.P?.[id]) : []);
const ME_KEY = 'naejeon:rcme';
const squash = (x) => String(x || '').replace(/\s/g, '').toLowerCase();
const myPid = () => { try { const v = localStorage.getItem(ME_KEY); if (v && S.st?.P?.[v]) return v; } catch {} const k = squash(nick()); return (k && S.st?.list?.find((s) => squash(s.name) === k)?.id) || ''; };
const isMe = (p) => (p.pid ? p.pid === myPid() : p.id === cid);
const fmtTime = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }); // 오후 9:00
const dayWord = (t) => {
  const d = new Date(t), n = new Date(), k = (x) => x.getFullYear() * 1e4 + x.getMonth() * 100 + x.getDate();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  return diff === 0 ? '오늘' : diff === 1 ? '내일' : k(d) < k(n) ? '지난' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const dateLabel = (t) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`; };
// 카톡 카드 내용(kakao.js가 부름): 시간만 알리고 지원 인원·지원자 이름은 넣지 않는다
// (카톡 카드는 보낸 뒤에 바뀌지 않아 인원이 금방 옛 숫자가 되므로. 실시간 인원은 사이트 오늘의 내전 화면에서)
export function recruitCard() {
  const d = doc(), on = recruitOn(d);
  const lines = [on ? `${dateLabel(d.when)} ${fmtTime(d.when)} 시작` : dateLabel(Date.now()), "아래 버튼을 눌러 사이트에서 '참가'해 주세요"];
  const title = on ? `${dayWord(d.when)} ${fmtTime(d.when)} 내전 하실 분!` : '오늘 내전 하실 분 구해요!';
  return { title, desc: lines.join('\n'), hash: '#/today', text: `${title}\n${lines.join('\n')}`, button: '참가하러 가기' };
}

// ---------- 오늘의 내전 화면 위쪽 모집 칸 ----------
export function recruitPanel() {
  const d = doc();
  if (!recruitOn(d)) {
    return `<div class="rc-bar" data-k="rc"><span class="rc-ic">${ic('users')}</span><span class="grow mut sm">오늘 내전 사람을 구하려면 시간을 정하고 카톡으로 모집 글을 보내 보세요</span><button class="btn xs kk-btn" data-a="rcOpen">${KK_SM}내전 모집</button></div>`;
  }
  const ps = people(d), n = ps.length, mine = myPid(), meIn = !!(mine && d.list?.[mine]);
  const slots = Array.from({ length: NEED }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  return `<section class="panel rc-box" data-k="rc">
    <div class="rc-top"><span class="rc-ic">${ic('users')}</span><div class="rc-h"><b>${dayWord(d.when)} ${fmtTime(d.when)} 내전 모집</b><small class="mut">${esc(d.by || '')}님이 시작 · 라인 지원과 따로 세는 참가 인원</small></div>
      <span class="grow"></span><b class="rc-n mono${n >= NEED ? ' full' : ''}">${n}<small>/${NEED}</small></b></div>
    <div class="rc-slots" aria-label="지원 ${n}명">${slots}</div>
    <div class="rc-ppl">${ps.map((p) => `<span class="rc-p${isMe(p) ? ' me' : ''}">${esc(p.n)}</span>`).join('') || '<span class="mut sm">아직 지원한 사람이 없어요</span>'}</div>
    <div class="rc-act"><button class="btn ${meIn ? 'ghost' : 'pri'} rc-join" data-a="rcPick">${ic('users')}${meIn ? '이름 골라 참가 · 취소' : '이름 골라 참가'}</button>
      <div class="rc-sub"><button class="btn ghost" data-a="rcOpen">${ic('clock')}시간 바꾸기</button>${KAKAO_JS_KEY ? `<button class="btn kk-btn" data-a="rcShare">${KK_SM}카톡으로 모집</button>` : ''}</div></div>
  </section>`;
}
// 홈 맨 위 띠: 모집 중일 때만 '오늘 오후 9:00 내전 모집 중 · 4/10 · 참가하기'(누르면 오늘의 내전 화면)
export function recruitHomeBar() {
  const d = doc(); if (!recruitOn(d)) return '';
  const n = people(d).length;
  return `<a class="rc-home" href="#/today"><span class="rc-ic">${ic('users')}</span><span class="rc-ht"><b>${dayWord(d.when)} ${fmtTime(d.when)} 내전 모집 중</b><small>라인 지원과 따로 세는 참가 인원</small></span><span class="grow"></span><b class="rc-n mono${n >= NEED ? ' full' : ''}">${n}<small>/${NEED}</small></b><span class="btn pri xs">${n >= NEED ? '모집 보기' : '참가하기'}</span></a>`;
}
const KK_SM = '<svg class="kk-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.500C6.800 3.500 2.600 6.800 2.600 10.900c0 2.600 1.700 4.900 4.300 6.200l-.900 3.300c-.100.300.300.600.600.400l3.900-2.600c.500.100 1 .100 1.500.100 5.200 0 9.400-3.300 9.400-7.400S17.200 3.500 12 3.500z"/></svg>';

// ---------- 모집 창(시간 정하기 · 지원 현황 · 카톡 보내기) ----------
const RC = { day: 0, time: '21:00' };
const pad = (x) => String(x).padStart(2, '0');
function draw() {
  const d = doc(), on = recruitOn(d), ps = on ? people(d) : [];
  const list = [...(S.st?.list || [])].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const pick = (t) => `<button class="${RC.time === t ? 'on' : ''}" data-a="rcTime" data-v="${t}">${fmtTime(new Date(`2000-01-01T${t}:00`))}</button>`;
  return `${mh('오늘 내전 모집')}
    <div class="rc-m">
      <p class="mut sm">시간을 정하고 카톡으로 보내면, 친구들이 사이트에서 <b>참가</b>를 눌러 지원해요. 지원 인원은 오늘의 내전 화면 위쪽에 실시간으로 보여요.</p>
      <div class="rc-row"><small>날짜</small><div class="seg">${[[0, '오늘'], [1, '내일']].map(([v, t]) => `<button class="${RC.day === v ? 'on' : ''}" data-a="rcDay" data-v="${v}">${t}</button>`).join('')}</div></div>
      <div class="rc-row"><small>시작 시간</small><div class="seg rc-times">${['20:00', '21:00', '22:00', '23:00'].map(pick).join('')}</div><input class="inp rc-tin mono" type="time" value="${RC.time}" data-c="rcTimeIn" aria-label="직접 입력"></div>
      ${on ? `<div class="rc-now"><b>${dayWord(d.when)} ${fmtTime(d.when)}</b> 모집 중 · 지원 ${ps.length}명${ps.length ? ` (${ps.map((p) => esc(p.n)).join(', ')})` : ''}</div>` : ''}
      <div class="rc-row"><small>나도 참가</small><select class="inp rc-mesel" data-c="rcMe"><option value="">참가 안 함</option>${list.map((s) => `<option value="${s.id}" ${RC.me === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="row rc-go"><button class="btn" data-a="close">닫기</button><span class="grow"></span>${KAKAO_JS_KEY ? `<button class="btn kk-btn" data-a="rcShare" data-save="1">${KK_SM}저장하고 카톡으로 보내기</button>` : `<button class="btn pri" data-a="rcSave">저장</button>`}</div>
    </div>`;
}
const view = () => document.querySelector('#modal.on .rc-m');
const redraw = () => { const m = document.querySelector('#modal.on'); if (m && view()) m.querySelector('.sheet').innerHTML = draw(); };
act('rcOpen', () => {
  const d = doc();
  if (recruitOn(d)) { const t = new Date(+d.when); RC.time = `${pad(t.getHours())}:${pad(t.getMinutes())}`; RC.day = dayWord(+d.when) === '내일' ? 1 : 0; }
  else { RC.day = 0; RC.time = new Date().getHours() >= 21 ? `${pad(Math.min(23, new Date().getHours() + 1))}:00` : '21:00'; }
  RC.me = recruitOn(d) ? (d.list?.[myPid()] ? myPid() : '') : myPid(); // 새로 시작할 땐 내 이름(기억해 둔 이름 또는 닉네임과 같은 선수)으로
  modal(draw(), 'rc-sheet'); kakaoWarm();
});
act('rcDay', (d) => { RC.day = +d.v; redraw(); });
act('rcTime', (d) => { RC.time = d.v; redraw(); });
act('rcTimeIn', (d, el) => { if (/^\d\d:\d\d$/.test(el.value)) { RC.time = el.value; document.querySelectorAll('#modal.on .rc-times button').forEach((b) => b.classList.toggle('on', b.dataset.v === RC.time)); } });
act('rcMe', (d, el) => { RC.me = el.value; });
// 저장: 진행 중인 모집이면 시간만 바꾸고(지원자는 그대로), 끝났거나 없으면 새로 시작(시작한 사람 = 나)
async function save() {
  const [h, m] = RC.time.split(':').map(Number), base = new Date(); base.setHours(h, m, 0, 0); base.setDate(base.getDate() + RC.day);
  const when = base.getTime();
  if (when + LIVE_MS < Date.now()) { toast('이미 지난 시간이에요'); return false; }
  const me = view()?.querySelector('[data-c=rcMe]')?.value ?? RC.me, n = nick() || '익명', t = Date.now();
  if (me) try { localStorage.setItem(ME_KEY, me); } catch {}
  await S.store.tx('meta', 'recruit', (r) => {
    const live = recruitOn(r), list = live ? { ...(r.list || {}) } : {};
    if (me && !list[me]) list[me] = { n: S.st.P[me]?.name || n, pid: me, by: cid, at: t };
    return { when, by: live ? r.by || n : n, at: live ? r.at || t : t, list };
  });
  return true;
}
act('rcSave', async () => { if (await save().catch((e) => (toast('저장하지 못했어요: ' + (e.message || e)), false))) { closeModal(); toast('모집 시간을 저장했어요'); } });
act('rcShare', async (d) => {
  if (d.save) { if (!(await save().catch((e) => (toast('저장하지 못했어요: ' + (e.message || e)), false)))) return; closeModal(); }
  await new Promise((r) => setTimeout(r, 50)); // 방금 저장한 인원이 카드에 들어가게
  shareKakao('recruit');
});
// 참가: 이름 고르기 창. 선수 이름을 누르면 바로 참가 ↔ 취소(누구나, 친구 대신도 가능). 참가한 이름은 노란색
function pickHTML() {
  const d = doc(), on = recruitOn(d), ps = on ? people(d) : [], inSet = new Set(ps.map((p) => p.pid).filter(Boolean)), mine = myPid();
  const list = [...(S.st?.list || [])].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const extra = ps.filter((p) => !p.pid); // 예전 방식(기기 기준) 참가자
  return `${mh(`${ic('users')}참가할 이름 고르기`)}
    <div class="rc-pick">
      ${on ? `<p class="mut sm"><b>${dayWord(d.when)} ${fmtTime(d.when)}</b> 내전 · 이름을 누르면 바로 <b class="good">참가</b>, 다시 누르면 취소예요. 친구 대신 눌러 줘도 돼요.</p>` : '<p class="mut">모집이 끝났어요. 왼쪽 위(휴대폰은 메뉴) \'내전 모집\'으로 새로 시작해 주세요.</p>'}
      <div class="ph"><b>참가</b><span class="tag ${ps.length >= NEED ? 'ok' : ''}">${ps.length}/${NEED}명</span></div>
      <div class="chipsel rc-chips">${list.map((s) => `<button class="${inSet.has(s.id) ? 'on' : ''}${s.id === mine ? ' mine' : ''}" data-a="rcToggle" data-id="${s.id}" ${on ? '' : 'disabled'}>${esc(s.name)}</button>`).join('')}</div>
      ${extra.length ? `<p class="mut sm">이름 없이 참가: ${extra.map((p) => esc(p.n)).join(', ')}${extra.some((p) => p.id === cid) ? ' <button class="lnk" data-a="rcOldOff">내 참가 취소</button>' : ''}</p>` : ''}
      <button class="btn block" data-a="close">닫기</button>
    </div>`;
}
const pickView = () => document.querySelector('#modal.on .rc-pick');
const redrawPick = () => { const v = pickView(); if (v) { const box = v.closest('.sheet'), y = box.querySelector('.rc-chips')?.scrollTop || 0; box.innerHTML = pickHTML(); box.querySelector('.rc-chips').scrollTop = y; } };
act('rcPick', () => { modal(pickHTML(), 'tall rc-pick-sheet'); });
act('rcToggle', async (x) => {
  const t = Date.now(); let joined = false;
  try {
    const ok = await S.store.tx('meta', 'recruit', (r) => {
      if (!recruitOn(r)) return null;
      const list = { ...(r.list || {}) };
      if (list[x.id]) delete list[x.id]; else { list[x.id] = { n: S.st.P[x.id]?.name || '?', pid: x.id, by: cid, at: t }; joined = true; }
      return { ...r, list };
    });
    if (!ok) return toast('모집이 끝났어요');
    if (joined) try { localStorage.setItem(ME_KEY, x.id); } catch {} // 처음 고른 이름을 '나'로 기억(이후 다른 이름을 눌러도 바뀜)
    toast(`${S.st.P[x.id]?.name || ''} ${joined ? '참가!' : '참가 취소'}`);
  } catch (e) { toast('저장하지 못했어요: ' + (e.message || e)); }
});
act('rcOldOff', async () => { await S.store.tx('meta', 'recruit', (r) => { if (!r?.list?.[cid]) return null; const list = { ...r.list }; delete list[cid]; return { ...r, list }; }).catch(() => {}); });
// 모집 문서가 바뀌면: 오늘의 내전 화면·열려 있는 모집 창을 다시 그림(app.js가 부름)
export function onRecruit() { if (S.page === 'today' || S.page === 'home') refresh(); redraw(); redrawPick(); }

// 내전 모집 버튼: PC는 왼쪽 위 '내전 시작' 옆(반씩), 휴대폰은 메뉴(더보기) 창 아래쪽. app.js가 모든 모듈을 읽은 뒤 부른다
let mounted = false;
export function mountRecruit() {
  if (mounted) return; mounted = true;
  const cta = document.querySelector('#side .side-cta>a.btn.gold, #side>a.btn.gold');
  if (cta && !document.querySelector('#side [data-a=rcOpen]')) cta.insertAdjacentHTML('afterend', `<button class="btn kk-btn kk-side" data-a="rcOpen" title="시간을 정하고 오늘 내전할 사람을 카카오톡으로 구하기">${KK_SM}내전 모집</button>`);
  moreHooks.push(() => `<button class="btn kk-btn" data-a="rcOpen">${KK_SM}내전 모집 (카톡)</button>`);
}
// 화면을 켜 둔 채로 모집이 끝나면(시작 + 6시간) 1분 안에 오늘의 내전 칸을 안내 줄로 바꾼다
let wasOn = null;
setInterval(() => { if (!S.store) return; const on = recruitOn(); if (wasOn !== null && on !== wasOn && (S.page === 'today' || S.page === 'home')) refresh(); wasOn = on; }, 60e3);
