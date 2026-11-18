// 내전 기록실 연동 서버 (Cloudflare Worker, 무료 플랜)
// 하는 일: ① 디스코드 알림(라인 지원 열림·경기 결과) ② Firebase 사용량 조회 ③ 라이엇 솔랭 티어·전적 자동 갱신(하루 한 번)
// 설치·설정 방법은 같은 폴더의 README.md 참고. 이 파일을 Cloudflare 대시보드의 Worker 편집기에 통째로 붙여 넣으면 된다.
//
// 비밀값(Settings > Variables and Secrets 에서 "Secret"으로 추가):
//   LEAGUE_KEY       초대 링크의 ?k= 뒤 코드 (사이트가 보내는 값과 같아야 요청을 받는다)
//   DISCORD_WEBHOOK  디스코드 채널 웹후크 URL
//   RIOT_KEY         라이엇 개발자 API 키 (RGAPI-...)
//   GCP_SA           구글 클라우드 서비스 계정 키(JSON 전체). 'Monitoring 뷰어' 권한만 주면 된다
// 일반 변수(Text):
//   SITE_URL         디스코드 메시지의 바로가기 주소 (예: 초대 링크 전체)
//   DISCORD_MENTION  (선택) 라인 지원 알림에 붙일 멘션. 예: @everyone 또는 <@&역할ID>
//   ALLOWED_ORIGINS  (선택) 사이트 주소. 기본값 https://housb98.github.io
//   RATE_READ / RATE_WRITE / RATE_DELETE  (선택) 무료 한도를 넘었을 때 10만 건당 요금(달러). 기본값은 서울 리전 추정치
//   USD_KRW          (선택) 원화 환산 환율. 기본값 1400
// 예약 실행(Cron) 두 개: '0,10,20 19 * * *' = 라이엇 갱신(매일 새벽 4시), '*/30 * * * *' = 사용량 감시(무료 한도 근접·요금 디스코드 알림)

const PROJECT = 'lolnaejeonpot';
const API_KEY = 'AIzaSyBx9DdwpagQTZqFqkISJLPpRe7zHYKOgC0'; // Firebase 웹 API 키(공개값). 접근 권한은 LEAGUE_KEY와 Firestore 규칙이 정한다
const LANES = ['top', 'jg', 'mid', 'adc', 'sup'];
const LANE_NAME = { top: '탑', jg: '정글', mid: '미드', adc: '원딜', sup: '서폿' };
const LIMITS = { read: 50000, write: 20000, delete: 20000 }; // Firestore 무료 할당량(하루, 미국 태평양 시간 자정에 초기화)
// 무료 한도를 넘은 만큼의 요금(10만 건당 달러). 서울(asia-northeast3) 추정치라, 정확한 값은 Firestore 가격 페이지에서 확인해 Worker 변수로 덮어쓴다
const RATES = { read: 0.038, write: 0.115, delete: 0.013 };
const RIOT_CRON = '0,10,20 19 * * *';
const NEAR = 0.8; // 하루 무료 한도의 80%를 넘으면 디스코드로 미리 알린다
const REPORT_HOUR = 9; // 요금 누적 알림은 한국 시간 오전 9시 이후 하루 한 번

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET' && url.pathname === '/') {
      // 설정 확인용: 어떤 값이 들어 있는지만 알려 준다(값 자체는 절대 내보내지 않음)
      return json({ ok: true, set: { LEAGUE_KEY: !!env.LEAGUE_KEY, DISCORD_WEBHOOK: !!env.DISCORD_WEBHOOK, RIOT_KEY: !!env.RIOT_KEY, GCP_SA: !!env.GCP_SA, SITE_URL: !!env.SITE_URL } }, 200, cors);
    }
    if (req.method !== 'POST') return json({ error: 'not found' }, 404, cors);
    if (!cors['Access-Control-Allow-Origin']) return json({ error: '허용되지 않은 사이트에서 온 요청입니다' }, 403, cors);
    let body = {};
    try { body = JSON.parse(await req.text() || '{}'); } catch { return json({ error: '잘못된 요청' }, 400, cors); }
    if (!env.LEAGUE_KEY || body.key !== env.LEAGUE_KEY) return json({ error: '리그 키가 맞지 않습니다 (Worker의 LEAGUE_KEY 확인)' }, 403, cors);
    try {
      if (url.pathname === '/notify') return json(await notify(env, body), 200, cors);
      if (url.pathname === '/test') return json(await testMessage(env), 200, cors);
      if (url.pathname === '/usage') return json(await usage(env), 200, cors);
      if (url.pathname === '/watch') return json(await watchUsage(env), 200, cors); // 사용량 감시를 지금 한 번 실행(설정 확인용)
      if (url.pathname === '/riot') {
        if (Date.now() - (MEM.riotAt || 0) < 60e3) return json({ error: '1분 뒤에 다시 눌러 주세요' }, 429, cors);
        MEM.riotAt = Date.now();
        return json(await riotUpdate(env, true), 200, cors);
      }
    } catch (e) {
      return json({ error: String(e.message || e) }, 500, cors);
    }
    return json({ error: 'not found' }, 404, cors);
  },
  // 예약 실행(Settings > Triggers > Cron). 라이엇 갱신은 한 번에 처리할 수 있는 양이 정해져 있어(무료 플랜 요청 50회)
  // 새벽에 10분 간격으로 몇 번 돌리면, 그날 아직 안 된 사람만 이어서 처리한다.
  async scheduled(event, env, ctx) {
    if (event.cron === RIOT_CRON) ctx.waitUntil(riotUpdate(env, false).catch((e) => console.error('[riot]', e)));
    else ctx.waitUntil(watchUsage(env).catch((e) => console.error('[usage]', e)));
  },
};

const MEM = { sent: new Map(), token: null, usage: null }; // 같은 서버 인스턴스 안에서만 유지되는 임시 기억(중복 전송·잦은 조회 방지)

function corsHeaders(origin, env) {
  const list = (env.ALLOWED_ORIGINS || 'https://housb98.github.io').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const ok = list.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : { Vary: 'Origin' };
}
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

// ---------- Firestore (REST + 웹 API 키, 규칙은 사이트와 동일하게 적용됨) ----------
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const docBase = (env) => `${ROOT}/leagues/${env.LEAGUE_KEY}`;
const docName = (env, col, id) => `projects/${PROJECT}/databases/(default)/documents/leagues/${env.LEAGUE_KEY}/${col}/${id}`;
function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return decFields(v.mapValue.fields);
  return null;
}
const decFields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));
function enc(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)])) } };
}
async function getDoc(env, col, id) {
  const r = await fetch(`${docBase(env)}/${col}/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore 읽기 실패 (${r.status})`);
  const j = await r.json();
  return { ...decFields(j.fields), id };
}
async function listDocs(env, col) {
  const out = []; let token = '', calls = 0;
  do {
    const r = await fetch(`${docBase(env)}/${col}?pageSize=300&key=${API_KEY}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`); calls++;
    if (!r.ok) throw new Error(`Firestore 목록 읽기 실패 (${r.status})`);
    const j = await r.json();
    for (const d of j.documents || []) out.push({ ...decFields(d.fields), id: d.name.split('/').pop() });
    token = j.nextPageToken || '';
  } while (token && calls < 5);
  return { docs: out, calls };
}
async function commit(env, writes) {
  const r = await fetch(`${ROOT}:commit?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (!r.ok) throw new Error(`Firestore 저장 실패 (${r.status}) ${(await r.text()).slice(0, 200)}`);
}
// 문서 일부만 고친다: fields 는 { 'soloTier': '골드 2', 'solo.record': '...' } 처럼 점(.) 경로
function patchWrite(env, col, id, fields) {
  const tree = {};
  for (const [path, v] of Object.entries(fields)) {
    const ks = path.split('.'); let o = tree;
    ks.slice(0, -1).forEach((k) => (o = o[k] ||= {}));
    o[ks[ks.length - 1]] = v;
  }
  return { update: { name: docName(env, col, id), fields: enc(tree).mapValue.fields }, updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { exists: true } };
}

// ---------- 디스코드 ----------
async function discord(env, payload) {
  if (!env.DISCORD_WEBHOOK) throw new Error('DISCORD_WEBHOOK 이 설정되지 않았어요');
  const r = await fetch(env.DISCORD_WEBHOOK + (env.DISCORD_WEBHOOK.includes('?') ? '&' : '?') + 'wait=true', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '내전 기록실', allowed_mentions: { parse: [] }, ...payload }),
  });
  if (!r.ok) throw new Error(`디스코드 전송 실패 (${r.status}) ${(await r.text()).slice(0, 200)}`);
  return { ok: true };
}
const once = (k) => { // 같은 알림을 두 번 보내지 않는다(6시간 기억)
  const now = Date.now();
  for (const [x, t] of MEM.sent) if (now - t > 6 * 3600e3) MEM.sent.delete(x);
  if (MEM.sent.has(k)) return false;
  MEM.sent.set(k, now); return true;
};
const mentionPayload = (env) => {
  const m = (env.DISCORD_MENTION || '').trim();
  if (!m) return {};
  return { content: m, allowed_mentions: { parse: m.includes('@everyone') || m.includes('@here') ? ['everyone'] : [], roles: [...m.matchAll(/<@&(\d+)>/g)].map((x) => x[1]), users: [...m.matchAll(/<@!?(\d+)>/g)].map((x) => x[1]) } };
};

async function notify(env, { type, id }) {
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new Error('잘못된 id');
  if (!once(type + ':' + id)) return { ok: true, skipped: '이미 보낸 알림' };
  if (type === 'board') return boardMessage(env, id);
  if (type === 'match') return matchMessage(env, id);
  if (type === 'gacha') return gachaMessage(env, id);
  if (type === 'post') return postMessage(env, id);
  throw new Error('알 수 없는 알림 종류');
}

// 라인 지원 열림: meta/board 문서를 직접 읽어 정말 열렸는지 확인하고 보낸다
async function boardMessage(env, rid) {
  const d = await getDoc(env, 'meta', 'board');
  if (!d || d.rid !== rid || d.status !== 'open') return { ok: true, skipped: '열린 라인 지원이 없음' };
  const { docs } = await listDocs(env, 'players');
  const nm = Object.fromEntries(docs.map((p) => [p.id, p.name]));
  const names = (d.ids || []).map((x) => nm[x] || '?');
  return discord(env, {
    ...mentionPayload(env),
    embeds: [{
      title: '📣 라인 지원이 열렸어요!', url: env.SITE_URL || undefined, color: 0xd9a441,
      description: `사이트에서 원하는 라인을 **1~3지망**으로 골라 주세요.\n마감하면 몰린 라인은 추첨합니다.${env.SITE_URL ? `\n\n👉 [지금 지원하러 가기](${env.SITE_URL})` : ''}`,
      fields: [{ name: `참가자 ${names.length}명`, value: names.join(', ').slice(0, 1000) || '-' }],
      footer: { text: `연 사람 ${d.by || '익명'} · 2시간 동안 움직임이 없으면 자동으로 닫혀요` },
      timestamp: new Date(d.at || Date.now()).toISOString(),
    }],
  });
}

// 가챠 전설 이상 스킨: id = "선수id-뽑은시각". gacha/{선수id} 의 기록에 정말 있는지(30분 이내) 확인하고 보낸다
const GACHA_TIER = { legendary: ['전설', 0xffb347, '1820 RP'], ultimate: ['궁극', 0xff5d8f, '3250 RP'], mythic: ['신화', 0xff4fd8, '신화 정수'], transcendent: ['초월', 0x7ff3ff, '한정·최고가'] };
async function gachaMessage(env, id) {
  const m = id.match(/^(.+)-(\d{12,14})$/); if (!m) throw new Error('잘못된 id');
  const [, pid, at] = m, d = await getDoc(env, 'gacha', pid);
  const l = (d?.log || []).find((x) => +x.at === +at && x.k === 'skin' && GACHA_TIER[x.t]);
  if (!l || Date.now() - +at > 30 * 60e3) return { ok: true, skipped: '해당 기록 없음' };
  const p = await getDoc(env, 'players', pid), [tn, color, price] = GACHA_TIER[l.t];
  const img = l.c ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${l.c === 'Fiddlesticks' ? 'FiddleSticks' : l.c}_${+l.num || 0}.jpg` : undefined;
  return discord(env, {
    embeds: [{
      title: `🎉 ${p?.name || '누군가'}님이 [${tn}] 스킨을 뽑았어요!`, url: env.SITE_URL || undefined, color,
      description: `**${l.n}**\n${tn} · ${price}${env.SITE_URL ? `\n\n👉 [나도 뽑으러 가기](${env.SITE_URL}#/gacha)` : ''}`,
      image: img ? { url: img } : undefined,
      timestamp: new Date(+at).toISOString(),
    }],
  });
}

// 익명 게시판 새 글: posts/{id} 를 읽어 30분 이내의 지워지지 않은 글만 보낸다. 글쓴이 정보는 원래 저장되지 않는다
async function postMessage(env, id) {
  const p = await getDoc(env, 'posts', id);
  if (!p || p.deleted || Date.now() - (+p.at || 0) > 30 * 60e3) return { ok: true, skipped: '글 없음' };
  const cut = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
  return discord(env, {
    embeds: [{
      title: '📝 익명 게시판에 새 글이 올라왔어요', url: env.SITE_URL ? env.SITE_URL + '#/talk' : undefined, color: 0x9b8cff,
      description: `${p.title ? `**${cut(p.title, 80)}**\n` : ''}${cut(p.body, 200) || '-'}${env.SITE_URL ? `\n\n👉 [게시판에서 보기](${env.SITE_URL}#/talk)` : ''}`,
      footer: { text: '글쓴이는 누구도 알 수 없어요' },
      timestamp: new Date(+p.at || Date.now()).toISOString(),
    }],
  });
}

// 경기 결과: matches 문서를 읽어서 보낸다
async function matchMessage(env, id) {
  const m = await getDoc(env, 'matches', id);
  if (!m || m.deleted || !m.winner) return { ok: true, skipped: '경기 없음' };
  const { docs } = await listDocs(env, 'players');
  const nm = Object.fromEntries(docs.map((p) => [p.id, p.name]));
  const bw = m.winner === 'blue', pb = m.snap?.pBlue ?? 0.5, pWin = bw ? pb : 1 - pb;
  const side = (s) => (m[s] || []).map((pid, i) => {
    const ch = m.champs?.[s]?.[i], k = m.kda?.[pid];
    return `\`${LANE_NAME[LANES[i]]}\` **${nm[pid] || '?'}**${ch ? ` · ${ch}` : ''}${Array.isArray(k) ? ` · ${k.join('/')}` : ''}`;
  }).join('\n') || '-';
  const score = (s) => (typeof m.snap?.[s] === 'number' ? ` · ${m.snap[s].toFixed(1)}점` : '');
  return discord(env, {
    embeds: [{
      title: `${bw ? '🔵 블루' : '🔴 레드'} 승리!${pWin < 0.4 ? ' 🐶 업셋!' : ''}`, url: env.SITE_URL || undefined, color: bw ? 0x3b82f6 : 0xef4444,
      fields: [
        { name: `🔵 BLUE${bw ? ' 🏆' : ''}${score('bs')}`, value: side('blue'), inline: true },
        { name: `🔴 RED${bw ? '' : ' 🏆'}${score('rs')}`, value: side('red'), inline: true },
      ],
      footer: { text: `경기 전 예상 승률 블루 ${Math.round(pb * 100)}% : 레드 ${100 - Math.round(pb * 100)}%` },
      timestamp: new Date(m.at || Date.now()).toISOString(),
    }],
  });
}

async function testMessage(env) {
  return discord(env, { embeds: [{ title: '✅ 연동 테스트', description: '내전 기록실과 디스코드가 연결됐어요. 앞으로 라인 지원·경기 결과 알림이 이 채널에 올라옵니다.', color: 0x4fd08b, url: env.SITE_URL || undefined }] });
}

// ---------- Firebase 사용량 (Cloud Monitoring) ----------
// 서비스 계정 키로 접근 토큰을 받는다(RS256 서명, 1시간 유효)
async function googleToken(env) {
  if (MEM.token && MEM.token.exp > Date.now() + 60e3) return MEM.token.v;
  if (!env.GCP_SA) throw new Error('서비스 계정 키(GCP_SA)가 설정되지 않았어요');
  let sa;
  try { sa = JSON.parse(env.GCP_SA); } catch { throw new Error('GCP_SA 값이 JSON 형식이 아니에요(키 파일 내용 전체를 붙여 넣어 주세요)'); }
  const b64 = (o) => btoa(typeof o === 'string' ? o : String.fromCharCode(...new Uint8Array(o))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(unescape(encodeURIComponent(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/monitoring.read', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${b64(sig)}` });
  const j = await r.json();
  if (!r.ok) throw new Error('구글 인증 실패: ' + (j.error_description || j.error || r.status));
  MEM.token = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return MEM.token.v;
}
// 미국 태평양 시간 기준 날짜(할당량이 그 자정에 초기화된다)
const ptDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
async function points(tok, metric, start, end, period) {
  const u = new URL(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`);
  u.searchParams.set('filter', `metric.type="firestore.googleapis.com/document/${metric}_count"`);
  u.searchParams.set('interval.startTime', new Date(start).toISOString());
  u.searchParams.set('interval.endTime', new Date(end).toISOString());
  u.searchParams.set('aggregation.alignmentPeriod', period + 's');
  u.searchParams.set('aggregation.perSeriesAligner', 'ALIGN_SUM');
  u.searchParams.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + tok } });
  const j = await r.json();
  if (!r.ok) throw new Error('사용량 조회 실패: ' + (j.error?.message || r.status));
  return (j.timeSeries?.[0]?.points || []).map((p) => ({ end: Date.parse(p.interval.endTime), v: Number(p.value.int64Value ?? p.value.doubleValue ?? 0) }));
}
const rates = (env) => ({ read: +env.RATE_READ || RATES.read, write: +env.RATE_WRITE || RATES.write, delete: +env.RATE_DELETE || RATES.delete });
// 하루 무료 한도는 날마다 따로 적용된다: 그날 넘은 만큼만 요금
const dayCost = (d, r) => ['read', 'write', 'delete'].reduce((s, k) => s + (Math.max(0, d[k] - LIMITS[k]) / 1e5) * r[k], 0);
async function usage(env, fresh = false) {
  if (!fresh && MEM.usage && Date.now() - MEM.usage.at < 5 * 60e3) return { ...MEM.usage, cached: true };
  const tok = await googleToken(env);
  const now = Date.now(), hour = now - (now % 3600e3), min = now - (now % 60e3);
  const days = {};
  for (let i = 31; i >= 0; i--) days[ptDate(now - i * 864e5)] = { read: 0, write: 0, delete: 0 };
  await Promise.all(['read', 'write', 'delete'].map(async (k) => {
    // 지난 31일(이번 달 누적용)은 1시간 단위로 받아 태평양 시간 날짜별로 묶고, 이번 시간의 앞부분은 따로 받아 오늘에 더한다
    const hrs = await points(tok, k, hour - 31 * 864e5, hour, 3600);
    hrs.forEach((p) => { const d = days[ptDate(p.end - 1)]; if (d) d[k] += p.v; });
    if (min - hour >= 60e3) (await points(tok, k, hour, min, (min - hour) / 1000)).forEach((p) => { const d = days[ptDate(p.end - 1)]; if (d) d[k] += p.v; });
  }));
  const r = rates(env), krw = +env.USD_KRW || 1400;
  const list = Object.entries(days).map(([date, v]) => ({ date, ...v, usd: +dayCost(v, r).toFixed(4) }));
  const today = list[list.length - 1], month = today.date.slice(0, 7);
  const mUsd = list.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + x.usd, 0);
  const out = { at: now, today, days: list.slice(-8), month: { key: month, usd: +mUsd.toFixed(4) }, limits: LIMITS, rates: r, krw, note: '구글 집계는 보통 몇 분 늦게 반영됩니다' };
  MEM.usage = out;
  return out;
}

// ---------- 사용량 감시 (예약 실행, 30분마다) ----------
// 알림 기록은 ops/alerts 문서에 둔다(사이트가 구독하지 않는 컬렉션이라 접속자 화면에 읽기가 퍼지지 않는다)
const won = (usd, krw) => '₩' + Math.round(usd * krw).toLocaleString('ko-KR');
const money = (usd, krw) => `${won(usd, krw)} ($${usd.toFixed(2)})`;
const NAME3 = { read: '읽기', write: '쓰기', delete: '삭제' };
async function watchUsage(env) {
  if (!env.GCP_SA || !env.DISCORD_WEBHOOK) return { skipped: true };
  const u = await usage(env, true), t = u.today, krw = u.krw;
  const st = (await getDoc(env, 'ops', 'alerts')) || {};
  const prev = { date: st.date || '', near: st.near || {}, charged: !!st.charged, reportDay: st.reportDay || '', reportedUsd: +st.reportedUsd || 0, reportedMonth: st.reportedMonth || '' };
  const next = JSON.parse(JSON.stringify(prev));
  if (next.date !== t.date) { next.date = t.date; next.near = {}; next.charged = false; } // 태평양 시간 자정이 지나면 하루 기록 초기화
  if (next.reportedMonth !== u.month.key) { next.reportedMonth = u.month.key; next.reportedUsd = 0; }
  const msgs = [];
  // ① 무료 한도 근접 (항목마다 하루 한 번)
  const near = ['read', 'write', 'delete'].filter((k) => t[k] >= LIMITS[k] * NEAR && t[k] < LIMITS[k] && !next.near[k]); // 이미 넘었으면 아래 요금 알림이 대신한다
  if (near.length) {
    near.forEach((k) => (next.near[k] = true));
    msgs.push({ title: '⚠️ 오늘 무료 사용량이 거의 다 찼어요', color: 0xf2c14e,
      description: near.map((k) => `**${NAME3[k]}** ${t[k].toLocaleString('ko-KR')} / ${LIMITS[k].toLocaleString('ko-KR')} (${Math.round((t[k] / LIMITS[k]) * 100)}%)`).join('\n') + '\n\n한도를 넘으면 넘은 만큼 요금이 붙어요. 한국 시간 오후 4~5시에 0으로 초기화됩니다.' });
  }
  // ② 오늘 처음 요금 발생 (하루 한 번)
  let chargedNow = false;
  if (t.usd > 0 && !next.charged) {
    next.charged = chargedNow = true;
    msgs.push({ title: '💸 오늘 무료 한도를 넘어 요금이 붙기 시작했어요', color: 0xef4444,
      description: `오늘 지금까지 **${money(t.usd, krw)}**\n이번 달 누적 **${money(u.month.usd, krw)}**\n\n` + ['read', 'write', 'delete'].map((k) => `${NAME3[k]} ${t[k].toLocaleString('ko-KR')} / ${LIMITS[k].toLocaleString('ko-KR')}`).join(' · ') });
  }
  // ③ 요금 누적: 이번 달 금액이 지난 알림 때보다 늘었으면 하루 한 번(한국 시간 오전 9시 이후)
  const kst = new Date(Date.now() + 9 * 3600e3), kstDay = kst.toISOString().slice(0, 10);
  if (!chargedNow && kst.getUTCHours() >= REPORT_HOUR && next.reportDay !== kstDay && u.month.usd > next.reportedUsd + 0.00005) {
    const y = u.days[u.days.length - 2];
    next.reportDay = kstDay; next.reportedUsd = u.month.usd;
    msgs.push({ title: '🧾 Firebase 요금이 늘었어요', color: 0x9b8cff,
      description: `이번 달 누적 **${money(u.month.usd, krw)}**\n어제(${y.date.slice(5).replace('-', '/')}) ${money(y.usd, krw)} · 오늘 지금까지 ${money(t.usd, krw)}`,
      footer: { text: '사용량으로 계산한 예상 금액이라 실제 청구서와 조금 다를 수 있어요' } });
  }
  if (msgs.length) await discord(env, { embeds: msgs.map((e) => ({ url: env.SITE_URL || undefined, timestamp: new Date().toISOString(), ...e })) });
  if (JSON.stringify(next) !== JSON.stringify(prev)) await commit(env, [{ update: { name: docName(env, 'ops', 'alerts'), fields: enc(next).mapValue.fields } }]);
  return { sent: msgs.length };
}

// ---------- 라이엇 솔랭 자동 갱신 ----------
const TIER_KO = { IRON: '아이언', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘', EMERALD: '에메랄드', DIAMOND: '다이아몬드', MASTER: '마스터', GRANDMASTER: '그랜드마스터', CHALLENGER: '챌린저' };
const DIV = { I: 1, II: 2, III: 3, IV: 4 };
const tierText = (e) => (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(e.tier) ? `${TIER_KO[e.tier]} · ${e.leaguePoints}LP` : `${TIER_KO[e.tier] || e.tier} ${DIV[e.rank] || e.rank} · ${e.leaguePoints}LP`);
// 사이트(js/stats.js)의 initMmr 과 같은 계산. 솔랭 티어가 바뀌어도 내전 MMR 시작값이 흔들리지 않게, 처음 갱신할 때 지금 값으로 고정한다
const TIER_BASE = { 아이언: 800, 브론즈: 900, 실버: 1000, 골드: 1100, 플래티넘: 1200, 에메랄드: 1300, 다이아몬드: 1400 };
function tierToMmr(t) {
  if (!t) return null;
  const lp = +(t.match(/(\d+)\s*LP/) || [0, 0])[1];
  if (/마스터|챌린저/.test(t)) return Math.round(1500 + lp * 0.1);
  const name = Object.keys(TIER_BASE).find((n) => t.includes(n));
  if (!name) return null;
  const div = +(t.match(/\s([1-4])(\s|$)/) || [0, 4])[1];
  return Math.round(TIER_BASE[name] + (4 - div) * 25 + lp * 0.25);
}
const initMmr = (p) => +p.mmrInit || tierToMmr(p.soloTier) || Math.round(900 + 40 * (LANES.reduce((s, l) => s + (+p.scores?.[l] || 0), 0) / 5));
const mainRiotId = (p) => String(p.riotId || '').split(',')[0].trim();
const kstDate = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '.');
async function riotGet(env, url) {
  const r = await fetch(url, { headers: { 'X-Riot-Token': env.RIOT_KEY } });
  if (!r.ok) { const e = new Error(`라이엇 API ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}
async function riotUpdate(env, manual) {
  if (!env.RIOT_KEY) throw new Error('RIOT_KEY 가 설정되지 않았어요');
  let budget = 45; // 무료 플랜은 한 번 실행에 외부 요청 50회까지. 여유를 두고 45회
  const { docs, calls } = await listDocs(env, 'players'); budget -= calls;
  const now = Date.now(), FRESH = 20 * 3600e3;
  const todo = docs.filter((p) => !p.deleted && mainRiotId(p).includes('#'))
    .filter((p) => !(p.riot?.at && now - p.riot.at < FRESH) && (manual || !(p.riot?.errAt && now - p.riot.errAt < FRESH)))
    .sort((a, b) => (a.riot?.at || 0) - (b.riot?.at || 0));
  const writes = [], out = { updated: [], failed: [], left: 0, total: docs.filter((p) => !p.deleted && mainRiotId(p).includes('#')).length };
  for (let i = 0; i < todo.length; i++) {
    const p = todo[i], rid = mainRiotId(p), cached = p.riot?.puuid && p.riot.id === rid;
    if (budget - 1 < (cached ? 1 : 2)) { out.left = todo.length - i; break; } // 마지막 1회는 저장용으로 남긴다
    try {
      let puuid = cached ? p.riot.puuid : null;
      if (!puuid) {
        const at = rid.lastIndexOf('#');
        budget--; puuid = (await riotGet(env, `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(rid.slice(0, at).trim())}/${encodeURIComponent(rid.slice(at + 1).trim())}`)).puuid;
      }
      budget--;
      const solo = (await riotGet(env, `https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`)).find((e) => e.queueType === 'RANKED_SOLO_5x5');
      const f = { riot: { id: rid, puuid, at: now, ...(solo ? { tier: solo.tier, rank: solo.rank, lp: solo.leaguePoints, w: solo.wins, l: solo.losses } : { unranked: true }) } };
      if (solo) {
        const t = tierText(solo);
        if (t !== p.soloTier) { f.soloTier = t; if (!+p.mmrInit) f.mmrInit = initMmr(p); }
        const g = solo.wins + solo.losses;
        f['solo.record'] = `${solo.wins}승 ${solo.losses}패${g ? ` (${Math.round((solo.wins / g) * 100)}%)` : ''}`;
        f['solo.asOf'] = kstDate(now);
      }
      writes.push(patchWrite(env, 'players', p.id, f));
      out.updated.push(`${p.name} ${solo ? tierText(solo) : '언랭'}`);
    } catch (e) {
      if (e.status === 401 || e.status === 403) { if (writes.length) await commit(env, writes); throw new Error('라이엇 API 키가 만료됐거나 잘못됐어요 (개발 키는 24시간마다 다시 받아야 해요)'); }
      if (e.status === 429) { out.left = todo.length - i; break; } // 호출 한도: 다음 실행에서 이어서
      const msg = e.status === 404 ? '라이엇 ID를 찾을 수 없음' : String(e.message || e);
      writes.push(patchWrite(env, 'players', p.id, { riot: { ...(p.riot || {}), err: msg, errAt: now } }));
      out.failed.push(`${p.name} (${rid}): ${msg}`);
    }
  }
  if (writes.length) await commit(env, writes);
  return out;
}
