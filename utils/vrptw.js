/**
 * Vehicle Routing Problem with Time Windows (VRPTW) with a strict detour bound.
 *
 * Constraints enforced by the search:
 *  1. Precedence: pickup(i) happens before dropoff(i).
 *  2. Capacity: onboard passengers never exceed vehicleCapacity.
 *  3. Detour bound: pooled distance(i) <= maxDetourRatio * solo distance(i)
 *     for every passenger (default 1.15, i.e. 15%). Checked during the search
 *     so infeasible branches are cut as soon as they violate the bound.
 *  4. Time windows (optional): each stop may have { earliest, latest } in
 *     minutes from departure. The vehicle waits if it arrives early and
 *     rejects the branch if it arrives after `latest`.
 *
 * Search: depth-first branch and bound. Exact for the pool sizes used here
 * (at most MAX_POOL_SIZE passengers, i.e. 8 stops).
 *
 * Options:
 *  - enforceDetour (default true): when false, the detour bound is ignored.
 *    Used for sub-coalition costs in the Shapley computation.
 *  - enforceWindows (default true): when false, time windows are ignored.
 *  - speedKmh (default 25): average speed used to convert distance to time.
 */

const MAX_POOL_SIZE = 4;
const MIN_SOLO_KM = 0.05; // below 50 m the detour percentage is meaningless

const { haversineKm } = require('./geo');

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    return haversineKm(lat1, lon1, lat2, lon2);
}

function round2(x) {
    return Math.round(x * 100) / 100;
}

/**
 * @param {Array} passengers - [{ id, name, pickup:{lat,lon,label,window?}, dropoff:{lat,lon,label,window?} }]
 * @param {Object|null} vehicleOrigin - { lat, lon } or null to start at the first stop
 * @param {Number} maxDetourRatio - e.g. 1.15
 * @param {Number} vehicleCapacity - max onboard passengers
 * @param {Object} options - { enforceDetour, enforceWindows, speedKmh }
 */
function solveVRPTW(passengers, vehicleOrigin = null, maxDetourRatio = 1.15, vehicleCapacity = 4, options = {}) {
    const enforceDetour = options.enforceDetour !== false;
    const enforceWindows = options.enforceWindows !== false;
    const speedKmh = options.speedKmh || 25;

    if (!passengers || passengers.length === 0) {
        return { success: false, feasible: false, error: "No passengers provided for routing" };
    }
    if (passengers.length > MAX_POOL_SIZE) {
        return { success: false, feasible: false, error: `A pool can hold at most ${MAX_POOL_SIZE} passengers` };
    }

    const bound = Math.min(Math.max(maxDetourRatio || 1.15, 1), 1.15); // never looser than 15%
    const N = passengers.length;

    const solo = passengers.map(p =>
        calculateHaversineDistance(p.pickup.lat, p.pickup.lon, p.dropoff.lat, p.dropoff.lon)
    );

    // Nodes: 0..N-1 pickups, N..2N-1 dropoffs
    const nodes = [];
    passengers.forEach((p, i) => nodes.push({
        idx: i, type: 'pickup', p: i, passengerId: p.id, passengerName: p.name,
        lat: p.pickup.lat, lon: p.pickup.lon, label: p.pickup.label,
        earliest: enforceWindows && p.pickup.window ? p.pickup.window.earliest || 0 : 0,
        latest: enforceWindows && p.pickup.window && p.pickup.window.latest != null ? p.pickup.window.latest : Infinity
    }));
    passengers.forEach((p, i) => nodes.push({
        idx: N + i, type: 'dropoff', p: i, passengerId: p.id, passengerName: p.name,
        lat: p.dropoff.lat, lon: p.dropoff.lon, label: p.dropoff.label,
        earliest: 0,
        latest: enforceWindows && p.dropoff.window && p.dropoff.window.latest != null ? p.dropoff.window.latest : Infinity
    }));

    const picked = new Array(N).fill(false);
    const done = new Array(N).fill(false);
    const onboardDist = new Array(N).fill(0);
    const order = [];
    let best = null;

    function detourOk(i) {
        if (!enforceDetour || solo[i] < MIN_SOLO_KM) return true;
        return onboardDist[i] <= bound * solo[i] + 1e-9;
    }

    function dfs(curLat, curLon, time, total, load, remaining) {
        if (best && total >= best.total - 1e-9) return; // bound
        if (remaining === 0) {
            best = { total, order: order.slice() };
            return;
        }

        for (let k = 0; k < 2 * N; k++) {
            const node = nodes[k];
            const i = node.p;
            if (node.type === 'pickup') {
                if (picked[i] || load >= vehicleCapacity) continue;
            } else {
                if (!picked[i] || done[i]) continue;
            }

            const d = curLat === null ? 0 : calculateHaversineDistance(curLat, curLon, node.lat, node.lon);
            const arrival = time + (d / speedKmh) * 60;
            if (arrival > node.latest + 1e-9) continue;
            const startTime = Math.max(arrival, node.earliest);

            // Save state, then apply this leg
            const savedOnboard = onboardDist.slice();
            const savedPicked = picked.slice();
            const savedDone = done.slice();

            for (let j = 0; j < N; j++) {
                if (picked[j] && !done[j]) onboardDist[j] += d;
            }

            let ok = true;
            for (let j = 0; j < N && ok; j++) {
                if (picked[j] && !done[j] && !detourOk(j)) ok = false;
            }

            if (ok) {
                if (node.type === 'pickup') {
                    picked[i] = true;
                    onboardDist[i] = 0;
                } else {
                    done[i] = true;
                }
                order.push(k);
                dfs(node.lat, node.lon, startTime, total + d,
                    load + (node.type === 'pickup' ? 1 : -1), remaining - 1);
                order.pop();
            }

            // Restore
            for (let j = 0; j < N; j++) {
                onboardDist[j] = savedOnboard[j];
                picked[j] = savedPicked[j];
                done[j] = savedDone[j];
            }
        }
    }

    dfs(vehicleOrigin ? vehicleOrigin.lat : null, vehicleOrigin ? vehicleOrigin.lon : null, 0, 0, 0, 2 * N);

    if (!best) {
        return {
            success: false,
            feasible: false,
            error: enforceDetour
                ? `No route keeps every passenger within the ${Math.round((bound - 1) * 100)}% detour limit and their time windows.`
                : "No route satisfies the time windows.",
            maxDetourRatio: bound
        };
    }

    return { ...simulateOrder(best.order), success: true, feasible: true, maxDetourRatio: bound };

    // Recompute the route details for the chosen order (used for output and checks)
    function simulateOrder(seqIdx) {
        const pooled = new Array(N).fill(0);
        const active = new Array(N).fill(false);
        const finished = new Array(N).fill(false);
        let cur = vehicleOrigin ? { lat: vehicleOrigin.lat, lon: vehicleOrigin.lon } : null;
        let t = 0;
        let total = 0;
        const sequence = [];

        seqIdx.forEach(k => {
            const node = nodes[k];
            const d = cur ? calculateHaversineDistance(cur.lat, cur.lon, node.lat, node.lon) : 0;
            total += d;
            for (let j = 0; j < N; j++) if (active[j]) pooled[j] += d;
            const arrival = t + (d / speedKmh) * 60;
            const stopTime = Math.max(arrival, node.earliest);
            t = stopTime;
            cur = { lat: node.lat, lon: node.lon };

            if (node.type === 'pickup') active[node.p] = true;
            else { active[node.p] = false; finished[node.p] = true; }

            sequence.push({
                type: node.type,
                passengerId: node.passengerId,
                passengerName: node.passengerName,
                label: node.label,
                lat: node.lat,
                lon: node.lon,
                etaMinutes: round2(stopTime)
            });
        });

        const passengerStats = passengers.map((p, i) => {
            const soloKm = round2(solo[i]);
            const pooledKm = round2(pooled[i]);
            const detourPct = soloKm > 0 ? round2(((pooled[i] - solo[i]) / solo[i]) * 100) : 0;
            return {
                passengerId: p.id,
                passengerName: p.name,
                soloDistance: soloKm,
                pooledDistance: pooledKm,
                detourPercentage: Math.max(0, detourPct),
                withinBound: !enforceDetour || solo[i] < MIN_SOLO_KM || pooled[i] <= bound * solo[i] + 1e-6
            };
        });

        return {
            totalDistance: round2(total),
            sequence,
            passengerStats
        };
    }
}

module.exports = {
    calculateHaversineDistance,
    solveVRPTW,
    MAX_POOL_SIZE
};
