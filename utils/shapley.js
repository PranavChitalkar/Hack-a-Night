/**
 * Cooperative game theory: Shapley value cost sharing.
 *
 * Game: players are passengers. The characteristic function v(S) is the cost
 * of serving coalition S with one vehicle.
 *   - v({i})   : solo cost of passenger i
 *   - v(S), |S|>=2 : minimum route cost ignoring the detour bound (sub-coalition cost)
 *   - v(N)     : minimum route cost for the full pool, WITH the 15% detour bound
 *                and time windows enforced. This is the only constrained value.
 *
 * Shapley value:  phi_i = sum over S ⊆ N\{i} of  |S|!(|N|-|S|-1)!/|N|!  * [v(S∪{i}) − v(S)]
 *
 * Properties checked after computing (returned under `checks`):
 *   - Efficiency:            sum_i phi_i = v(N)          (the full pooled cost is fully allocated)
 *   - Individual rationality: phi_i <= v({i})           (nobody pays more than riding alone)
 */

const { solveVRPTW, calculateHaversineDistance } = require('./vrptw');

function factorial(n) {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function getSubsets(array) {
    return array.reduce(
        (subsets, value) => subsets.concat(subsets.map(set => [value, ...set])),
        [[]]
    );
}

function round2(x) {
    return Math.round(x * 100) / 100;
}

/**
 * @param {Array} passengers - [{ id, name, pickup:{lat,lon,label,window?}, dropoff:{lat,lon,label,window?} }]
 * @param {Number} ratePerKm - ₹ per km (default 10)
 * @param {Object} options - { maxDetourRatio }  (default 1.15, never looser than 1.15)
 */
function calculateShapleyValues(passengers, ratePerKm = 10, options = {}) {
    if (!passengers || passengers.length === 0) {
        return { success: false, feasible: false, error: "No passengers for Shapley calculation" };
    }

    const maxDetourRatio = Math.min(options.maxDetourRatio || 1.15, 1.15);
    const N = passengers.length;
    const ids = passengers.map(p => String(p.id));

    // Characteristic function, keyed by sorted comma-joined ids
    const keyOf = subset => subset.map(p => String(p.id)).sort().join(',');
    const v = {};
    const subsets = getSubsets(passengers).filter(s => s.length > 0);

    for (const subset of subsets) {
        const key = keyOf(subset);
        if (subset.length === 1) {
            const p = subset[0];
            v[key] = calculateHaversineDistance(p.pickup.lat, p.pickup.lon, p.dropoff.lat, p.dropoff.lon) * ratePerKm;
        } else if (subset.length === N) {
            // Full pool: constrained by the detour bound and time windows
            const grand = solveVRPTW(subset, null, maxDetourRatio, 4);
            if (!grand.feasible) {
                return { success: false, feasible: false, error: grand.error, maxDetourRatio };
            }
            v[key] = grand.totalDistance * ratePerKm;
        } else {
            // Sub-coalition: unconstrained optimal cost (see header comment)
            const sub = solveVRPTW(subset, null, 1.15, 4, { enforceDetour: false, enforceWindows: false });
            v[key] = sub.totalDistance * ratePerKm;
        }
    }

    const grandKey = ids.slice().sort().join(',');
    // Pooling never costs more than everyone riding alone; otherwise passengers pay solo fares.
    const soloSum = passengers.reduce((sum, p) => sum + v[keyOf([p])], 0);
    const rawPooledFare = v[grandKey];
    const totalPooledFare = Math.min(rawPooledFare, soloSum);
    const poolingWorthIt = rawPooledFare <= soloSum + 1e-9;

    // Shapley values
    const phi = {};
    const avgMarginal = {};
    for (const p of passengers) {
        const pid = String(p.id);
        const others = passengers.filter(o => String(o.id) !== pid);
        const otherSubsets = getSubsets(others);
        let value = 0;
        let sumMarginal = 0;
        for (const S of otherSubsets) {
            const s = S.length;
            const weight = (factorial(s) * factorial(N - s - 1)) / factorial(N);
            const vS = S.length ? v[keyOf(S)] : 0;
            const vSi = v[keyOf(S.concat([p]))];
            value += weight * (vSi - vS);
            sumMarginal += vSi - vS;
        }
        phi[pid] = value;
        avgMarginal[pid] = sumMarginal / otherSubsets.length;
    }

    // Clipping: no one pays more than their solo fare. Any excess is moved to
    // the other passengers in proportion to their shares, so the total is unchanged.
    const soloOf = {};
    passengers.forEach(p => { soloOf[String(p.id)] = v[keyOf([p])]; });
    // Water-filling: find one shift d so that share_i = min(solo_i, max(0, phi_i + d))
    // and the shares sum exactly to totalPooledFare. Keeps everyone at or below
    // their solo fare while preserving the Shapley ordering as far as possible.
    const rawSum = ids.reduce((s, id) => s + phi[id], 0);
    const needsFix = ids.some(id => phi[id] > soloOf[id] + 1e-9) || Math.abs(rawSum - totalPooledFare) > 1e-9;
    let clipped = false;
    if (needsFix) {
        clipped = ids.some(id => phi[id] > soloOf[id] + 1e-9);
        const target = totalPooledFare;
        const f = d => ids.reduce((s, id) => s + Math.min(soloOf[id], Math.max(0, phi[id] + d)), 0);
        if (ids.reduce((s, id) => s + soloOf[id], 0) <= target + 1e-9) {
            ids.forEach(id => { phi[id] = soloOf[id]; });
        } else {
            let lo = -1e6, hi = 1e6;
            for (let it = 0; it < 200; it++) {
                const mid = (lo + hi) / 2;
                if (f(mid) < target) lo = mid; else hi = mid;
            }
            ids.forEach(id => { phi[id] = Math.min(soloOf[id], Math.max(0, phi[id] + hi)); });
        }
    }
    const totalSoloFare = soloSum;
    const totalSavings = Math.max(0, totalSoloFare - totalPooledFare);
    const savingsPercentage = totalSoloFare > 0 ? round2((totalSavings / totalSoloFare) * 100) : 0;

    const allocations = passengers.map(p => {
        const pid = String(p.id);
        const solo = v[keyOf([p])];
        const shapley = phi[pid];
        const savingsAmount = Math.max(0, solo - shapley);
        return {
            passengerId: p.id,
            passengerName: p.name,
            soloFare: round2(solo),
            shapleyFare: round2(shapley),
            marginalContribution: round2(avgMarginal[pid]),
            savingsAmount: round2(savingsAmount),
            savingsPct: solo > 0 ? round2((savingsAmount / solo) * 100) : 0,
            individuallyRational: shapley <= solo + 1e-6
        };
    });

    const sumPhi = Object.values(phi).reduce((a, b) => a + b, 0);
    const checks = {
        efficiencyError: round2(Math.abs(sumPhi - totalPooledFare)),
        efficiencyHolds: Math.abs(sumPhi - totalPooledFare) < 0.05,
        individuallyRational: allocations.every(a => a.individuallyRational),
        clipped,
        poolingWorthIt
    };

    return {
        success: true,
        feasible: true,
        maxDetourRatio,
        totalPooledFare: round2(totalPooledFare),
        totalSoloFare: round2(totalSoloFare),
        totalSavings: round2(totalSavings),
        savingsPercentage,
        allocations,
        checks
    };
}

module.exports = { calculateShapleyValues };
