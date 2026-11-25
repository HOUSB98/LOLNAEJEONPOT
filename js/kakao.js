// 카카오톡 공유: 사람이 '카톡 공유' 버튼을 누를 때만 카드(제목·설명·대표 그림·사이트 버튼)를 단톡방에 보낸다. 저절로 보내는 기능은 없다.
// 카카오 JavaScript SDK는 버튼이 있는 화면을 열 때 처음 한 번만 받는다(평소 접속에는 받지 않음). 무료 제공량 안에서 무료이고,
// 카카오 개발자 콘솔의 '유료 API 사용'을 켜지 않으면 요금이 나갈 일이 없다(넘치면 그날 공유만 잠시 안 됨).
// SDK를 못 받거나 카카오가 막히면(등록 안 된 주소·광고 차단 등) 휴대폰 기본 공유 → 글 복사 순서로 대신한다.
import { S, act, toast, esc, pname, fmtDT, settings, moreHooks } from './core.js';
import { KAKAO_JS_KEY } from './config.js';

const SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'; // 버전을 고정한 카카오 공식 주소
let loading = null;
function load() {
  if (window.Kakao?.Share) return Promise.resolve(window.Kakao);
  return (loading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SDK; s.crossOrigin = 'anonymous'; s.async = true;
    const t = setTimeout(() => { loading = null; rej(new Error('timeout')); }, 8000);
    s.onload = () => { clearTimeout(t); window.Kakao?.Share ? res(window.Kakao) : (loading = null, rej(new Error('no sdk'))); };
    s.onerror = () => { clearTimeout(t); loading = null; s.remove(); rej(new Error('load')); };
    document.head.appendChild(s);
  }));
}
// 버튼이 있는 화면을 그릴 때 미리 받아 둔다(누른 순간 받으면 PC 브라우저가 공유 창을 팝업으로 막을 수 있어서)
export function kakaoWarm() { if (KAKAO_JS_KEY && !window.Kakao?.Share) load().catch(() => {}); }

const SITE = () => location.origin + location.pathname; // 예: https://housb98.github.io/LOLNAEJEONPOT/
const linkTo = (hash) => SITE() + location.search + hash; // 초대 링크(?k=)를 그대로 붙여 친구가 눌러서 바로 열 수 있게
const OG = () => SITE().replace(/[^/]*$/, '') + 'og.png';
const KK = '<svg class="kk-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.500C6.800 3.500 2.600 6.800 2.600 10.900c0 2.600 1.700 4.900 4.300 6.200l-.900 3.300c-.100.300.300.600.600.400l3.900-2.600c.500.100 1 .100 1.500.100 5.200 0 9.400-3.300 9.400-7.400S17.200 3.500 12 3.500z"/></svg>';
// 공유 버튼(t: match·auction·recruit, id: 경기·경매 id). warm: 그릴 때 SDK를 미리 받기(모든 화면에 있는 버튼은 false → 마우스를 올리거나 손가락이 닿을 때 받음)
export const kakaoBtn = (t, id = '', label = '카톡 공유', warm = true) => (KAKAO_JS_KEY ? (warm && setTimeout(kakaoWarm, 0), `<button class="btn kk-btn" data-a="kkShare" data-t="${t}" data-id="${esc(id)}" title="카카오톡 단톡방에 카드로 공유">${KK}${label}</button>`) : '');

// 공유할 내용 만들기: { title, desc, hash, text(대신 복사할 글) }
const names = (ids) => (ids || []).filter(Boolean).map((id) => pname(id)).join(' · ');
const BUILD = {
  match(id) {
    const m = S.store.data.matches?.[id], mi = S.st.MI?.[id]; if (!m) return null;
    const win = m.winner === 'blue' ? '블루' : '레드';
    const title = `경기 #${mi?.no ?? ''} · ${win} 승리${mi?.upset ? ' (업셋!)' : ''}`;
    const desc = `${fmtDT(m.at)}\n블루: ${names(m.blue)}\n레드: ${names(m.red)}`;
    return { title, desc, hash: '#/matches', text: `${title}\n${desc}` };
  },
  // 오늘 내전 사람 구하기: 날짜·리그 이름, 라인 지원이 열려 있으면 참가 인원, 지금 사이트 접속자 수
  async recruit() {
    const d = new Date(), day = `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
    const { boardLive } = await import('./board.js');
    const b = S.store.data.meta?.board, live = boardLive() && b;
    const on = Object.values(S.store.data.presence || {}).filter((p) => p.nick && Date.now() - p.at < 12 * 60e3).length;
    const lines = [`${day} · ${settings().leagueName || '친구 내전 리그'}`];
    if (live && b.status === 'open') lines.push(`라인 지원 진행 중 · ${(b.ids || []).length}/10명`);
    else if (live) lines.push('팀이 정해져 곧 시작해요');
    else lines.push('10명 모이면 바로 시작! 아래 버튼으로 참가해 주세요');
    if (on) lines.push(`지금 사이트 접속 ${on}명`);
    const title = '오늘 내전 하실 분 구해요!';
    return { title, desc: lines.join('\n'), hash: '#/today', text: `${title}\n${lines.join('\n')}`, button: '참가하러 가기' };
  },
  async auction(id) {
    const r = S.store.data.auctions?.[id]; if (!r) return null;
    const { resultText } = await import('./auction.js');
    const title = `${/경매$/.test(r.name) ? r.name : r.name + ' 경매'} 결과`;
    const desc = r.teams.map((t) => `${t.name}: ${names([t.captain, ...t.members.map((m) => m.pid)])}`).join('\n');
    return { title, desc, hash: `#/auction/${r.id}`, text: resultText(r) }; // 링크는 관전용(팀장 링크·토큰은 넣지 않음)
  },
};

async function fallback(c, url) {
  const full = `${c.text}\n${url}`;
  if (navigator.share) { try { await navigator.share({ title: c.title, text: c.text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(full); toast('카카오톡을 열 수 없어 내용을 복사했어요. 단톡방에 붙여 넣어 주세요'); } catch { prompt('아래 내용을 복사해 붙여 넣어 주세요', full); }
}
act('kkShare', async (d) => {
  const c = await BUILD[d.t]?.(d.id); if (!c) return toast('공유할 내용이 없어요');
  const url = linkTo(c.hash);
  try {
    const K = await load();
    if (!K.isInitialized()) K.init(KAKAO_JS_KEY);
    K.Share.sendDefault({
      objectType: 'feed',
      content: { title: c.title, description: c.desc, imageUrl: OG(), imageWidth: 1200, imageHeight: 630, link: { mobileWebUrl: url, webUrl: url } },
      buttons: [{ title: c.button || '사이트에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  } catch (e) { console.warn('[kakao]', e?.message || e); fallback(c, url); }
});

// 모든 화면에 있는 '내전 모집' 버튼은 그릴 때 SDK를 받지 않고, 마우스를 올리거나 손가락이 닿거나 키보드로 고를 때 받는다
for (const ev of ['pointerover', 'touchstart', 'focusin']) document.addEventListener(ev, (e) => { if (e.target.closest?.('[data-a=kkShare]')) kakaoWarm(); }, { passive: true });
// 내전 모집 버튼: PC는 왼쪽 위 '내전 시작' 옆(반씩 나눔), 휴대폰은 메뉴(더보기) 창 아래쪽. app.js가 모든 모듈을 읽은 뒤 부른다
let mounted = false;
export function mountRecruit() {
  if (!KAKAO_JS_KEY || mounted) return; mounted = true;
  const cta = document.querySelector('#side .side-cta>a.btn.gold, #side>a.btn.gold');
  if (cta && !document.querySelector('#side [data-t=recruit]')) cta.insertAdjacentHTML('afterend', kakaoBtn('recruit', '', '내전 모집', false).replace('class="btn kk-btn"', 'class="btn kk-btn kk-side"').replace('title="카카오톡 단톡방에 카드로 공유"', 'title="오늘 내전할 사람을 구하는 글을 카카오톡으로 보내기"'));
  moreHooks.push(() => kakaoBtn('recruit', '', '카톡으로 내전 모집', false));
}
