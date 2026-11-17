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
    fetch(base() + '/notify', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: S.key, type, id }) }).catch(() => {});
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
