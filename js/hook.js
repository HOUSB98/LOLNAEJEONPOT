// 연동 서버(Cloudflare Worker) 호출. 서버 주소는 js/config.js 의 WORKER_URL.
// 디스코드 웹훅 주소·라이엇 키 같은 비밀값은 서버에만 있고, 여기서는 "무슨 일이 있었는지(종류·문서 id)"만 알린다.
// 서버는 Firestore에서 그 문서를 직접 읽어 확인한 뒤 메시지를 만든다(내용을 꾸며 보낼 수 없음).
import { WORKER_URL } from './config.js';
import { S } from './core.js';

export const hookOn = () => !!WORKER_URL && S.store?.mode === 'firebase';
const base = () => WORKER_URL.replace(/\/+$/, '');

// 실패해도 사이트 동작에는 영향이 없게 조용히 넘긴다. 탭을 바로 닫아도 전송되도록 keepalive.
export function notify(type, id) {
  if (!hookOn()) return;
  try {
    fetch(base() + '/notify', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: S.key, type, id, cid: localStorage.getItem('naejeon:cid') || '' }) }).catch(() => {}); // cid: 보낸 기기에는 휴대폰 알림을 보내지 않는다
  } catch {}
}

// 관리 화면용: 결과(JSON)를 돌려준다. 실패하면 { error } .
export async function callWorker(path, body) {
  if (!WORKER_URL) return { error: 'js/config.js 의 WORKER_URL 이 비어 있어요' };
  try {
    const r = await fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: S.key, ...(body || {}) }) }); // text/plain: 사전 요청(CORS preflight) 없이 바로 보낸다
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || `서버 오류 (${r.status})` };
  } catch (e) { return { error: '연동 서버에 연결하지 못했어요 · ' + (e.message || e) }; }
}

// ---------- Firebase 사용량 (관리 화면·채팅창 공용) ----------
// 연동 서버가 구글 집계를 5분 동안 재사용하므로 여러 화면에서 불러도 같은 값이다. Firestore 읽기는 쓰지 않는다.
// 새 값이 오면 window 에 'usage' 이벤트를 보낸다.
export const USAGE = { d: null, err: '', at: 0, busy: false };
export async function loadUsage(force) {
  if (!hookOn() || USAGE.busy || (!force && Date.now() - USAGE.at < 5 * 60e3)) return;
  USAGE.busy = true; USAGE.at = Date.now();
  const r = await callWorker('/usage');
  USAGE.busy = false;
  if (r.error) USAGE.err = r.error; else { USAGE.d = r; USAGE.err = ''; }
  dispatchEvent(new Event('usage'));
}
export const won = (usd, krw) => '₩' + Math.round((+usd || 0) * (krw || 1400)).toLocaleString('ko-KR');
export const kfmt = (v) => (v >= 10000 ? (v / 1000).toFixed(0) + 'k' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.max(0, Math.round(v))));
