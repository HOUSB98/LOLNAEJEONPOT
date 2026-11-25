// 오늘 내전 모집: 시간을 정하고 카톡으로 모집 글을 보내면, 친구들이 사이트에서 '참가'를 눌러 지원한다(라인 지원과는 따로).
// 저장: meta/recruit = { when(내전 시작 시각 ms), by(시작한 닉네임), at, list: { 기기 id: { n: 닉네임, at } } }
//   meta는 모두가 이미 실시간으로 받고 있는 묶음이라 따로 구독이 늘지 않는다(누가 참가할 때마다 접속자마다 읽기 1).
//   시작 시각 + 6시간이 지나면 끝난 모집으로 보고 보여 주지 않는다(문서는 지우지 않고 다음 모집이 덮어쓴다).
// 카톡 카드는 보내는 순간의 인원이 찍힌다(카카오 카드는 보낸 뒤에 바뀌지 않음). '참가하러 가기'를 누르면 사이트에서 실시간 인원을 본다.
import { S, act, esc, ic, toast, modal, closeModal, mh, refresh, moreHooks } from './core.js';
import { cid, nick } from './social.js';
import { kakaoWarm, shareKakao } from './kakao.js';
import { KAKAO_JS_KEY } from './config.js';

const NEED = 10, LIVE_MS = 6 * 3600e3;
const doc = () => S.store?.data?.meta?.recruit || null;
export const recruitOn = (d = doc()) => !!(d && +d.when && Date.now() < +d.when + LIVE_MS);
const people = (d = doc()) => Object.entries(d?.list || {}).map(([id, v]) => ({ id, n: v?.n || '?', at: +v?.at || 0 })).sort((a, b) => a.at - b.at);
const fmtTime = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }); // 오후 9:00
const dayWord = (t) => {
  const d = new Date(t), n = new Date(), k = (x) => x.getFullYear() * 1e4 + x.getMonth() * 100 + x.getDate();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  return diff === 0 ? '오늘' : diff === 1 ? '내일' : k(d) < k(n) ? '지난' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
const dateLabel = (t) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`; };
// 카톡 카드 내용(kakao.js가 부름)
export function recruitCard() {
  const d = doc(), on = recruitOn(d), ps = on ? people(d) : [], n = ps.length;
  const lines = [on ? `${dateLabel(d.when)} ${fmtTime(d.when)} 시작` : dateLabel(Date.now())];
  if (on) lines.push(n >= NEED ? `${n}명 지원 · 인원이 다 모였어요!` : `지금 ${n}명 지원 · ${NEED - n}명 더 필요해요`);
  if (n) lines.push(`지원: ${ps.slice(0, 10).map((p) => p.n).join(', ')}${n > 10 ? ` 외 ${n - 10}명` : ''}`);
  const title = on ? `${dayWord(d.when)} ${fmtTime(d.when)} 내전 하실 분!` : '오늘 내전 하실 분 구해요!';
  return { title, desc: lines.join('\n'), hash: '#/today', text: `${title}\n${lines.join('\n')}\n사이트에서 '참가'를 눌러 주세요`, button: '참가하러 가기' };
}

// ---------- 오늘의 내전 화면 위쪽 모집 칸 ----------
export function recruitPanel() {
  const d = doc();
  if (!recruitOn(d)) {
    return `<div class="rc-bar" data-k="rc"><span class="rc-ic">${ic('users')}</span><span class="grow mut sm">오늘 내전 사람을 구하려면 시간을 정하고 카톡으로 모집 글을 보내 보세요</span><button class="btn xs kk-btn" data-a="rcOpen">${KK_SM}내전 모집</button></div>`;
  }
  const ps = people(d), n = ps.length, me = !!d.list?.[cid];
  const slots = Array.from({ length: NEED }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  return `<section class="panel rc-box" data-k="rc">
    <div class="rc-top"><span class="rc-ic">${ic('users')}</span><div class="rc-h"><b>${dayWord(d.when)} ${fmtTime(d.when)} 내전 모집</b><small class="mut">${esc(d.by || '')}님이 시작 · 라인 지원과 따로 세는 참가 인원</small></div>
      <span class="grow"></span><b class="rc-n mono${n >= NEED ? ' full' : ''}">${n}<small>/${NEED}</small></b></div>
    <div class="rc-slots" aria-label="지원 ${n}명">${slots}</div>
    <div class="rc-ppl">${ps.map((p) => `<span class="rc-p${p.id === cid ? ' me' : ''}">${esc(p.n)}</span>`).join('') || '<span class="mut sm">아직 지원한 사람이 없어요</span>'}</div>
    <div class="row rc-act"><button class="btn ${me ? 'ghost' : 'pri'}" data-a="rcJoin">${me ? '참가 취소' : `${ic('plus')}참가`}</button><span class="grow"></span><button class="btn ghost xs" data-a="rcOpen">${ic('clock')}시간 바꾸기</button>${KAKAO_JS_KEY ? `<button class="btn kk-btn xs" data-a="rcShare">${KK_SM}카톡으로 모집</button>` : ''}</div>
  </section>`;
}
const KK_SM = '<svg class="kk-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.500C6.800 3.500 2.600 6.800 2.600 10.900c0 2.600 1.700 4.900 4.300 6.200l-.900 3.300c-.100.300.300.600.600.400l3.900-2.600c.500.100 1 .100 1.500.100 5.200 0 9.400-3.300 9.400-7.400S17.200 3.500 12 3.500z"/></svg>';

// ---------- 모집 창(시간 정하기 · 지원 현황 · 카톡 보내기) ----------
const RC = { day: 0, time: '21:00' };
const pad = (x) => String(x).padStart(2, '0');
function draw() {
  const d = doc(), on = recruitOn(d), ps = on ? people(d) : [], me = on && !!d.list?.[cid];
  const pick = (t) => `<button class="${RC.time === t ? 'on' : ''}" data-a="rcTime" data-v="${t}">${fmtTime(new Date(`2000-01-01T${t}:00`))}</button>`;
  return `${mh('오늘 내전 모집')}
    <div class="rc-m">
      <p class="mut sm">시간을 정하고 카톡으로 보내면, 친구들이 사이트에서 <b>참가</b>를 눌러 지원해요. 지원 인원은 오늘의 내전 화면 위쪽에 실시간으로 보여요.</p>
      <div class="rc-row"><small>날짜</small><div class="seg">${[[0, '오늘'], [1, '내일']].map(([v, t]) => `<button class="${RC.day === v ? 'on' : ''}" data-a="rcDay" data-v="${v}">${t}</button>`).join('')}</div></div>
      <div class="rc-row"><small>시작 시간</small><div class="seg rc-times">${['20:00', '21:00', '22:00', '23:00'].map(pick).join('')}</div><input class="inp rc-tin mono" type="time" value="${RC.time}" data-c="rcTimeIn" aria-label="직접 입력"></div>
      ${on ? `<div class="rc-now"><b>${dayWord(d.when)} ${fmtTime(d.when)}</b> 모집 중 · 지원 ${ps.length}명${ps.length ? ` (${ps.map((p) => esc(p.n)).join(', ')})` : ''}</div>` : ''}
      <label class="mini rc-me"><input type="checkbox" data-c="rcMe" ${!on || me ? 'checked' : ''}> 나(${esc(nick() || '나')})도 참가</label>
      <div class="row rc-go"><button class="btn" data-a="close">닫기</button><span class="grow"></span>${KAKAO_JS_KEY ? `<button class="btn kk-btn" data-a="rcShare" data-save="1">${KK_SM}저장하고 카톡으로 보내기</button>` : `<button class="btn pri" data-a="rcSave">저장</button>`}</div>
    </div>`;
}
const view = () => document.querySelector('#modal.on .rc-m');
const redraw = () => { const m = document.querySelector('#modal.on'); if (m && view()) m.querySelector('.sheet').innerHTML = draw(); };
act('rcOpen', () => {
  const d = doc();
  if (recruitOn(d)) { const t = new Date(+d.when); RC.time = `${pad(t.getHours())}:${pad(t.getMinutes())}`; RC.day = dayWord(+d.when) === '내일' ? 1 : 0; }
  else { RC.day = 0; RC.time = new Date().getHours() >= 21 ? `${pad(Math.min(23, new Date().getHours() + 1))}:00` : '21:00'; }
  RC.me = true;
  modal(draw(), 'rc-sheet'); kakaoWarm();
});
act('rcDay', (d) => { RC.day = +d.v; redraw(); });
act('rcTime', (d) => { RC.time = d.v; redraw(); });
act('rcTimeIn', (d, el) => { if (/^\d\d:\d\d$/.test(el.value)) { RC.time = el.value; document.querySelectorAll('#modal.on .rc-times button').forEach((b) => b.classList.toggle('on', b.dataset.v === RC.time)); } });
act('rcMe', (d, el) => { RC.me = el.checked; });
// 저장: 진행 중인 모집이면 시간만 바꾸고(지원자는 그대로), 끝났거나 없으면 새로 시작(시작한 사람 = 나)
async function save() {
  const [h, m] = RC.time.split(':').map(Number), base = new Date(); base.setHours(h, m, 0, 0); base.setDate(base.getDate() + RC.day);
  const when = base.getTime();
  if (when + LIVE_MS < Date.now()) { toast('이미 지난 시간이에요'); return false; }
  const me = view()?.querySelector('[data-c=rcMe]')?.checked ?? RC.me, n = nick() || '익명', t = Date.now();
  await S.store.tx('meta', 'recruit', (r) => {
    const live = recruitOn(r), list = live ? { ...(r.list || {}) } : {};
    if (me) list[cid] = list[cid] || { n, at: t }; else delete list[cid];
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
// 참가 / 참가 취소(누구나, 내 기기 기준). 끝난 모집에는 참가하지 않는다
act('rcJoin', async () => {
  const n = nick() || '익명', t = Date.now(); let joined = false;
  try {
    const ok = await S.store.tx('meta', 'recruit', (r) => {
      if (!recruitOn(r)) return null;
      const list = { ...(r.list || {}) };
      if (list[cid]) delete list[cid]; else { list[cid] = { n, at: t }; joined = true; }
      return { ...r, list };
    });
    if (!ok) return toast('모집이 끝났어요');
    toast(joined ? '참가했어요!' : '참가를 취소했어요');
  } catch (e) { toast('저장하지 못했어요: ' + (e.message || e)); }
});
// 모집 문서가 바뀌면: 오늘의 내전 화면·열려 있는 모집 창을 다시 그림(app.js가 부름)
export function onRecruit() { if (S.page === 'today') refresh(); redraw(); }

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
setInterval(() => { if (!S.store) return; const on = recruitOn(); if (wasOn !== null && on !== wasOn && S.page === 'today') refresh(); wasOn = on; }, 60e3);
