// Verifies the VRPTW solver and Shapley split against an independent brute-force checker.
const assert = require('assert');
const { solveVRPTW, calculateHaversineDistance: hav } = require('../utils/vrptw');
const { calculateShapleyValues } = require('../utils/shapley');
const { formFeasiblePools, buildPoolPlan } = require('../utils/poolPlanner');

// Deterministic PRNG so failures are reproducible
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pt = () => ({ lat: 19.90 + rnd() * 0.12, lon: 73.78 + rnd() * 0.12 });

function randomPassengers(n) {
    return Array.from({ length: n }, (_, i) => {
        const a = pt(), b = pt();
        return { id: 'p' + i, name: 'P' + i, pickup: { ...a, label: 'a' + i }, dropoff: { ...b, label: 'b' + i } };
    });
}

// Brute force: try every permutation of stops, keep the cheapest valid one.
function bruteForce(ps, maxRatio) {
    const N = ps.length;
    const nodes = [];
    ps.forEach((p, i) => nodes.push({ t: 'p', i, ...p.pickup }));
    ps.forEach((p, i) => nodes.push({ t: 'd', i, ...p.dropoff }));
    const solo = ps.map(p => hav(p.pickup.lat, p.pickup.lon, p.dropoff.lat, p.dropoff.lon));
    let best = Infinity;
    const used = new Array(2 * N).fill(false);
    const seq = [];
    function rec() {
        if (seq.length === 2 * N) {
            // evaluate
            const picked = new Array(N).fill(false), done = new Array(N).fill(false);
            const onboard = new Array(N).fill(0);
            let cur = null, total = 0, load = 0;
            for (const k of seq) {
                const nd = nodes[k];
                const d = cur ? hav(cur.lat, cur.lon, nd.lat, nd.lon) : 0;
                total += d;
                for (let j = 0; j < N; j++) if (picked[j] && !done[j]) onboard[j] += d;
                if (nd.t === 'p') { if (picked[nd.i]) return; picked[nd.i] = true; load++; if (load > 4) return; }
                else { if (!picked[nd.i] || done[nd.i]) return; done[nd.i] = true; load--; }
                cur = nd;
            }
            for (let j = 0; j < N; j++) if (solo[j] >= 0.05 && onboard[j] > maxRatio * solo[j] + 1e-9) return;
            if (total < best) best = total;
            return;
        }
        for (let k = 0; k < 2 * N; k++) {
            if (used[k]) continue;
            used[k] = true; seq.push(k); rec(); seq.pop(); used[k] = false;
        }
    }
    rec();
    return best;
}

let checked = 0, infeasibleAgree = 0;
for (let trial = 0; trial < 300; trial++) {
    const n = 1 + (trial % 3); // pools of 1..3 passengers (brute force stays cheap)
    const ps = randomPassengers(n);
    const got = solveVRPTW(ps, null, 1.15, 4);
    const expected = bruteForce(ps, 1.15);

    if (expected === Infinity) {
        assert.strictEqual(got.feasible, false, `trial ${trial}: solver should be infeasible`);
        infeasibleAgree++;
        continue;
    }
    assert.strictEqual(got.feasible, true, `trial ${trial}: solver should be feasible`);
    assert.ok(Math.abs(got.totalDistance - expected) < 0.02,
        `trial ${trial}: optimum mismatch solver=${got.totalDistance} brute=${expected}`);
    // every passenger obeys the 15% bound in the returned route
    got.passengerStats.forEach(s => {
        if (s.soloDistance >= 0.05) assert.ok(s.detourPercentage <= 15.01, `trial ${trial}: detour ${s.detourPercentage}%`);
    });
    checked++;
}
console.log(`VRPTW matches brute force on ${checked} feasible pools; ${infeasibleAgree} infeasible cases agreed.`);

// Shapley: efficiency and individual rationality on random feasible pools
let shapleyChecked = 0;
for (let trial = 0; trial < 150; trial++) {
    const n = 2 + (trial % 3); // 2..4 passengers
    const ps = randomPassengers(n);
    const plan = calculateShapleyValues(ps, 10);
    if (!plan.success) continue;
    const sum = plan.allocations.reduce((s, a) => s + a.shapleyFare, 0);
    assert.ok(Math.abs(sum - plan.totalPooledFare) < 0.05, `trial ${trial}: efficiency sum=${sum} total=${plan.totalPooledFare}`);
    plan.allocations.forEach(a => assert.ok(a.shapleyFare <= a.soloFare + 0.02, `trial ${trial}: rationality violated`));
    shapleyChecked++;
}
console.log(`Shapley efficiency and rationality hold on ${shapleyChecked} pools.`);

// Batching: every formed pool is feasible under the bound
for (let trial = 0; trial < 50; trial++) {
    const ps = randomPassengers(8).map((p, i) => ({ ...p, timestamp: i }));
    const { pools, unpooled } = formFeasiblePools(ps, { maxDetourRatio: 1.15 });
    assert.strictEqual(pools.flat().length + unpooled.length, ps.length, 'no passenger lost');
    pools.forEach(pool => {
        if (pool.length > 1) {
            const r = solveVRPTW(pool, null, 1.15, 4);
            assert.ok(r.feasible, 'formed pool must be feasible');
        }
        assert.ok(pool.length <= 4, 'pool size cap');
    });
}
console.log('Batching: all formed pools are feasible and no passenger is lost.');

// Women-only pools never mix genders
const mixed = randomPassengers(4).map((p, i) => ({ ...p, gender: i % 2 ? 'male' : 'female', womenOnly: i === 0 }));
const { pools } = formFeasiblePools(mixed, { maxDetourRatio: 1.15 });
pools.forEach(pool => {
    if (pool.some(p => p.womenOnly)) assert.ok(pool.every(p => p.gender === 'female'), 'women-only pool mixed genders');
});
console.log('Women-only pools contain only female passengers.');

// Full plan end to end
const planRes = buildPoolPlan(randomPassengers(3), { ratePerKm: 10 });
console.log('Plan feasible:', planRes.feasible, '| efficiency holds:', planRes.shapley && planRes.shapley.checks.efficiencyHolds);
console.log('ALL TESTS PASSED');
