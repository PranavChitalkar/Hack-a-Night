/**
 * Asynchronous dispatch worker.
 *
 * Every TICK_MS it:
 *  1. Expires commuter requests that waited longer than REQUEST_TTL_MS.
 *  2. Expires open pools that no driver took within POOL_TTL_MS. Their members
 *     go back to waiting so they can be pooled again.
 *  3. Takes all waiting requests (a sliding window: anything still waiting is
 *     reconsidered on every tick), forms feasible pools under the 15% detour
 *     bound and time windows, and stores each pool with its route and fare split.
 */

const mongoose = require('mongoose');
const PoolRequest = require('../models/PoolRequest');
const Pool = require('../models/Pool');
const { formFeasiblePools, buildPoolPlan, DEFAULT_MAX_DETOUR } = require('./poolPlanner');
const { DEFAULT_RATE_PER_KM } = require('./geo');

const TICK_MS = 15000;
const REQUEST_TTL_MS = 30 * 60 * 1000;
const POOL_TTL_MS = 10 * 60 * 1000;
const MAX_WAITING = 200;

// Converts a stored request into the shape the planner expects
function toPassenger(doc) {
    return {
        id: String(doc._id),
        name: doc.passengerName || doc.username,
        gender: doc.gender || '',
        womenOnly: !!doc.womenOnly,
        timestamp: new Date(doc.createdAt).getTime(),
        pickup: {
            lat: doc.pickup.lat, lon: doc.pickup.lon, label: doc.pickup.label,
            window: { earliest: 0, latest: doc.pickupWithinMinutes }
        },
        dropoff: { lat: doc.dropoff.lat, lon: doc.dropoff.lon, label: doc.dropoff.label }
    };
}

/**
 * Pure planning step (no database). Returns proposed pools, each with
 * member ids and a full plan. Only pools that pass every check are returned.
 */
function proposePools(passengers, { ratePerKm = DEFAULT_RATE_PER_KM, maxDetourRatio = DEFAULT_MAX_DETOUR } = {}) {
    const { pools } = formFeasiblePools(passengers, { maxDetourRatio });
    const proposals = [];
    for (const group of pools) {
        if (group.length < 2) continue;
        const plan = buildPoolPlan(group, { ratePerKm, maxDetourRatio });
        if (plan.success) proposals.push({ memberIds: group.map(p => p.id), plan });
    }
    return proposals;
}

async function releaseExpiredPools(now) {
    const expired = await Pool.find({ status: 'open', expiresAt: { $lt: new Date(now) } }, '_id').lean();
    if (expired.length === 0) return 0;
    const ids = expired.map(p => p._id);
    await Pool.updateMany({ _id: { $in: ids } }, { $set: { status: 'expired' } });
    await PoolRequest.updateMany({ poolId: { $in: ids }, status: 'pooled' }, { $set: { status: 'waiting', poolId: null } });
    return ids.length;
}

async function runDispatchTick(now = Date.now()) {
    await PoolRequest.updateMany(
        { status: 'waiting', createdAt: { $lt: new Date(now - REQUEST_TTL_MS) } },
        { $set: { status: 'expired' } }
    );
    const released = await releaseExpiredPools(now);

    const waiting = await PoolRequest.find({ status: 'waiting' }).sort({ createdAt: 1 }).limit(MAX_WAITING).lean();
    if (waiting.length < 2) return { waiting: waiting.length, released, proposed: 0 };

    const proposals = proposePools(waiting.map(toPassenger));
    for (const p of proposals) {
        const members = p.memberIds.map(id => waiting.find(w => String(w._id) === id));
        const pool = await Pool.create({
            members: members.map(m => ({ requestId: m._id, username: m.username, passengerName: m.passengerName || m.username })),
            plan: p.plan,
            seatsNeeded: members.length,
            expiresAt: new Date(now + POOL_TTL_MS)
        });
        await PoolRequest.updateMany(
            { _id: { $in: p.memberIds.map(id => new mongoose.Types.ObjectId(id)) } },
            { $set: { status: 'pooled', poolId: pool._id } }
        );
    }
    return { waiting: waiting.length, released, proposed: proposals.length };
}

let timer = null;
function startDispatchWorker() {
    if (timer) return;
    timer = setInterval(() => {
        if (mongoose.connection.readyState !== 1) return; // wait for the database
        runDispatchTick().catch(err => console.error('Dispatch tick error:', err.message));
    }, TICK_MS);
    console.log(`🔁 Dispatch worker running every ${TICK_MS / 1000}s`);
}

module.exports = { proposePools, toPassenger, runDispatchTick, startDispatchWorker, REQUEST_TTL_MS, POOL_TTL_MS };
