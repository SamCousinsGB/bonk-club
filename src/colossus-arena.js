const terrace = (x, y, w, h = 32) => ({
  x, y, w, h, material: 'stone', colossusStone: true,
});

// A low, open ruin keeps the distant silhouette clear. Staggered stairs connect both
// galleries; the lower crossing remains an escape route after an upper cut.
export const COLOSSUS_ARENA = {
  name: 'COLOSSUS', theme: 'colossus', color: '#1a2734', colossus: true,
  setpiece: true,
  platforms: [
    terrace(60, 1320, 2440, 64),
    terrace(80, 1020, 620, 38), terrace(1860, 1020, 620, 38),
    terrace(860, 910, 840, 40),
    terrace(630, 1170, 470), terrace(1460, 1170, 470),
    terrace(120, 1180, 200, 24), terrace(2240, 1180, 200, 24),
    terrace(550, 870, 180, 24), terrace(1830, 870, 180, 24),
    terrace(1110, 1060, 340, 24),
  ],
  spawns: [[170, 978], [2390, 978], [360, 1278], [2200, 1278]],
  weapons: [[990, 875, 'blaster'], [1570, 875, 'blaster'],
    [800, 1135, 'blaster'], [1760, 1135, 'blaster']],
  cover: [
    {kind:'stone', x:442, y:956, w:92, h:64, hp:110, maxHp:110},
    {kind:'stone', x:2026, y:956, w:92, h:64, hp:110, maxHp:110},
    {kind:'pallet', x:1228, y:1286, w:104, h:34, hp:55, maxHp:55},
  ],
  spikes: [], hazards: ['colossus'],
  // This is a remote controller, not a breakable fixture in the play space.
  traps: [{type:'colossus', x:1280, y:1440, w:320, h:200, dir:1}],
};
