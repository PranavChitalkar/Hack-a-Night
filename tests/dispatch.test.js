// Checks the pure pooling step used by the background worker.
const assert = require('assert');
const { proposePools } = require('../utils/dispatchWorker');
const { solveVRPTW } = require('../utils/vrptw');

let seed = 999;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pt = () => ({ lat: 19.90 + rnd() * 0.12, lon: 73.78 + rnd() * 0.12 });

for (let trial = 0; trial < 40; trial++) {
    const n = 6 + (trial % 5);
    const waiting = Array.from({ length: n }, (_, i) => ({
        id: 'r' + i, name: 'C' + i,
        gender: i % 3 === 0 ? 'female' : 'male',
        womenOnly: i === 0 && trial % 2 === 0,
        timestamp: i * 1000,
        pickup: { ...pt(), label: 'P' + i, window: { earliest: 0, latest: 15 } },
        dropoff: { ...pt(), label: 'D' + i }
    }));
    const proposals = proposePools(waiting);
    const used = new Set();
    for (const p of proposals) {
        assert.ok(p.memberIds.length >= 2 && p.memberIds.length <= 4, 'pool size 2..4');
        for (const id of p.memberIds) {
            assert.ok(!used.has(id), 'a request is in at most one pool');
            used.add(id);
        }
        // every member rides within the 15% bound and their pickup window
        const members = p.memberIds.map(id => waiting.find(w => w.id === id));
        const route = solveVRPTW(members, null, 1.15, 4);
        assert.ok(route.feasible, 'proposed pool must be feasible');
        route.passengerStats.forEach(s => {
            if (s.soloDistance >= 0.05) assert.ok(s.detourPercentage <= 15.01, `detour ${s.detourPercentage}%`);
        });
        // women-only: if any member asked for it, everyone is female
        if (members.some(m => m.womenOnly)) assert.ok(members.every(m => m.gender === 'female'), 'women-only mix');
        // fare split adds up to the pooled fare
        const sum = p.plan.shapley.allocations.reduce((s, a) => s + a.shapleyFare, 0);
        assert.ok(Math.abs(sum - p.plan.shapley.totalPooledFare) < 0.05, 'fares add up');
    }
}
console.log('Dispatch pooling: 40 random waiting lists produced only valid pools.');
console.log('DISPATCH TESTS PASSED');
