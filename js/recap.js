// 연말 결산(#/recap, #/recap/2026): 한 해 경기 기록만 모아 MVP·개근상·베스트 듀오·라인별 1위·챔피언·명장면·월별 경기 수·내 결산을 보여 준다.
// 저장하는 값은 없다. 그해 경기만 골라 stats.js의 compute()로 다시 계산한다(화면을 열 때 한 번, 기록이 바뀌면 다시).
// 해는 '내전 날짜'(새벽 6시 전 경기는 전날, stats.js dayKey) 기준. MMR 성장은 전체 기록의 경기별 MMR(hist)에서 그해 처음과 끝을 비교한다.
// 메뉴·홈 배너는 11월 20일 ~ 1월 31일에만 보이고(core.js recapSeason), 주소로는 언제나 열린다. 처음 들어갈 때 코드를 받는다(app.js lazyPage).
import { S, page, act, esc, ic, refresh, col, settings, fmtDT, LANES, LANE_NAME, LANE_ICON, recapYear } from './core.js';
import { compute, chem, dayKey, pct } from './stats.js';
import { kakaoBtn } from './kakao.js';
import { nick } from './social.js';

const R = { year: 0, pid: '' };
// 판수가 적은 사람이 순위를 차지하지 않게: (1) 자격 판수(최다 기록의 일정 비율, 최소값 있음) (2) 승률은 50%에 가상 10판(5승 5패)을 섞은 '보정 승률'로 비교
const K = 10, bWr = (v) => (v.w + K / 2) / (v.g + K);
const minOf = (maxN, r, floor) => Math.max(floor, Math.ceil(maxN * r));
const byB = (f) => (a, b) => bWr(f(b)) - bWr(f(a)) || f(b).g - f(a).g;
export const RCP_RULE = '승률은 보정 승률 (승+5)/(판+10)로 비교해요(50%에 가상 10판을 섞어, 판수가 적을수록 50%에 가깝게)';
const ME_KEY = 'naejeon:rcme', squash = (x) => String(x || '').replace(/\s/g, '').toLowerCase();
const yearOf = (m) => +dayKey(m.at).slice(0, 4);
export const recapYears = () => [...new Set(col('matches').filter((m) => !m.deleted && m.winner).map(yearOf))].sort((a, b) => b - a);
const nm = (s) => esc(s?.name || '?');
const wrTxt = (v) => `${v.w}승 ${v.g - v.w}패 · ${pct(v.w, v.g)}%`;
const mins = (ms) => `${Math.floor(ms / 60000)}분 ${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}초`;

// 그해 기록 계산(같은 전체 통계·같은 해면 다시 계산하지 않음)
let memo = { st: null, year: 0, v: null };
export function recapData(year) {
  if (memo.st === S.st && memo.year === year && memo.v) return memo.v;
  const ms = col('matches').filter((m) => !m.deleted && m.winner && yearOf(m) === year);
  const y = compute(col('players'), ms, settings());
  const list = y.list.filter((s) => s.g), maxG = Math.max(0, ...list.map((s) => s.g));
  const minG = minOf(maxG, 0.5, 10); // MVP 자격: 10판 이상이면서 최다 출전자의 절반 이상(못 미치면 MVP 후보에서 뺌)
  const qual = (s) => s.g >= minG, qFirst = (a, b) => qual(b) - qual(a); // 판수와 상관없는 순위(연승·성장)는 자격 판수를 채운 사람이 먼저
  const mvp = list.filter(qual).sort(byB((s) => s));
  const most = [...list].sort((a, b) => b.g - a.g || b.w - a.w);
  const wins = [...list].sort((a, b) => b.w - a.w || b.g - a.g);
  const streak = [...list].sort((a, b) => qFirst(a, b) || b.maxStreak - a.maxStreak || b.g - a.g);
  const upset = [...list].filter((s) => s.upsetWins).sort((a, b) => b.upsetWins - a.upsetWins || b.g - a.g);
  // MMR 성장: 전체 기록의 경기별 MMR에서 그해 첫 경기 직전 → 그해 마지막 경기 뒤(그해 5판 이상)
  const grow = list.filter((s) => s.g >= 5 && S.st.P[s.id]).map((s) => {
    const h = S.st.P[s.id].hist, i0 = h.findIndex((e) => +dayKey(e.at).slice(0, 4) === year);
    let i1 = i0; for (let i = i0; i < h.length; i++) if (+dayKey(h[i].at).slice(0, 4) === year) i1 = i;
    const from = i0 > 0 ? h[i0 - 1].mmr : S.st.P[s.id].mmrInit;
    return { s, from, to: h[i1].mmr, d: h[i1].mmr - from };
  }).sort((a, b) => qFirst(a.s, b.s) || b.d - a.d);
  // 베스트 듀오: 같은 팀 판수가 가장 많은 조합의 30% 이상(최소 5판), 승률 50% 초과만, 보정 승률 순
  const pairs = Object.entries(y.together).map(([k, v]) => ({ ids: k.split('|'), ...v })).filter((x) => x.ids.every((id) => y.P[id]));
  const minDuo = minOf(Math.max(0, ...pairs.map((x) => x.g)), 0.3, 5);
  const duo = pairs.filter((x) => x.g >= minDuo && x.w * 2 > x.g).sort(byB((x) => x)).slice(0, 3);
  // 최다 맞대결(서로 다른 팀으로 가장 많이 만난 두 사람)
  const riv = Object.entries(y.versus).map(([k, v]) => { const [a, b] = k.split('>'); return { a, b, ...v }; }).filter((x) => x.a < x.b).sort((p, q) => q.g - p.g || Math.abs(p.w * 2 - p.g) - Math.abs(q.w * 2 - q.g))[0] || null;
  // 라인별 1위: 그 라인을 가장 많이 간 사람의 30% 이상(최소 5판), 보정 승률 순
  const lanes = LANES.map((l) => { const min = minOf(Math.max(0, ...list.map((s) => s.lanes[l].g)), 0.3, 5); return { l, min, s: list.filter((s) => s.lanes[l].g >= min).sort(byB((s) => s.lanes[l]))[0] || null }; });
  const champs = y.champs.filter((c) => c.g);
  const minC = minOf(champs[0]?.g || 0, 0.2, 5); // 가장 잘 이긴 챔피언: 최다 등장 챔피언의 20% 이상(최소 5판), 보정 승률 순
  const champTop = champs[0] || null, champBest = champs.filter((c) => c.g >= minC).sort(byB((c) => c))[0] || null;
  const champBan = [...y.champs].filter((c) => c.ban).sort((a, b) => b.ban - a.ban)[0] || null;
  const owner = (c) => { const e = Object.entries(c?.users || {}).sort((a, b) => b[1] - a[1])[0]; return e ? { s: y.P[e[0]], n: e[1] } : null; };
  // 명장면: 가장 큰 업셋 · 가장 긴 경기 · 한 경기 최다 킬 · 하루 최다 승 · 가장 많이 한 날
  const longest = ms.filter((m) => +m.dur > 0).sort((a, b) => b.dur - a.dur)[0] || null;
  let kill = null; for (const m of ms) for (const [id, k] of Object.entries(m.kda || {})) if (y.P[id] && (!kill || +k[0] > kill.k)) kill = { id, k: +k[0], kda: k, m };
  let day = null; for (const s of list) for (const [d, v] of Object.entries(s.days)) if (!day || v.w > day.w) day = { s, d, w: v.w, g: v.g };
  const dayN = {}; ms.forEach((m) => { const d = dayKey(m.at); dayN[d] = (dayN[d] || 0) + 1; });
  const busy = Object.entries(dayN).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] || null;
  const month = Array.from({ length: 12 }, (_, i) => ms.filter((m) => +dayKey(m.at).slice(5, 7) === i + 1).length);
  const playMs = ms.reduce((a, m) => a + (+m.dur || 0), 0), durN = ms.filter((m) => +m.dur > 0).length;
  memo = { st: S.st, year, v: { y, ms, list, maxG, minG, minDuo, minC, mvp, most, wins, streak, upset, grow, duo, riv, lanes, champTop, champBest, champBan, owner, longest, kill, day, busy, month, playMs, durN, days: Object.keys(dayN).length } };
  return memo.v;
}

// 카톡 카드(kakao.js가 부름)
export function recapCard(year) {
  year = +year || recapYear();
  const d = recapData(year), raw = (s) => s?.name || '?';
  const lines = [`총 ${d.ms.length}경기 · 내전 ${d.days}일 · ${d.list.length}명 참가`];
  if (d.mvp[0]) lines.push(`MVP ${raw(d.mvp[0])} (${pct(d.mvp[0].w, d.mvp[0].g)}%)`);
  if (d.most[0]) lines.push(`개근상 ${raw(d.most[0])} (${d.most[0].g}판)`);
  if (d.duo[0]) lines.push(`베스트 듀오 ${d.duo[0].ids.map((id) => raw(d.y.P[id])).join(' · ')}`);
  const title = `${year} NAEJEONPOT 연말 결산`;
  return { title, desc: lines.join('\n'), hash: `#/recap/${year}`, text: `${title}\n${lines.join('\n')}`, button: '결산 보러 가기' };
}

const award = (cls, icon, label, who, stat, sub = '') => `<div class="rcp-aw ${cls}"><span class="rcp-ai">${ic(icon)}</span><small>${label}</small><b>${who}</b><em>${stat}</em>${sub ? `<i>${sub}</i>` : ''}</div>`;
const none = (label, icon, why) => `<div class="rcp-aw dim"><span class="rcp-ai">${ic(icon)}</span><small>${label}</small><b>—</b><em>${why}</em></div>`;
const rk = (arr, f, n = 3) => arr.slice(1, n).map((x, i) => `${i + 2}위 ${f(x)}`).join(' · ');

function mine(d) {
  const ids = d.list.map((s) => s.id);
  if (!R.pid || !ids.includes(R.pid)) {
    let v = ''; try { v = localStorage.getItem(ME_KEY) || ''; } catch {}
    const k = squash(nick());
    R.pid = ids.includes(v) ? v : d.list.find((s) => squash(s.name) === k)?.id || '';
  }
  const opts = [...d.list].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((s) => `<option value="${s.id}" ${s.id === R.pid ? 'selected' : ''}>${nm(s)}</option>`).join('');
  const s = d.y.P[R.pid];
  const head = `<div class="ph"><b>${ic('me')}내 결산</b><span class="grow"></span><select class="inp rcp-sel" data-c="rcpMe" aria-label="선수 고르기"><option value="">선수 고르기</option>${opts}</select></div>`;
  if (!s) return `<section class="panel rcp-me" data-k="me">${head}<p class="mut">이름을 고르면 올해 내 기록을 한눈에 볼 수 있어요.</p></section>`;
  const c = chem(d.y, s.id, 3), g = d.grow.find((x) => x.s.id === s.id);
  const lane = LANES.filter((l) => s.lanes[l].g).sort((a, b) => s.lanes[b].g - s.lanes[a].g)[0];
  const ch = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g || b[1].w - a[1].w)[0];
  const rankAt = d.mvp.findIndex((x) => x.id === s.id);
  const cell = (k, v, sub = '') => `<div><small>${k}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  return `<section class="panel rcp-me" data-k="me">${head}
    <div class="rcp-mg">
      ${cell('출전', `${s.g}판`, `전체 ${d.most.findIndex((x) => x.id === s.id) + 1}위`)}
      ${cell('승률', `${pct(s.w, s.g)}%`, `${s.w}승 ${s.g - s.w}패`)}
      ${cell('MVP 순위', rankAt >= 0 ? `${rankAt + 1}위` : '—', rankAt >= 0 ? `자격 ${d.mvp.length}명 중` : `${d.minG}판부터 자격`)}
      ${cell('최장 연승', `${s.maxStreak}연승`)}
      ${cell('MMR 변화', g ? `${g.d >= 0 ? '+' : ''}${Math.round(g.d)}` : '—', g ? `${Math.round(g.from)} → ${Math.round(g.to)}` : '5판부터')}
      ${cell('많이 간 라인', lane ? `${LANE_ICON[lane]} ${LANE_NAME[lane]}` : '—', lane ? wrTxt(s.lanes[lane]) : '')}
      ${cell('많이 쓴 챔피언', ch ? esc(ch[0]) : '—', ch ? wrTxt(ch[1]) : '')}
      ${cell('업셋 승리', `${s.upsetWins}번`, '예상 40% 미만에서 승리')}
    </div>
    <div class="rcp-rel">
      ${c.best ? `<span class="good">${ic('users')}베스트 듀오 <b>${nm(d.y.P[c.best.id])}</b> ${wrTxt(c.best)}</span>` : ''}
      ${c.prey ? `<span class="good">${ic('target')}잘 이긴 상대 <b>${nm(d.y.P[c.prey.id])}</b> ${wrTxt(c.prey)}</span>` : ''}
      ${c.nemesis ? `<span class="bad">${ic('alert')}천적 <b>${nm(d.y.P[c.nemesis.id])}</b> ${wrTxt(c.nemesis)}</span>` : ''}
      ${!c.best && !c.prey && !c.nemesis ? '<span class="mut sm">함께·맞붙은 기록이 3판 이상 쌓이면 듀오·천적이 나와요</span>' : ''}
    </div></section>`;
}

page('recap', {
  title: '연말 결산',
  keyed: true,
  render() {
    const years = recapYears();
    if (S.arg[0] && /^\d{4}$/.test(S.arg[0])) R.year = +S.arg[0];
    if (!R.year || !years.includes(R.year)) R.year = years.includes(recapYear()) ? recapYear() : years[0] || recapYear();
    const yr = R.year;
    const sel = years.length > 1 ? `<div class="seg">${years.map((v) => `<button class="${v === yr ? 'on' : ''}" data-a="rcpYear" data-v="${v}">${v}</button>`).join('')}</div>` : '';
    const top = `<div class="h2row" data-k="hd"><h1>${ic('recap')}연말 결산</h1><span class="tag">${yr}</span><span class="grow"></span>${sel}</div>`;
    const d = recapData(yr);
    if (!d.ms.length) return `${top}<section class="panel empty" data-k="em">${yr}년에는 아직 기록된 경기가 없어요.</section>`;
    const S0 = (a) => a[0] || null;
    const mv = S0(d.mvp), mo = S0(d.most), wi = S0(d.wins), sk = S0(d.streak), up = S0(d.upset), gr = d.grow[0] && d.grow[0].d > 0 ? d.grow[0] : null;
    const peakM = Math.max(1, ...d.month);
    const own = d.owner(d.champTop);
    const hero = `<section class="panel rcp-hero" data-k="hr">
      <div class="rcp-ht"><small>NAEJEONPOT · ${esc(settings().leagueName || '')}</small><h2>${yr} 연말 결산</h2><p class="mut">한 해 동안 함께한 내전을 숫자로 돌아봐요</p></div>
      <div class="rcp-kp">
        <div><b class="mono">${d.ms.length}</b><small>경기</small></div>
        <div><b class="mono">${d.days}</b><small>내전한 날</small></div>
        <div><b class="mono">${d.list.length}</b><small>참가 소환사</small></div>
        <div><b class="mono">${d.durN ? Math.round(d.playMs / 3600000) : '—'}</b><small>${d.durN ? `시간 플레이(${d.durN}판 기준)` : '플레이 시간(리플레이 필요)'}</small></div>
      </div>
      <div class="rcp-share">${kakaoBtn('recap', yr, '카톡으로 결산 공유')}</div></section>`;
    const awards = `<section class="rcp-aws" data-k="aw">
      ${mv ? award('gold big', 'crown', '올해의 MVP', nm(mv), `${wrTxt(mv)}`, `기준: ${d.minG}판 이상(최다 출전의 절반·최소 10판) 중 보정 승률 (승+5)/(판+10) 1위${d.mvp.length > 1 ? ` · ${rk(d.mvp, (x) => nm(x))}` : ''}`) : none('올해의 MVP', 'crown', `${d.minG}판 이상 뛴 사람이 아직 없어요`)}
      ${mo ? award('teal', 'today', '개근상 (최다 출전)', nm(mo), `${mo.g}판 출전`, rk(d.most, (x) => `${nm(x)} ${x.g}판`)) : ''}
      ${wi ? award('', 'star', '최다 승리', nm(wi), `${wi.w}승`, rk(d.wins, (x) => `${nm(x)} ${x.w}승`)) : ''}
      ${sk && sk.maxStreak > 1 ? award('red', 'flame', '최장 연승', nm(sk), `${sk.maxStreak}연승`, [rk(d.streak, (x) => `${nm(x)} ${x.maxStreak}연승`), `${d.minG}판 이상 뛴 사람이 먼저`].filter(Boolean).join(' · ')) : ''}
      ${gr ? award('purple', 'bolt', '성장상 (MMR 상승)', nm(gr.s), `+${Math.round(gr.d)} (${Math.round(gr.from)} → ${Math.round(gr.to)})`, `그해 5판 이상 · ${d.minG}판 이상 뛴 사람이 먼저`) : ''}
      ${up ? award('', 'dice', '업셋 장인', nm(up), `업셋 승리 ${up.upsetWins}번`, '예상 승률 40% 미만 팀으로 승리') : ''}
    </section><p class="hint rcp-rule" data-k="rl">${ic('scale')}순위 기준: 판수가 적은 사람이 앞서지 않게, MVP는 ${d.minG}판(최다 출전의 절반·최소 10판) 이상만 후보이고 ${RCP_RULE}. 연승·성장상도 ${d.minG}판 이상 뛴 사람이 먼저예요.</p>`;
    const duo = `<section class="panel rcp-duo" data-k="du"><div class="ph"><b>${ic('users')}베스트 듀오</b><small class="mut">같은 팀 ${d.minDuo}판 이상 · 보정 승률 순</small></div>
      ${d.duo.length ? `<ol class="rcp-ol">${d.duo.map((x) => `<li><b>${x.ids.map((id) => nm(d.y.P[id])).join(' <i>&amp;</i> ')}</b><span class="mono">${wrTxt(x)}</span></li>`).join('')}</ol>` : '<p class="mut sm">같은 팀으로 여러 판 이기며 뛴 조합이 아직 없어요</p>'}
      ${d.riv ? `<div class="rcp-riv"><small>최다 맞대결</small><b>${nm(d.y.P[d.riv.a])} <i>vs</i> ${nm(d.y.P[d.riv.b])}</b><span class="mono">${d.riv.g}번 · ${d.riv.w} : ${d.riv.g - d.riv.w}</span></div>` : ''}</section>`;
    const lanes = `<section class="panel rcp-lanes" data-k="ln"><div class="ph"><b>${ic('rank')}라인별 1위</b><small class="mut">그 라인을 가장 많이 간 사람의 30% 이상 · 보정 승률 순</small></div>
      <ul class="rcp-lg">${d.lanes.map(({ l, s, min }) => `<li><small>${LANE_ICON[l]} ${LANE_NAME[l]}</small>${s ? `<b>${nm(s)}</b><em class="mono">${wrTxt(s.lanes[l])}</em>` : `<b class="mut">—</b><em>${min}판 이상 없음</em>`}</li>`).join('')}</ul></section>`;
    const champ = `<section class="panel rcp-ch" data-k="ch"><div class="ph"><b>${ic('champs')}챔피언</b></div>
      <div class="rcp-cg">
        <div><small>가장 많이 나온 챔피언</small>${d.champTop ? `<b>${esc(d.champTop.name)}</b><em class="mono">${d.champTop.g}판 · 승률 ${pct(d.champTop.w, d.champTop.g)}%</em>${own ? `<i>가장 많이 쓴 사람 ${nm(own.s)} (${own.n}판)</i>` : ''}` : '<b class="mut">—</b><em>챔피언 기록 없음</em>'}</div>
        <div><small>가장 잘 이긴 챔피언</small>${d.champBest ? `<b>${esc(d.champBest.name)}</b><em class="mono">${wrTxt(d.champBest)}</em><i>${d.minC}판 이상 · 보정 승률</i>` : `<b class="mut">—</b><em>${d.minC}판 이상 나온 챔피언 없음</em>`}</div>
        <div><small>가장 많이 밴된 챔피언</small>${d.champBan ? `<b>${esc(d.champBan.name)}</b><em class="mono">${d.champBan.ban}번 밴</em>` : '<b class="mut">—</b><em>밴 기록 없음</em>'}</div>
      </div></section>`;
    const mu = d.y.sum.maxUpset;
    const scenes = `<section class="panel rcp-sc" data-k="sc"><div class="ph"><b>${ic('mega')}명장면</b></div><ul class="rcp-ul">
      ${mu ? `<li><small>최대 업셋</small><b>예상 ${Math.round(mu.p * 100)}% 팀의 승리</b><span>${fmtDT(mu.m.at)} · ${(mu.m.winner === 'blue' ? mu.m.blue : mu.m.red).map((id) => nm(d.y.P[id])).join(' · ')}</span></li>` : ''}
      ${d.longest ? `<li><small>가장 긴 경기</small><b>${mins(d.longest.dur)}</b><span>${fmtDT(d.longest.at)} · ${d.longest.winner === 'blue' ? '블루' : '레드'} 승리</span></li>` : ''}
      ${d.kill && d.kill.k > 0 ? `<li><small>한 경기 최다 킬</small><b>${nm(d.y.P[d.kill.id])} ${d.kill.k}킬</b><span>${fmtDT(d.kill.m.at)} · ${d.kill.kda.join('/')}${d.kill.m.champs ? ` · ${esc((d.kill.m.blue.includes(d.kill.id) ? d.kill.m.champs.blue : d.kill.m.champs.red)?.[(d.kill.m.blue.includes(d.kill.id) ? d.kill.m.blue : d.kill.m.red).indexOf(d.kill.id)] || '')}` : ''}</span></li>` : ''}
      ${d.day && d.day.w > 1 ? `<li><small>하루 최다 승리</small><b>${nm(d.day.s)} ${d.day.w}승</b><span>${d.day.d.slice(5).replace('-', '/')} · ${d.day.g}판 중</span></li>` : ''}
      ${d.busy ? `<li><small>가장 뜨거웠던 날</small><b>${d.busy[1]}경기</b><span>${d.busy[0].slice(5).replace('-', '/')}</span></li>` : ''}
    </ul></section>`;
    const months = `<section class="panel rcp-mo" data-k="mo"><div class="ph"><b>${ic('cal')}월별 경기 수</b></div>
      <div class="rcp-bars">${d.month.map((v, i) => `<div class="${v === peakM && v ? 'pk' : ''}"><em class="mono">${v || ''}</em><i style="height:${Math.round((v / peakM) * 100)}%"></i><small>${i + 1}월</small></div>`).join('')}</div></section>`;
    return `${top}${hero}${awards}<div class="rcp-2" data-k="r2">${duo}${lanes}</div>${mine(d)}<div class="rcp-2" data-k="r3">${champ}${scenes}</div>${months}`;
  },
  after() {
    if (S.arg[0]) { try { history.replaceState(null, '', location.pathname + location.search + '#/recap'); } catch {} S.arg = []; }
  },
});
act('rcpYear', (d) => { R.year = +d.v; refresh(); });
act('rcpMe', (d, el) => { R.pid = el.value; refresh(); });
