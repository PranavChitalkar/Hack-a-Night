/**
 * Per-passenger fare split for one ride.
 *
 * The group is the passenger's booking plus the other accepted bookings on the
 * same ride. Shapley shares are computed on the group's pickup/dropoff
 * coordinates and then scaled so that all shares add up exactly to the
 * ride's posted price. If coordinates are missing, the price is split equally.
 */

const Request = require('../models/Request');
const Ride = require('../models/Ride');
const { buildPoolPlan } = require('./poolPlanner');

function coordsOf(req, ride) {
    const pickup = (req.pickupLat != null && req.pickupLon != null)
        ? { lat: req.pickupLat, lon: req.pickupLon, label: req.pickupPoint || 'Pickup' }
        : { lat: ride.fromLat, lon: ride.fromLon, label: ride.from };
    const dropoff = (req.dropoffLat != null && req.dropoffLon != null)
        ? { lat: req.dropoffLat, lon: req.dropoffLon, label: 'Drop-off' }
        : { lat: ride.toLat, lon: ride.toLon, label: ride.to };
    return { pickup, dropoff };
}

function hasCoords(p) {
    return [p.pickup.lat, p.pickup.lon, p.dropoff.lat, p.dropoff.lon].every(v => typeof v === 'number' && !isNaN(v));
}

/**
 * Returns the group of bookings that share the ride with `req`.
 * The requested booking is always included, even while still pending.
 */
async function getRideGroup(req, ride) {
    const others = await Request.find({
        rideId: ride._id,
        status: 'accepted',
        _id: { $ne: req._id }
    }).lean();
    return [req, ...others];
}

/**
 * Computes the share of each booking in the group.
 * Returns { method: 'shapley' | 'equal', rideFare, shares: [{ requestId, passenger, share }], checks }.
 */
function toPassengers(group, ride) {
    return group.map(r => {
        const { pickup, dropoff } = coordsOf(r, ride);
        return {
            id: String(r._id),
            name: r.passenger,
            pickup,
            dropoff,
            gender: r.passengerGender || '',
            womenOnly: !!r.womenOnly,
            usable: hasCoords({ pickup, dropoff })
        };
    });
}

function splitFare(group, ride) {
    const rideFare = Number(ride.price) || 0;
    const passengers = toPassengers(group, ride);

    const equal = () => {
        const base = Math.floor((rideFare / group.length) * 100) / 100;
        const shares = group.map(r => ({ requestId: String(r._id), passenger: r.passenger, share: base }));
        const remainder = Math.round((rideFare - base * group.length) * 100) / 100;
        shares[shares.length - 1].share = Math.round((shares[shares.length - 1].share + remainder) * 100) / 100;
        return { method: 'equal', rideFare, shares, checks: null };
    };

    if (group.length === 1) {
        return { method: 'shapley', rideFare, shares: [{ requestId: String(group[0]._id), passenger: group[0].passenger, share: rideFare }], checks: null };
    }
    if (!passengers.every(p => p.usable)) return equal();

    // Shapley proportions do not depend on the rate, so use 1 ₹/km
    const plan = buildPoolPlan(passengers, { ratePerKm: 1 });
    if (!plan.success) return equal();

    const total = plan.shapley.totalPooledFare;
    if (!(total > 0)) return equal();

    const raw = plan.shapley.allocations.map(a => ({
        requestId: a.passengerId,
        passenger: a.passengerName,
        share: Math.round((rideFare * a.shapleyFare / total) * 100) / 100
    }));
    // Put any rounding difference on the largest share so the total is exact
    const sum = raw.reduce((s, r) => s + r.share, 0);
    const diff = Math.round((rideFare - sum) * 100) / 100;
    if (diff !== 0) {
        const biggest = raw.reduce((a, b) => (b.share > a.share ? b : a));
        biggest.share = Math.round((biggest.share + diff) * 100) / 100;
    }

    return { method: 'shapley', rideFare, shares: raw, checks: plan.shapley.checks };
}

async function computeFareShares(requestDoc) {
    const ride = await Ride.findById(requestDoc.rideId).lean();
    if (!ride) return null;
    const group = await getRideGroup(requestDoc, ride);
    const result = splitFare(group, ride);
    const mine = result.shares.find(s => s.requestId === String(requestDoc._id));
    return { ...result, groupSize: group.length, myShare: mine ? mine.share : null };
}

module.exports = { computeFareShares, splitFare, coordsOf, getRideGroup, toPassengers, hasCoords };
