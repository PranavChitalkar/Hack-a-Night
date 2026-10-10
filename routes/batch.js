const express = require('express');
const router = express.Router();
const { buildPoolPlan, formFeasiblePools, groupIntoWindows, DEFAULT_MAX_DETOUR } = require('../utils/poolPlanner');
const { calculateShapleyValues } = require('../utils/shapley');

// Never allow a detour bound looser than 15%
function parseDetour(value) {
    const d = parseFloat(value);
    if (!d || isNaN(d)) return DEFAULT_MAX_DETOUR;
    return Math.min(Math.max(d, 1.05), DEFAULT_MAX_DETOUR);
}

function validPassengers(list) {
    return Array.isArray(list) && list.length > 0 && list.every(p =>
        p && p.pickup && p.dropoff &&
        [p.pickup.lat, p.pickup.lon, p.dropoff.lat, p.dropoff.lon].every(v => typeof v === 'number' && !isNaN(v))
    );
}

/**
 * POST /api/batch/pool
 * Plans ONE pool: strict 15% detour VRPTW route plus Shapley fare split.
 */
router.post('/batch/pool', (req, res) => {
    try {
        const { passengers, ratePerKm } = req.body;
        if (!validPassengers(passengers)) {
            return res.status(400).json({ success: false, error: "Each passenger needs numeric pickup and dropoff coordinates (max 4 passengers per pool)." });
        }
        const plan = buildPoolPlan(passengers, {
            ratePerKm: parseFloat(ratePerKm) || 10,
            maxDetourRatio: parseDetour(req.body.maxDetourRatio)
        });
        res.json(plan);
    } catch (err) {
        console.error("Batch pool error:", err);
        res.status(500).json({ success: false, error: "Could not plan this pool." });
    }
});

/**
 * POST /api/batch/form
 * Groups pending requests into time windows, then forms feasible pools inside each window.
 */
router.post('/batch/form', (req, res) => {
    try {
        const { requests, windowSeconds, ratePerKm } = req.body;
        if (!validPassengers(requests)) {
            return res.status(400).json({ success: false, error: "Each request needs numeric pickup and dropoff coordinates." });
        }
        const maxDetourRatio = parseDetour(req.body.maxDetourRatio);
        const rate = parseFloat(ratePerKm) || 10;
        const prepared = requests.map((r, i) => ({ ...r, id: r.id || `r${i}`, timestamp: r.timestamp || 0 }));
        const windows = groupIntoWindows(prepared, parseInt(windowSeconds, 10) || 15);

        const result = windows.map(w => {
            const { pools, unpooled } = formFeasiblePools(w.requests, { maxDetourRatio });
            return {
                windowOpenedAt: w.openedAt,
                pools: pools.map(group => ({
                    passengerIds: group.map(p => p.id),
                    plan: buildPoolPlan(group, { ratePerKm: rate, maxDetourRatio })
                })),
                unpooled: unpooled.map(u => ({ passengerId: u.passenger.id, reason: u.reason }))
            };
        });
        res.json({ success: true, maxDetourRatio, windows: result });
    } catch (err) {
        console.error("Batch form error:", err);
        res.status(500).json({ success: false, error: "Could not form pools." });
    }
});

/**
 * POST /api/shapley/calculate
 * Standalone Shapley cost-sharing for a set of passengers.
 */
router.post('/shapley/calculate', (req, res) => {
    try {
        const { passengers, ratePerKm } = req.body;
        if (!validPassengers(passengers)) {
            return res.status(400).json({ success: false, error: "Passengers with coordinates required" });
        }
        res.json(calculateShapleyValues(passengers, parseFloat(ratePerKm) || 10, { maxDetourRatio: parseDetour(req.body.maxDetourRatio) }));
    } catch (err) {
        res.status(500).json({ success: false, error: "Shapley calculation failed." });
    }
});

module.exports = router;
