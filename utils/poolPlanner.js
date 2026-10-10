/**
 * Pool planning: forms feasible ride pools from pending requests and computes
 * the full plan (route + fair fare split) for one pool.
 *
 * Batching: requests are grouped into fixed-length time windows. A window
 * opens on its first request and collects requests for `windowSeconds`.
 * Inside each window, requests are added greedily to the first existing pool
 * where the pool remains feasible under the 15% detour bound, the time
 * windows, the capacity limit and women-only compatibility.
 */

const { solveVRPTW, MAX_POOL_SIZE } = require('./vrptw');
const { calculateShapleyValues } = require('./shapley');

const DEFAULT_MAX_DETOUR = 1.15;

function isFemale(p) {
    return p.gender === 'female';
}

// If either passenger asks for a women-only pool, every member must be female.
function womenOnlyCompatible(a, b) {
    if (a.womenOnly || b.womenOnly) return isFemale(a) && isFemale(b);
    return true;
}

/**
 * Greedy feasible pooling of a list of passengers (already in arrival order).
 * Returns { pools: [[passenger,...],...], unpooled: [passenger,...] }
 */
function formFeasiblePools(passengers, { maxDetourRatio = DEFAULT_MAX_DETOUR, maxSize = MAX_POOL_SIZE } = {}) {
    const pools = [];
    const unpooled = [];

    for (const p of passengers) {
        // A passenger who cannot travel alone within their own window is unpooled
        const solo = solveVRPTW([p], null, maxDetourRatio, maxSize);
        if (!solo.feasible) {
            unpooled.push({ passenger: p, reason: solo.error });
            continue;
        }

        let placed = false;
        for (const pool of pools) {
            if (pool.length >= maxSize) continue;
            if (!pool.every(m => womenOnlyCompatible(m, p))) continue;

            const candidate = pool.concat([p]);
            const route = solveVRPTW(candidate, null, maxDetourRatio, maxSize);
            if (route.feasible) {
                pool.push(p);
                placed = true;
                break;
            }
        }
        if (!placed) pools.push([p]);
    }

    return { pools, unpooled };
}

/**
 * Splits requests into fixed-length time windows based on their timestamp.
 * Each request must have a numeric `timestamp` (ms). Requests without one are
 * treated as arriving at the same instant.
 */
function groupIntoWindows(passengers, windowSeconds = 15) {
    const windowMs = windowSeconds * 1000;
    const sorted = passengers.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const windows = [];
    let current = null;
    for (const p of sorted) {
        const ts = p.timestamp || 0;
        if (!current || ts - current.openedAt >= windowMs) {
            current = { openedAt: ts, requests: [] };
            windows.push(current);
        }
        current.requests.push(p);
    }
    return windows;
}

/**
 * Full plan for one pool: strict VRPTW route plus Shapley fare split.
 * Returns { success, feasible, vrptw, shapley, error? }.
 */
function buildPoolPlan(passengers, { ratePerKm = 10, maxDetourRatio = DEFAULT_MAX_DETOUR } = {}) {
    if (!passengers || passengers.length === 0) {
        return { success: false, feasible: false, error: "Please provide at least one passenger." };
    }
    if (passengers.length > MAX_POOL_SIZE) {
        return { success: false, feasible: false, error: `A pool can hold at most ${MAX_POOL_SIZE} passengers.` };
    }

    const shapley = calculateShapleyValues(passengers, ratePerKm, { maxDetourRatio });
    if (!shapley.success) {
        return { success: false, feasible: false, error: shapley.error, shapley };
    }

    const route = solveVRPTW(passengers, null, maxDetourRatio, MAX_POOL_SIZE);
    if (!route.feasible) {
        return { success: false, feasible: false, error: route.error, vrptw: route, shapley };
    }

    return {
        success: true,
        feasible: true,
        message: `Pool planned: every passenger within the ${Math.round((maxDetourRatio - 1) * 100)}% detour limit.`,
        passengerCount: passengers.length,
        vrptw: route,
        shapley
    };
}

module.exports = {
    formFeasiblePools,
    groupIntoWindows,
    buildPoolPlan,
    womenOnlyCompatible,
    DEFAULT_MAX_DETOUR
};
