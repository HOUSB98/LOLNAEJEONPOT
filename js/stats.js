// 모든 통계는 여기서 경기 기록으로부터 매번 다시 계산한다(저장된 수식 없음).
export const LANES = ['top', 'jg', 'mid', 'adc', 'sup'];
export const LANE_NAME = { top: '탑', jg: '정글', mid: '미드', adc: '원딜', sup: '서폿' };
export const LANE_ICON = { top: '🗡️', jg: '🌳', mid: '🪄', adc: '🏹', sup: '🛡️' };
export const DEFAULTS = { scale: 23.5, k: 12, leagueName: '친구 내전 리그' };

const TIER_BASE = { 아이언: 800, 브론즈: 900, 실버: 1000, 골드: 1100, 플래티넘: 1200, 에메랄드: 1300, 다이아몬드: 1400 };
export function tierToMmr(t) {
  if (!t) return null;
  const lp = +(t.match(/(\d+)\s*LP/) || [0, 0])[1];
  if (/마스터|챌린저/.test(t)) return Math.round(1500 + lp * 0.1);
  const name = Object.keys(TIER_BASE).find((n) => t.includes(n));
  if (!name) return null;
  const div = +(t.match(/\s([1-4])(\s|$)/) || [0, 4])[1];
  return Math.round(TIER_BASE[name] + (4 - div) * 25 + lp * 0.25);
}
export const avgScore = (p) => LANES.reduce((s, l) => s + (+p.scores?.[l] || 0), 0) / 5;
export const initMmr = (p) => +p.mmrInit || tierToMmr(p.soloTier) || Math.round(900 + 40 * avgScore(p));
export const winProb = (diff, scale) => 1 / (1 + Math.pow(10, -diff / scale));
export const pct = (w, g) => (g ? Math.round((w / g) * 100) : null);
export function dayKey(at) {
  const d = new Date(at - 6 * 3600e3); // 새벽 6시 전 경기는 전날 내전으로 묶는다
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const pk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const blank = () => ({ g: 0, w: 0 });
const add = (o, win) => { o.g++; if (win) o.w++; };

export function compute(playerList, matchList, settings) {
  const cfg = { ...DEFAULTS, ...settings };
  const players = playerList.filter((p) => !p.deleted);
  const matches = matchList.filter((m) => !m.deleted && m.winner).sort((a, b) => a.at - b.at || (a.seq || 0) - (b.seq || 0));
  const P = {};
  for (const p of players) {
    const mmr = initMmr(p);
    P[p.id] = {
      id: p.id, name: p.name, p, g: 0, w: 0, results: [], mmrInit: mmr, mmr, mmrLast: 0,
      lanes: Object.fromEntries(LANES.map((l) => [l, blank()])), side: { blue: blank(), red: blank() },
      champs: {}, days: {}, off: blank(), upsetWins: 0, dogWins: 0, dogGames: 0, favLosses: 0, pSum: 0,
      lastAt: 0, dawn: 0, kda: [0, 0, 0], kdaG: 0, cur: 0, maxStreak: 0, zkw: 0, dx: null,
      dt: { g: 0, cspm: 0, gpm: 0, dpm: 0, vpm: 0, share: 0, taken: 0, on: 0, gd: 0, csd: 0, ic: 0, ig: 0, id: 0, iv: 0 },
      mainLane: p.mainLane || LANES.reduce((a, l) => ((p.scores?.[l] || 0) > (p.scores?.[a] || 0) ? l : a), 'top'),
    };
  }
  const together = {}, versus = {}, laneVs = {}, champs = {}, MI = {}, dayCount = {}, seriesMap = {};
  let blueW = 0, hit = 0, hitN = 0, gapSum = 0, devSum = 0, upsets = 0, maxUpset = null, hof = { n: 0, ids: [] };

  matches.forEach((m, idx) => {
    const sc = (ids) => ids.reduce((s, id, i) => s + (+P[id]?.p.scores?.[LANES[i]] || 0), 0);
    const bs = m.snap?.bs ?? sc(m.blue), rs = m.snap?.rs ?? sc(m.red);
    const pBlue = m.snap?.pBlue ?? winProb(bs - rs, cfg.scale);
    const avg = (ids) => ids.reduce((s, id) => s + (P[id]?.mmr || 1200), 0) / ids.length;
    const mb = avg(m.blue), mr = avg(m.red);
    const eb = 1 / (1 + Math.pow(10, (mr - mb) / 400));
    const bw = m.winner === 'blue';
    const delta = cfg.k * ((bw ? 1 : 0) - eb);
    const pWin = bw ? pBlue : 1 - pBlue;
    const upset = pWin < 0.4;
    const day = dayKey(m.at);
    dayCount[day] = (dayCount[day] || 0) + 1;
    MI[m.id] = { no: idx + 1, bs, rs, pBlue, upset, delta, day };
    (seriesMap[m.seriesId || m.id] ||= []).push(m);
    if (bw) blueW++;
    if (Math.abs(pBlue - 0.5) > 0.005) { hitN++; if (pWin > 0.5) hit++; }
    gapSum += Math.abs(bs - rs); devSum += Math.abs(pBlue - 0.5);
    if (upset) { upsets++; if (!maxUpset || pWin < maxUpset.p) maxUpset = { p: pWin, m }; }
    const hour = new Date(m.at).getHours();

    for (const side of ['blue', 'red']) {
      const ids = m[side], win = m.winner === side, opp = m[side === 'blue' ? 'red' : 'blue'];
      const myP = side === 'blue' ? pBlue : 1 - pBlue;
      ids.forEach((id, i) => {
        const s = P[id]; if (!s) return;
        const lane = LANES[i];
        add(s, win); add(s.lanes[lane], win); add(s.side[side], win); add((s.days[day] ||= blank()), win);
        if (lane !== s.mainLane) add(s.off, win);
        s.results.push(win); s.lastAt = m.at; s.pSum += myP;
        s.mmrLast = side === 'blue' ? delta : -delta; s.mmr += s.mmrLast;
        if (hour < 5) s.dawn++;
        if (myP < 0.5 && win) s.dogWins++;
        if (myP < 0.4) { s.dogGames++; if (win) s.upsetWins++; }
        if (myP >= 0.6 && !win) s.favLosses++;
        s.cur = win ? (s.cur > 0 ? s.cur + 1 : 1) : (s.cur < 0 ? s.cur - 1 : -1);
        if (s.cur > s.maxStreak) s.maxStreak = s.cur;
        if (s.cur > hof.n) hof = { n: s.cur, ids: [id] }; else if (s.cur === hof.n && s.cur > 0 && !hof.ids.includes(id)) hof.ids.push(id);
        const ch = m.champs?.[side]?.[i];
        if (ch) {
          add((s.champs[ch] ||= blank()), win);
          const c = (champs[ch] ||= { name: ch, g: 0, w: 0, ban: 0, users: {} });
          add(c, win); c.users[id] = (c.users[id] || 0) + 1;
        }
        const k = m.kda?.[id];
        if (k) { s.kdaG++; k.forEach((v, j) => (s.kda[j] += +v || 0)); if (win && !+k[0]) s.zkw++; }
        ids.forEach((o) => { if (o > id) add((together[pk(id, o)] ||= blank()), win); });
        opp.forEach((o, j) => {
          add((versus[id + '>' + o] ||= blank()), win);
          if (j === i) add(((laneVs[id] ||= {})[lane + '|' + o] ||= blank()), win);
        });
      });
      (m.bans?.[side] || []).forEach((b) => { if (b) (champs[b] ||= { name: b, g: 0, w: 0, ban: 0, users: {} }).ban++; });
    }
  });

  // 리플레이 상세 지표. 라인마다 CS·피해량 기준이 다르므로 두 가지로 보정한다:
  //  (1) 같은 경기 맞라인 상대와의 차이  (2) 그 라인의 리그 평균을 100으로 둔 지수(경기별로 계산해 평균)
  const LA = {}, rows = [];
  matches.forEach((m) => {
    const min = (m.dur || 0) / 60000;
    if (!m.stats || min <= 0) return;
    for (const side of ['blue', 'red']) {
      const other = m[side === 'blue' ? 'red' : 'blue'], tdmg = m[side].reduce((a, id) => a + (+m.stats[id]?.dmg || 0), 0);
      m[side].forEach((id, i) => {
        const x = m.stats[id], s = P[id]; if (!x || !s) return;
        const o = m.stats[other[i]], lane = LANES[i];
        const r = { s, lane, cspm: x.cs / min, gpm: x.gold / min, dpm: x.dmg / min, vpm: x.vis / min, share: tdmg ? x.dmg / tdmg : 0, taken: +x.taken || 0, gd: o ? x.gold - o.gold : null, csd: o ? x.cs - o.cs : null };
        rows.push(r);
        const a = (LA[lane] ||= { n: 0, cspm: 0, gpm: 0, dpm: 0, vpm: 0 });
        a.n++; for (const k of ['cspm', 'gpm', 'dpm', 'vpm']) a[k] += r[k];
      });
    }
  });
  rows.forEach((r) => {
    const a = LA[r.lane], d = r.s.dt, ix = (k) => (a[k] > 0 ? r[k] / (a[k] / a.n) : 1);
    d.g++; for (const k of ['cspm', 'gpm', 'dpm', 'vpm', 'share', 'taken']) d[k] += r[k];
    if (r.gd !== null) { d.on++; d.gd += r.gd; d.csd += r.csd; }
    d.ic += ix('cspm'); d.ig += ix('gpm'); d.id += ix('dpm'); d.iv += ix('vpm');
  });
  for (const s of Object.values(P)) {
    const d = s.dt; if (!d.g) continue;
    s.dx = { g: d.g, cspm: d.cspm / d.g, gpm: d.gpm / d.g, dpm: d.dpm / d.g, vpm: d.vpm / d.g, share: d.share / d.g, taken: d.taken / d.g,
      gd: d.on ? d.gd / d.on : null, csd: d.on ? d.csd / d.on : null,
      idx: { cs: Math.round((100 * d.ic) / d.g), gold: Math.round((100 * d.ig) / d.g), dmg: Math.round((100 * d.id) / d.g), vis: Math.round((100 * d.iv) / d.g) } };
    s.dx.score = Math.round((s.dx.idx.gold + s.dx.idx.dmg + s.dx.idx.vis) / 3); // 라인 보정 종합(골드·피해·시야). CS는 서폿에게 의미가 없어 제외
  }
  const list = Object.values(P);
  const days = Object.keys(dayCount).sort();
  const lastDay = days[days.length - 1] || null;
  for (const s of list) {
    s.wr = pct(s.w, s.g);
    s.recent = s.results.slice(-5);
    const r = s.recent.length ? s.recent.filter(Boolean).length / s.recent.length : null;
    s.cond = r === null ? '➖' : r >= 0.8 ? '⬆️' : r >= 0.6 ? '↗️' : r === 0.5 ? '➡️' : r >= 0.2 ? '↘️' : '⬇️';
    s.rel = s.g === 0 ? ['⚪', '미검증'] : s.g < 5 ? ['🔴', '낮음'] : s.g < 15 ? ['🟡', '보통'] : ['🟢', '높음'];
    const top3 = LANES.map((l) => +s.p.scores?.[l] || 0).sort((a, b) => b - a).slice(0, 3);
    s.avg = avgScore(s.p);
    s.ovr = Math.round(0.5 * Math.max(0, Math.min(100, (s.mmr - 900) / 7)) + 0.5 * ((top3[0] + top3[1] + top3[2]) / 3) * 5);
    s.today = lastDay ? s.days[lastDay] || blank() : blank();
    s.lanesPlayed = LANES.filter((l) => s.lanes[l].g).length;
    s.champKinds = Object.keys(s.champs).length;
    s.champG = Object.values(s.champs).reduce((a, c) => a + c.g, 0);
  }
  const byOvr = [...list].sort((a, b) => b.ovr - a.ovr);
  byOvr.forEach((s, i) => (s.ovrRank = i + 1));
  const laneAvg = {}, laneRank = {};
  LANES.forEach((l) => {
    laneAvg[l] = list.length ? list.reduce((a, s) => a + (+s.p.scores?.[l] || 0), 0) / list.length : 0;
    [...list].sort((a, b) => (b.p.scores?.[l] || 0) - (a.p.scores?.[l] || 0)).forEach((s, i) => ((laneRank[s.id] ||= {})[l] = i + 1));
  });
  const q15 = list.filter((s) => s.g >= 15).sort((a, b) => b.wr - a.wr)[0];
  const maxG = Math.max(0, ...list.map((s) => s.g));
  const todayTopW = Math.max(0, ...list.map((s) => s.today.w));
  const dx3 = list.filter((s) => s.dx && s.dx.g >= 3), topOf = (k) => [...dx3].sort((a, b) => b.dx[k] - a.dx[k])[0];
  const ctx = { q15, maxG, todayTopW, top: byOvr[0], together, versus, topVis: topOf('vpm'), topTank: topOf('taken'), topScore: [...dx3].sort((a, b) => b.dx.score - a.dx.score)[0] };
  for (const s of list) s.titles = TITLES.filter((t) => { try { return t.test(s, ctx); } catch { return false; } });

  const best10 = list.filter((s) => s.g >= 10).sort((a, b) => b.wr - a.wr)[0];
  const best5 = list.filter((s) => s.g >= 5).sort((a, b) => b.wr - a.wr)[0];
  const n = matches.length;
  const series = Object.entries(seriesMap).map(([id, ms]) => ({ id, ms, day: dayKey(ms[0].at), at: ms[0].at })).sort((a, b) => a.at - b.at);
  return {
    cfg, P, list, byOvr, matches, MI, together, versus, laneVs, laneAvg, laneRank, series, days, lastDay,
    champs: Object.values(champs).sort((a, b) => b.g - a.g || b.w - a.w),
    sum: {
      n, blueW, redW: n - blueW, days: days.length, lastDayN: lastDay ? dayCount[lastDay] : 0,
      hit: pct(hit, hitN), avgGap: n ? gapSum / n : 0, balance: n ? Math.round(100 - (devSum / n) * 200) : null, upsets, maxUpset,
      active: list.filter((s) => s.g).length, best5, best10, hof, maxG, mostIds: list.filter((s) => s.g === maxG && maxG).map((s) => s.id),
      winStreak: [...list].sort((a, b) => b.cur - a.cur)[0], loseStreak: [...list].sort((a, b) => a.cur - b.cur)[0],
    },
  };
}

const anyPair = (s, c, map, self, min, ok) => Object.entries(map).some(([k, v]) => {
  if (v.g < min) return false;
  if (self) { if (!k.startsWith(s.id + '>')) return false; } else if (!k.split('|').includes(s.id)) return false;
  return ok((v.w / v.g) * 100);
});
const first5 = (s) => s.results.slice(0, 5).filter(Boolean).length;
const last5 = (s) => s.recent.filter(Boolean).length;
const all8 = (s) => LANES.every((l) => (s.p.scores?.[l] || 0) >= 8);
export const TITLES = [
  { e: '👑', n: '천하제일인', d: '15판 이상 출전자 중 승률 1위 (승률 55% 이상)', test: (s, c) => c.q15 === s && s.wr >= 55 },
  { e: '🐐', n: '무림맹주', d: '오버롤 1위 + 10판 이상 출전', test: (s, c) => c.top === s && s.g >= 10 },
  { e: '🌟', n: '금일무쌍', d: '최근 내전에서 가장 많이 이긴 사람 (3승 이상)', test: (s, c) => s.today.w >= 3 && s.today.w === c.todayTopW },
  { e: '💯', n: '천하무적', d: '10판 이상 뛰고 한 번도 안 짐', test: (s) => s.g >= 10 && s.w === s.g },
  { e: '☀️', n: '경공비상', d: '최근 내전 4판 이상 뛰고 전승', test: (s) => s.today.g >= 4 && s.today.w === s.today.g },
  { e: '🚌', n: '일기당천', d: '15판 이상, 승률 70% 이상', test: (s) => s.g >= 15 && s.wr >= 70 },
  { e: '🔥', n: '살성강림', d: '지금 5연승 이상 진행 중', test: (s) => s.cur >= 5 },
  { e: '📈', n: '내공폭발', d: '10판 이상 + 최근 5판 중 4승 이상', test: (s) => s.g >= 10 && last5(s) >= 4 },
  { e: '🏅', n: '라인고수', d: '한 라인 10판 이상, 그 라인 승률 65% 이상', test: (s) => LANES.some((l) => s.lanes[l].g >= 10 && s.lanes[l].w / s.lanes[l].g >= 0.65) },
  { e: '🔵', n: '청룡수호', d: '블루 진영 10판 이상, 승률 70% 이상', test: (s) => s.side.blue.g >= 10 && s.side.blue.w / s.side.blue.g >= 0.7 },
  { e: '🔴', n: '주작수호', d: '레드 진영 10판 이상, 승률 70% 이상', test: (s) => s.side.red.g >= 10 && s.side.red.w / s.side.red.g >= 0.7 },
  { e: '🐶', n: '이약제강', d: '업셋(예상승률 40% 미만) 승리 4회 이상', test: (s) => s.upsetWins >= 4 },
  { e: '🎲', n: '역천자', d: '예상승률 50% 미만 팀으로 6승 이상', test: (s) => s.dogWins >= 6 },
  { e: '💞', n: '의형제', d: '같은 팀일 때 승률 75% 이상인 듀오가 있음 (함께 10판 이상)', test: (s, c) => anyPair(s, c, c.together, false, 10, (w) => w >= 75) },
  { e: '🍖', n: '흡성대법', d: '맞붙으면 75% 이상 이기는 상대가 있음 (10판 이상)', test: (s, c) => anyPair(s, c, c.versus, true, 10, (w) => w >= 75) },
  { e: '🃏', n: '땜빵장인', d: '10판 이상 + 주라인이 아닌 라인에서 5승 이상', test: (s) => s.g >= 10 && s.off.w >= 5 },
  { e: '🧭', n: '십팔반무예', d: '10판 이상 + 4개 이상 라인을 플레이', test: (s) => s.g >= 10 && s.lanesPlayed >= 4 },
  { e: '🔒', n: '일로정진', d: '10판 이상, 한 라인만 플레이', test: (s) => s.g >= 10 && s.lanesPlayed === 1 },
  { e: '🏃', n: '금강불괴', d: '최근 내전 7판 이상 출전', test: (s) => s.today.g >= 7 },
  { e: '🎖️', n: '불철주야', d: '가장 많이 출전한 사람 (10판 이상)', test: (s, c) => s.g >= 10 && s.g === c.maxG },
  { e: '🎢', n: '음양교차', d: '10판 이상 + 최근 4판이 승·패 번갈아 나옴', test: (s) => { const r = s.results.slice(-4); return s.g >= 10 && r[0] !== r[1] && r[1] !== r[2] && r[2] !== r[3]; } },
  { e: '🌱', n: '강호초출', d: '아직 1~4판만 뜀', test: (s) => s.g >= 1 && s.g <= 4 },
  { e: '😱', n: '숙적있음', d: '맞붙었을 때 승률 25% 이하인 상대가 있음 (10판 이상)', test: (s, c) => anyPair(s, c, c.versus, true, 10, (w) => w <= 25) },
  { e: '🙈', n: '마교첩자', d: '10판 이상 + 예상승률 60% 이상 팀에서 4패 이상', test: (s) => s.g >= 10 && s.favLosses >= 4 },
  { e: '🫠', n: '주화입마', d: '10판 이상 + 최근 5판 중 1승 이하', test: (s) => s.g >= 10 && last5(s) <= 1 },
  { e: '🌧️', n: '폐관수련', d: '최근 내전 4판 이상 뛰고 전패', test: (s) => s.today.g >= 4 && s.today.w === 0 },
  { e: '🧊', n: '점혈당함', d: '지금 5연패 이상 진행 중', test: (s) => s.cur <= -5 },
  { e: '🧳', n: '표국손님', d: '15판 이상, 승률 30% 이하', test: (s) => s.g >= 15 && s.wr <= 30 },
  { e: '💤', n: '은거기인', d: '마지막 출전이 30일 이상 전', test: (s) => s.g > 0 && Date.now() - s.lastAt > 30 * 864e5 },
  { e: '😇', n: '살신성인', d: '10판 이상, 절반 이상을 주라인이 아닌 라인에서 희생', test: (s) => s.g >= 10 && s.off.g / s.g >= 0.5 },
  { e: '🌋', n: '일일천하', d: '하루에 5승 이상 기록한 적 있음', test: (s) => Object.values(s.days).some((d) => d.w >= 5) },
  { e: '🍀', n: '기연', d: '10판 이상, 실제 승률이 평균 예상 승률보다 15%p 이상 높음', test: (s) => s.g >= 10 && s.wr - (s.pSum / s.g) * 100 >= 15 },
  { e: '🐢', n: '대기만성', d: '10판 이상, 처음 5판 2승 이하 → 최근 5판 4승 이상', test: (s) => s.g >= 10 && first5(s) <= 2 && last5(s) >= 4 },
  { e: '📉', n: '용두사미', d: '10판 이상, 처음 5판 4승 이상 → 최근 5판 1승 이하', test: (s) => s.g >= 10 && first5(s) >= 4 && last5(s) <= 1 },
  { e: '🌈', n: '천변만화', d: '내전에서 서로 다른 챔피언 10종 이상 사용', test: (s) => s.champKinds >= 10 },
  { e: '🔂', n: '독문절기', d: '챔피언 기록 10판 이상, 절반 이상을 한 챔피언으로', test: (s) => s.champG >= 10 && Object.values(s.champs).some((c) => c.g / s.champG >= 0.5) },
  { e: '🌙', n: '야행객', d: '새벽(0시~5시)에 뛴 경기 5판 이상', test: (s) => s.dawn >= 5 },
  { e: '🧲', n: '청룡문도', d: '10판 이상, 80% 이상을 블루 진영에서만 출전', test: (s) => s.g >= 10 && s.side.blue.g / s.g >= 0.8 },
  { e: '🧲', n: '주작문도', d: '10판 이상, 80% 이상을 레드 진영에서만 출전', test: (s) => s.g >= 10 && s.side.red.g / s.g >= 0.8 },
  { e: '🎰', n: '도신', d: '10판 이상, 30% 이상을 예상 승률 40% 미만 팀에서 출전', test: (s) => s.g >= 10 && s.dogGames / s.g >= 0.3 },
  { e: '⚖️', n: '음양평형', d: '10판 이상, 승률이 딱 50%', test: (s) => s.g >= 10 && s.w * 2 === s.g },
  { e: '🍚', n: '국밥', d: '모든 라인 점수 8점 이상, 어디 넣어도 든든', test: (s) => all8(s) },
  { e: '🦄', n: '한우물', d: '한 라인 15점 이상, 나머지는 모두 6점 이하', test: (s) => { const v = LANES.map((l) => s.p.scores?.[l] || 0).sort((a, b) => b - a); return v[0] >= 15 && v[1] <= 6; } },
  // --- 리플레이·KDA 기록 기반 ---
  { e: '💥', n: '파천신공', d: '리플레이 3판 이상, 팀 피해량의 평균 30% 이상을 혼자 담당', test: (s) => s.dx?.g >= 3 && s.dx.share >= 0.3 },
  { e: '🌾', n: '곡창지기', d: '리플레이 3판 이상, 분당 CS 7개 이상', test: (s) => s.dx?.g >= 3 && s.dx.cspm >= 7 },
  { e: '👁️', n: '천리안', d: '리플레이 3판 이상, 분당 시야 점수 리그 1위', test: (s, c) => c.topVis === s },
  { e: '🧱', n: '철포삼', d: '리플레이 3판 이상, 평균 받은 피해량 리그 1위', test: (s, c) => c.topTank === s },
  { e: '🎯', n: '기선제압', d: '리플레이 3판 이상, 맞라인 상대보다 평균 골드 1,000 이상 앞섬', test: (s) => s.dx?.g >= 3 && s.dx.gd >= 1000 },
  { e: '🏯', n: '절대고수', d: '리플레이 3판 이상, 라인 보정 종합 지수 리그 1위 (110 이상)', test: (s, c) => c.topScore === s && s.dx.score >= 110 },
  { e: '🩸', n: '살수', d: 'KDA 기록 5판 이상, 평균 8킬 이상', test: (s) => s.kdaG >= 5 && s.kda[0] / s.kdaG >= 8 },
  { e: '🤝', n: '협객', d: 'KDA 기록 5판 이상, 평균 어시스트 10 이상', test: (s) => s.kdaG >= 5 && s.kda[2] / s.kdaG >= 10 },
  { e: '💀', n: '황천길 단골', d: 'KDA 기록 5판 이상, 평균 7데스 이상', test: (s) => s.kdaG >= 5 && s.kda[1] / s.kdaG >= 7 },
  { e: '🪶', n: '불사신', d: 'KDA 기록 5판 이상, 평균 2.5데스 이하', test: (s) => s.kdaG >= 5 && s.kda[1] / s.kdaG <= 2.5 },
  { e: '🕊️', n: '무혈입성', d: '킬 없이 승리한 경기가 있음', test: (s) => s.zkw >= 1 },
  { e: '👻', n: '무영객', d: '명단에는 있는데 아직 한 판도 안 뜀', test: (s) => s.g === 0 },
];

// 듀오/상대 전적 요약 (케미 분석, 선수 카드 공용)
export function chem(st, id, min) {
  const duo = [], vs = [];
  for (const [k, v] of Object.entries(st.together)) {
    const [a, b] = k.split('|');
    if ((a === id || b === id) && v.g >= min) duo.push({ id: a === id ? b : a, ...v, wr: pct(v.w, v.g) });
  }
  for (const [k, v] of Object.entries(st.versus)) {
    const [a, b] = k.split('>');
    if (a === id && v.g >= min) vs.push({ id: b, ...v, wr: pct(v.w, v.g) });
  }
  const top = (arr, dir) => [...arr].sort((x, y) => dir * (y.wr - x.wr) || y.g - x.g)[0] || null;
  const flat = (arr) => arr.length > 0 && arr.every((x) => x.wr === arr[0].wr);
  return {
    duo, vs,
    best: flat(duo) && duo.length > 1 ? null : top(duo, 1), worst: flat(duo) ? null : top(duo, -1),
    prey: flat(vs) && vs.length > 1 ? null : top(vs, 1), nemesis: flat(vs) ? null : top(vs, -1),
  };
}

// 라인업 평가 (오늘의 내전 보드)
export function evalLineup(blue, red, st) {
  const sc = (id, l) => (id && st.P[id] ? +st.P[id].p.scores?.[l] || 0 : 0);
  const lanes = LANES.map((l, i) => ({ lane: l, b: blue[i], r: red[i], bs: sc(blue[i], l), rs: sc(red[i], l) }));
  const bs = lanes.reduce((a, x) => a + x.bs, 0), rs = lanes.reduce((a, x) => a + x.rs, 0);
  const mm = (ids) => { const v = ids.filter((id) => st.P[id]); return v.length ? v.reduce((a, id) => a + st.P[id].mmr, 0) / v.length : 0; };
  const full = blue.every(Boolean) && red.every(Boolean);
  return { lanes, bs, rs, pBlue: winProb(bs - rs, st.cfg.scale), mmrB: mm(blue), mmrR: mm(red), full };
}
export function bestDuo(ids, st, min = 3) {
  let best = null;
  ids.forEach((a, i) => ids.slice(i + 1).forEach((b) => {
    const v = a && b && st.together[pk(a, b)];
    if (v && v.g >= min && (!best || v.w / v.g > best.w / best.g)) best = { a, b, ...v };
  }));
  return best;
}
export function commentary(ev, st) {
  if (!ev.full) return '🎙️ 양 팀 10명을 모두 배치하면 해설위원이 한마디 합니다.';
  const nm = (id) => st.P[id]?.name || '?';
  const out = [];
  const d = Math.abs(ev.pBlue - 0.5);
  out.push(d < 0.04 ? '이야~ 이건 정말 누가 이길지 모르겠습니다!' : d < 0.1 ? `${ev.pBlue > 0.5 ? '블루' : '레드'}가 살짝 웃고 있지만 뚜껑은 열어봐야 압니다!` : `점수만 보면 ${ev.pBlue > 0.5 ? '블루' : '레드'} 쪽으로 기울었습니다. 팀 다시 짜야 하는 거 아닙니까?`);
  if (Math.abs(ev.mmrB - ev.mmrR) >= 5) out.push(d >= 0.04 && ev.mmrB > ev.mmrR === ev.pBlue > 0.5 ? `MMR도 ${ev.mmrB > ev.mmrR ? '블루' : '레드'}가 더 높아요!` : `그런데 MMR은 ${ev.mmrB > ev.mmrR ? '블루' : '레드'}가 더 높아요!`);
  const key = [...ev.lanes].sort((a, b) => Math.abs(b.bs - b.rs) - Math.abs(a.bs - a.rs))[0];
  if (Math.abs(key.bs - key.rs) >= 3) out.push(`오늘 승부처는 ${LANE_NAME[key.lane]}! ${nm(key.bs > key.rs ? key.b : key.r)} 선수가 여기서 확실히 앞서 있어요!`);
  let h2h = null;
  ev.lanes.forEach((x) => {
    const v = st.laneVs[x.b]?.[x.lane + '|' + x.r];
    if (v && v.g >= 2 && (!h2h || v.g > h2h.v.g)) h2h = { x, v };
  });
  if (h2h) {
    const { x, v } = h2h, bw = v.w, rw = v.g - v.w;
    if (bw !== rw) out.push(`${LANE_NAME[x.lane]}에서는 ${nm(bw > rw ? x.b : x.r)} 선수가 ${nm(bw > rw ? x.r : x.b)} 선수 상대로 ${Math.max(bw, rw)}승 ${Math.min(bw, rw)}패! ${nm(bw > rw ? x.r : x.b)} 선수, 오늘은 복수할 수 있을까요?`);
  }
  return '🎙️ ' + out.join(' ');
}
export function playerLine(s, st) {
  const sc = LANES.map((l) => [l, +s.p.scores?.[l] || 0]).sort((a, b) => b[1] - a[1]);
  const out = [`OVR ${s.ovrRank}위 · ${LANE_NAME[sc[0][0]]} ${sc[0][1]}점` + (sc[0][1] - sc[1][1] >= 4 ? `, 2순위보다 ${+(sc[0][1] - sc[1][1]).toFixed(1)}점 높은 뚜렷한 원포지션 강자입니다.` : sc[0][1] - sc[4][1] <= 3 ? '의 올라운더입니다.' : '가 주무기입니다.')];
  if (!s.g) return out[0] + ' 아직 내전 출전 기록이 없습니다.';
  const ml = LANES.map((l) => [l, s.lanes[l]]).sort((a, b) => b[1].g - a[1].g)[0];
  out.push(`실전 최다 출전은 ${LANE_NAME[ml[0]]}(${ml[1].g}판·${pct(ml[1].w, ml[1].g)}%)입니다.`);
  if (s.cur >= 3) out.push(`현재 ${s.cur}연승으로 흐름을 주도하고 있습니다.`);
  if (s.cur <= -3) out.push(`현재 ${-s.cur}연패, 반등이 필요한 시점입니다.`);
  const ch = Object.entries(s.champs).sort((a, b) => b[1].g - a[1].g)[0];
  if (ch) out.push(ch[1].g >= 3 ? `내전 모스트는 ${ch[0]}(${ch[1].g}판)입니다.` : `내전 챔피언은 ${s.champG}판 ${s.champKinds}종으로 아직 고정 픽이 없습니다.`);
  return out.join(' ');
}
