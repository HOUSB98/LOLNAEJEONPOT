module.exports = () => {
    localStorage.setItem('naejeon:nick', '테스터'); sessionStorage.setItem('naejeon:welcomed', '1'); localStorage.setItem('naejeon:xmas', '0');
    if (localStorage.getItem('naejeon:local:matches')) return;
    const L = ['top', 'jg', 'mid', 'adc', 'sup'], CH = ['Ahri', 'Garen', 'Lux', 'Jinx', 'Yasuo', 'Lee Sin', 'Thresh', 'Ezreal', 'Zed', 'Leona'];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const players = {}; for (let i = 0; i < 24; i++) players['p' + i] = { id: 'p' + i, name: '선수' + i, scores: Object.fromEntries(L.map((l) => [l, 5 + Math.floor(rnd() * 15)])), mainLane: L[i % 5], deleted: false };
    const matches = {}, now = Date.now();
    for (let g = 0; g < 300; g++) {
      const ids = Object.keys(players).sort(() => rnd() - 0.5).slice(0, 10), blue = ids.slice(0, 5), red = ids.slice(5);
      const kda = Object.fromEntries(ids.map((id) => [id, [Math.floor(rnd() * 12), Math.floor(rnd() * 10), Math.floor(rnd() * 15)]]));
      matches['g' + g] = { id: 'g' + g, at: now - (300 - g) * 8 * 3600e3, seq: g + 1, seriesId: 's' + Math.floor(g / 2), blue, red, winner: rnd() < 0.5 ? 'blue' : 'red', champs: { blue: blue.map(() => CH[Math.floor(rnd() * 10)]), red: red.map(() => CH[Math.floor(rnd() * 10)]) }, bans: { blue: [], red: [] }, kda, snap: { bs: 50, rs: 50, pBlue: 0.4 + rnd() * 0.2 }, deleted: false };
    }
    const chat = {}; for (let i = 0; i < 30; i++) chat['c' + i] = { id: 'c' + i, at: now - (30 - i) * 60000, cid: 'x' + (i % 3), nick: '친구' + (i % 3), k: 'm', t: '메시지 ' + i };
    const posts = {}; for (let i = 0; i < 15; i++) posts['q' + i] = { id: 'q' + i, at: now - i * 3600e3, title: '글 ' + i, body: '본문 ' + i, pw: 'x', deleted: false };
    for (const [c, d] of Object.entries({ players, matches, chat, posts })) localStorage.setItem('naejeon:local:' + c, JSON.stringify(d));
  };
