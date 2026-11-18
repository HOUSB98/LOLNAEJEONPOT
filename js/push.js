// 웹앱(홈 화면에 추가) + 휴대폰 알림.
// - 서비스 워커(sw.js)를 등록하고, 알림을 켜면 이 기기의 구독 정보를 push/{기기id} 에 저장한다(구독하지 않는 컬렉션, 연동 서버만 읽음).
// - 연동 서버(Worker)가 라인 지원·경기 결과·가챠 전설 이상·익명 게시판 새 글을 디스코드와 함께 이 기기들로 보낸다.
// - 알림 키(VAPID): 공개키는 meta/settings.push.pub, 비밀키는 Worker 비밀값 VAPID_KEY 에만 둔다(관리 화면에서 만들기).
import { S, act, esc, toast, modal, closeModal, mh, ic, settings, needAdmin, moreHooks } from './core.js';
import { cid, nick } from './social.js';
import { callWorker, hookOn } from './hook.js';

export const PUSH_TYPES = [['board', '라인 지원이 열렸을 때'], ['match', '경기 결과가 저장됐을 때'], ['gacha', '누군가 전설 이상 스킨을 뽑았을 때'], ['post', '익명 게시판에 새 글이 올라왔을 때']];
const PREF_KEY = 'naejeon:pushprefs';
const prefs = () => { try { const v = JSON.parse(localStorage.getItem(PREF_KEY)); return Array.isArray(v) ? v : PUSH_TYPES.map(([k]) => k); } catch { return PUSH_TYPES.map(([k]) => k); } };
const P = { reg: null, sub: null, busy: false, install: null };
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64u = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const device = () => (isIOS ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '기타');

// 사이트를 열면 서비스 워커를 등록한다(실제 리그에서만). 알림을 누르면 열린 창을 그 화면으로 옮긴다
export async function initPush() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); P.install = e; });
  moreHooks.push(() => `<button class="btn ghost xs push-btn" data-a="pushOpen">${ic('bell')}알림 · 앱</button>`);
  document.querySelector('.sidefoot')?.insertAdjacentHTML('beforeend', `<button class="btn ghost xs push-btn" data-a="pushOpen" title="휴대폰 알림 켜기 · 홈 화면에 앱으로 추가">${ic('bell')}알림</button>`);
  if (!('serviceWorker' in navigator) || S.store?.mode !== 'firebase') return;
  try {
    P.reg = await navigator.serviceWorker.register(`sw.js?k=${encodeURIComponent(S.key)}&c=${encodeURIComponent(cid)}`, { scope: './' });
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'go' && e.data.hash) location.hash = e.data.hash; });
    if (supported()) P.sub = await P.reg.pushManager.getSubscription();
  } catch (e) { console.warn('[push] 서비스 워커 등록 실패', e); }
}

const tellSW = async (since) => { try { (await navigator.serviceWorker.ready).active?.postMessage({ type: 'prefs', prefs: prefs(), since }); } catch {} };
async function save() {
  if (!P.sub) return;
  await S.store.put('push', cid, { sub: JSON.parse(JSON.stringify(P.sub)), prefs: prefs(), nick: nick() || '', device: device(), at: Date.now(), deleted: false });
}

function body() {
  const pub = settings().push?.pub, on = !!P.sub && Notification.permission === 'granted', pr = prefs();
  const denied = supported() && Notification.permission === 'denied';
  let status;
  if (S.store?.mode !== 'firebase') status = '<p class="mut">체험 모드에서는 알림을 쓸 수 없어요.</p>';
  else if (!supported() && isIOS && !standalone()) status = `<div class="pu-guide"><b>아이폰은 홈 화면에 추가한 뒤에 알림을 켤 수 있어요</b><ol><li>사파리 아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 눌러요</li><li><b>"홈 화면에 추가"</b>를 눌러요</li><li>홈 화면에 생긴 <b>내전팟</b> 아이콘으로 열고, 다시 이 창에서 알림을 켜요</li></ol><small class="mut">iOS 16.4 이상에서 돼요. 카카오톡 안의 브라우저라면 먼저 "사파리로 열기"를 눌러 주세요.</small></div>`;
  else if (!supported()) status = '<p class="mut">이 브라우저는 알림을 지원하지 않아요. 크롬이나 사파리(아이폰은 홈 화면에 추가)로 열어 주세요.</p>';
  else if (!pub) status = '<p class="mut">관리자가 아직 알림 키를 설정하지 않았어요(관리 화면 > 휴대폰 알림).</p>';
  else if (denied) status = '<p class="bad">이 기기에서 알림이 차단돼 있어요. 휴대폰 설정 > 알림(또는 브라우저 사이트 설정)에서 이 사이트의 알림을 허용한 뒤 다시 켜 주세요.</p>';
  else status = `<div class="pu-state ${on ? 'on' : ''}"><span>${ic('bell')}</span><div><b>${on ? '이 기기에서 알림을 받고 있어요' : '이 기기의 알림이 꺼져 있어요'}</b><small class="mut">${on ? '아래에서 받을 알림을 고를 수 있어요.' : '켜면 사이트를 닫아 둬도 휴대폰으로 알림이 와요.'}</small></div>
      <button class="btn ${on ? 'ghost' : 'pri'}" data-a="${on ? 'pushOff' : 'pushOn'}" ${P.busy ? 'disabled' : ''}>${P.busy ? '처리 중…' : on ? '끄기' : '알림 켜기'}</button></div>`;
  const types = `<div class="pu-types">${PUSH_TYPES.map(([k, t]) => `<label class="pu-t"><input type="checkbox" data-c="pushPref" value="${k}" ${pr.includes(k) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>`;
  const install = standalone() ? '<p class="mut sm">✓ 앱으로 실행 중이에요.</p>'
    : P.install ? `<button class="btn gold" data-a="pushInstall">${ic('star')}홈 화면에 앱으로 설치</button>`
    : `<p class="mut sm">${isIOS ? '사파리 공유 버튼 → "홈 화면에 추가"' : '브라우저 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"'}로 앱처럼 쓸 수 있어요.</p>`;
  return `${mh(`${ic('bell')}알림 · 앱으로 쓰기`)}
    <div class="pu"><h4>휴대폰 알림</h4>${status}
      ${on ? `<h4>받을 알림</h4>${types}<div class="row"><button class="btn ghost xs" data-a="pushTest">${ic('send')}이 기기로 시험 알림 보내기</button></div>` : ''}
      <h4>앱으로 쓰기</h4>${install}
      <p class="hint">알림은 무료예요. 알림 하나에 기기마다 읽기 1번 정도만 쓰여요.</p></div>`;
}
const draw = () => { if (document.querySelector('#modal.on .pu')) modal(body(), 'push-sheet'); }; // 창이 열려 있으면 새 상태로 다시 그린다
export function openPush() { modal(body(), 'push-sheet'); }
act('pushOpen', openPush);
act('pushInstall', async () => { if (!P.install) return; P.install.prompt(); try { await P.install.userChoice; } catch {} P.install = null; draw(); });

act('pushOn', async () => {
  if (P.busy) return;
  const pub = settings().push?.pub; if (!pub) return toast('관리자가 아직 알림 키를 설정하지 않았어요');
  P.busy = true; draw();
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(perm === 'denied' ? '알림이 차단됐어요. 휴대폰 설정에서 허용해 주세요' : '알림을 허용해야 켤 수 있어요');
    const reg = P.reg || (await navigator.serviceWorker.ready);
    P.sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(pub) }));
    await save(); await tellSW(Date.now() - 60e3); // 켠 시점 이후 알림만(기기 시계 오차 1분 여유)
    toast('알림을 켰어요');
  } catch (e) { toast(String(e.message || e)); }
  P.busy = false; draw();
});
act('pushOff', async () => {
  if (P.busy) return; P.busy = true; draw();
  try { await P.sub?.unsubscribe(); } catch {}
  P.sub = null;
  try { await S.store.patch('push', cid, { deleted: true, at: Date.now() }); } catch {}
  P.busy = false; toast('이 기기의 알림을 껐어요'); draw();
});
act('pushPref', async (d, el) => {
  const set = new Set(prefs()); el.checked ? set.add(el.value) : set.delete(el.value);
  try { localStorage.setItem(PREF_KEY, JSON.stringify([...set])); } catch {}
  await tellSW(0);
  try { await S.store.patch('push', cid, { prefs: [...set], at: Date.now() }); } catch {}
});
act('pushTest', async () => {
  if (!hookOn()) return toast('연동 서버가 설정되지 않았어요');
  const r = await callWorker('/pushtest', { cid });
  toast(r.error ? '실패: ' + r.error : r.sent ? '시험 알림을 보냈어요. 몇 초 안에 와요' : '보낼 기기를 찾지 못했어요. 알림을 껐다가 다시 켜 주세요');
});

// ---------- 관리 화면: 알림 키 만들기 ----------
export function pushAdminHTML() {
  const pub = settings().push?.pub;
  return `<div class="panel"><div class="ph"><b>${ic('bell')}휴대폰 알림</b><small class="mut">웹앱 알림 키(VAPID)</small></div>
    ${pub ? `<p>✓ 알림 키가 설정돼 있어요. Worker 비밀값 <code>VAPID_KEY</code>가 들어 있어야 알림이 가요.</p>
      <div class="row"><button class="btn ghost" data-a="pushOpen">${ic('bell')}내 기기 알림 켜기</button><button class="btn ghost xs" data-a="pushKeyNew">키 새로 만들기(모두 다시 켜야 함)</button></div>`
    : `<p class="mut">처음 한 번 알림 키를 만들어야 해요. 만들면 비밀키가 <b>이 화면에만</b> 보이니, 복사해서 Cloudflare Worker의 비밀값 <code>VAPID_KEY</code>로 넣어 주세요.</p>
      <button class="btn pri" data-a="pushKeyNew">${ic('lock')}알림 키 만들기</button>`}
    <div id="pushkey">${PK.secret ? keyBox(PK.secret) : ''}</div></div>`;
}
// 비밀키는 저장하지 않고 이 화면(메모리)에만 잠깐 보여 준다. 설정이 저장되며 화면이 다시 그려져도 사라지지 않게 PK 에 둔다
const PK = { secret: '' };
const keyBox = (secret) => `<div class="pu-key"><p><b>비밀키 (지금만 보여요)</b> — 아래 값을 복사해서 Cloudflare 대시보드 › Workers › naejeonpot › 설정 › 변수 및 비밀 › <b>추가</b> › 유형 <b>비밀</b>, 이름 <code>VAPID_KEY</code>, 값에 붙여 넣고 <b>배포</b>를 눌러 주세요. 채팅이나 다른 곳에는 붙여 넣지 마세요.</p>
    <textarea class="inp mono" readonly rows="3" onclick="this.select()">${esc(secret)}</textarea>
    <div class="row"><button class="btn pri" data-a="pushKeyCopy">복사하기</button><button class="btn ghost" data-a="pushKeyHide">다 넣었어요(숨기기)</button></div></div>`;
act('pushKeyHide', () => { PK.secret = ''; const b = document.getElementById('pushkey'); if (b) b.innerHTML = ''; });
act('pushKeyNew', () => needAdmin(async () => {
  if (settings().push?.pub && !confirm('키를 새로 만들면 지금까지 알림을 켠 모든 기기가 다시 켜야 해요. 계속할까요?')) return;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey), raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const pub = btoa(String.fromCharCode(...raw)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const secret = JSON.stringify({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d });
  PK.secret = secret; // 저장 직후 화면이 다시 그려져도 보이도록 먼저 기억
  try { await S.store.patch('meta', 'settings', { push: { pub, at: Date.now() } }); } catch (e) { PK.secret = ''; return toast('저장 실패: ' + (e.code || e.message)); }
  const box = document.getElementById('pushkey'); if (box) box.innerHTML = keyBox(secret);
}));
act('pushKeyCopy', async () => { const t = document.querySelector('#pushkey textarea'); if (!t) return; try { await navigator.clipboard.writeText(t.value); toast('복사했어요. Worker 비밀값 VAPID_KEY 로 넣어 주세요'); } catch { t.select(); toast('선택된 값을 길게 눌러 복사해 주세요'); } });
