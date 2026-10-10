const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Ride = require('../models/Ride');
const Request = require('../models/Request');
const Pool = require('../models/Pool');
const PoolRequest = require('../models/PoolRequest');
const { isDriverApproved } = require('../utils/driverStatus');
const { isValidIndiaCoord, DEFAULT_RATE_PER_KM } = require('../utils/geo');
const { runDispatchTick, POOL_TTL_MS } = require('../utils/dispatchWorker');

const WITHIN_OPTIONS = [5, 10, 15, 20, 30];

function placeOk(p) {
    return p && isValidIndiaCoord(Number(p.lat), Number(p.lon)) && typeof p.label === 'string' && p.label.trim().length > 0;
}

// 1. Commuter asks for a shared ride
router.post('/pool-requests', async (req, res) => {
    try {
        const { username, pickup, dropoff } = req.body;
        const within = Number(req.body.pickupWithinMinutes) || 15;
        const user = await User.findOne({ username }).lean();
        if (!user) return res.status(404).json({ success: false, error: "Please log in again." });
        if (!placeOk(pickup) || !placeOk(dropoff)) {
            return res.status(400).json({ success: false, error: "Pick valid pickup and drop-off places from the suggestions." });
        }
        if (Math.abs(Number(pickup.lat) - Number(dropoff.lat)) < 0.001 && Math.abs(Number(pickup.lon) - Number(dropoff.lon)) < 0.001) {
            return res.status(400).json({ success: false, error: "Pickup and drop-off are the same place." });
        }
        if (!WITHIN_OPTIONS.includes(within)) {
            return res.status(400).json({ success: false, error: "Choose a pickup time window of 5 to 30 minutes." });
        }
        if (req.body.womenOnly && user.gender !== 'female') {
            return res.status(403).json({ success: false, error: "Women-only pools need your gender set to female in Safety settings." });
        }
        const active = await PoolRequest.findOne({ username, status: { $in: ['waiting', 'pooled'] } }).lean();
        if (active) return res.status(409).json({ success: false, error: "You already have an active shared-ride request." });

        const doc = await PoolRequest.create({
            username,
            passengerName: user.fullName,
            gender: user.gender || '',
            womenOnly: !!req.body.womenOnly,
            pickup: { lat: Number(pickup.lat), lon: Number(pickup.lon), label: pickup.label.trim() },
            dropoff: { lat: Number(dropoff.lat), lon: Number(dropoff.lon), label: dropoff.label.trim() },
            pickupWithinMinutes: within
        });
        res.status(201).json({ success: true, request: doc });
    } catch (err) {
        console.error("Pool request error:", err);
        res.status(500).json({ success: false, error: "Could not create your request." });
    }
});

// 2. Commuter sees their request and its status
router.get('/pool-requests/mine/:username', async (req, res) => {
    try {
        const requests = await PoolRequest.find({ username: req.params.username }).sort({ createdAt: -1 }).limit(10).lean();
        res.json({ success: true, requests });
    } catch (err) { res.status(500).json({ success: false, error: "Could not load requests" }); }
});

// 3. Commuter cancels; if already pooled, the pool is dissolved and others go back to waiting
router.post('/pool-requests/:id/cancel', async (req, res) => {
    try {
        const doc = await PoolRequest.findById(req.params.id);
        if (!doc || doc.username !== req.body.username) return res.status(404).json({ success: false, error: "Request not found" });
        if (doc.status === 'matched') return res.status(400).json({ success: false, error: "Your ride is confirmed. Cancel it from My Trips." });

        if (doc.status === 'pooled' && doc.poolId) {
            const pool = await Pool.findById(doc.poolId);
            if (pool && pool.status === 'open') {
                pool.status = 'expired';
                await pool.save();
                await PoolRequest.updateMany({ poolId: pool._id, status: 'pooled' }, { $set: { status: 'waiting', poolId: null } });
            }
        }
        doc.status = 'cancelled';
        doc.poolId = null;
        await doc.save();
        res.json({ success: true, message: "Shared-ride request cancelled" });
    } catch (err) { res.status(500).json({ success: false, error: "Could not cancel" }); }
});

// 4. Driver sees open pools they have seats for
router.get('/pools/open', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.query.username }).lean();
        if (!user || !isDriverApproved(user)) {
            return res.status(403).json({ success: false, error: "Only approved drivers can see open pools." });
        }
        const seatsAvailable = user.vehicle && user.vehicle.type === 'Bike' ? 1 : 4;
        const pools = await Pool.find({ status: 'open', expiresAt: { $gt: new Date() }, seatsNeeded: { $lte: seatsAvailable } })
            .sort({ createdAt: -1 }).limit(20).lean();
        res.json({
            success: true,
            seatsAvailable,
            pools: pools.map(p => ({
                _id: p._id,
                seatsNeeded: p.seatsNeeded,
                passengers: p.members.map(m => m.passengerName),
                stops: p.plan && p.plan.vrptw ? p.plan.vrptw.sequence : [],
                totalDistance: p.plan && p.plan.vrptw ? p.plan.vrptw.totalDistance : 0,
                fareTotal: p.plan && p.plan.shapley ? p.plan.shapley.totalPooledFare : 0,
                expiresAt: p.expiresAt
            }))
        });
    } catch (err) { res.status(500).json({ success: false, error: "Could not load pools" }); }
});

// 5. Driver accepts a pool: creates the ride and one accepted booking per commuter
router.post('/pools/:id/accept', async (req, res) => {
    try {
        const driver = await User.findOne({ username: req.body.username }).lean();
        if (!driver || !isDriverApproved(driver)) {
            return res.status(403).json({ success: false, error: "Your license and vehicle must be approved before you can accept pools." });
        }
        const pool = await Pool.findById(req.params.id);
        if (!pool || pool.status !== 'open' || pool.expiresAt < new Date()) {
            return res.status(400).json({ success: false, error: "This pool is no longer available." });
        }

        const vehicleSeats = driver.vehicle && driver.vehicle.type === 'Bike' ? 1 : 4;
        if (pool.seatsNeeded > vehicleSeats) {
            return res.status(400).json({ success: false, error: `Your vehicle has ${vehicleSeats} seat(s); this pool needs ${pool.seatsNeeded}.` });
        }

        // Every member must still be waiting in this pool
        const memberIds = pool.members.map(m => m.requestId);
        const members = await PoolRequest.find({ _id: { $in: memberIds }, status: 'pooled', poolId: pool._id }).lean();
        if (members.length !== memberIds.length) {
            pool.status = 'expired';
            await pool.save();
            await PoolRequest.updateMany({ poolId: pool._id, status: 'pooled' }, { $set: { status: 'waiting', poolId: null } });
            return res.status(409).json({ success: false, error: "A commuter left this pool. Please look at the pools again." });
        }

        const stops = pool.plan.vrptw.sequence;
        const pickupOf = {};
        members.forEach(m => { pickupOf[String(m._id)] = m; });
        const first = stops[0];
        const last = stops[stops.length - 1];
        const now = new Date();
        const travelDate = now.toISOString().slice(0, 10);
        const travelTime = now.toTimeString().slice(0, 5);

        const ride = await Ride.create({
            driver: driver.username,
            driverUsername: driver.username,
            from: first.label,
            to: last.label,
            fromLat: first.lat, fromLon: first.lon,
            toLat: last.lat, toLon: last.lon,
            distanceKm: pool.plan.vrptw.totalDistance,
            ratePerKm: DEFAULT_RATE_PER_KM,
            price: Math.round(pool.plan.shapley.totalPooledFare),
            seats: Math.max(0, vehicleSeats - pool.seatsNeeded),
            travelDate,
            travelTime,
            vehicleType: driver.vehicle.type,
            vehicleModel: driver.vehicle.model,
            womenOnly: members.some(m => m.womenOnly),
            status: 'scheduled'
        });

        const passengerUsers = await User.find({ username: { $in: members.map(m => m.username) } }).lean();
        const phoneOf = {};
        passengerUsers.forEach(u => { phoneOf[u.username] = u.phone; });

        // One accepted booking per commuter, with their own pickup and drop-off
        await Request.insertMany(members.map(m => ({
            rideId: ride._id,
            passenger: m.username,
            passengerPhone: phoneOf[m.username] || 'Not set',
            passengerGender: m.gender || '',
            driver: driver.username,
            status: 'accepted',
            womenOnly: !!m.womenOnly,
            pickupLat: m.pickup.lat, pickupLon: m.pickup.lon,
            dropoffLat: m.dropoff.lat, dropoffLon: m.dropoff.lon,
            pickupPoint: m.pickup.label,
            rideDetails: { from: m.pickup.label, to: m.dropoff.label, price: 0, date: travelDate, time: travelTime }
        })));

        await PoolRequest.updateMany({ _id: { $in: memberIds } }, { $set: { status: 'matched', rideId: ride._id } });
        pool.status = 'accepted';
        pool.rideId = ride._id;
        await pool.save();

        res.status(201).json({ success: true, message: "Pool accepted. Commuters have been booked.", rideId: ride._id });
    } catch (err) {
        console.error("Accept pool error:", err);
        res.status(500).json({ success: false, error: "Could not accept this pool" });
    }
});

// 6. Run one dispatch tick now (used by the dashboard's "Refresh" and by demos)
router.post('/pools/tick', async (req, res) => {
    try {
        const result = await runDispatchTick();
        res.json({ success: true, ...result });
    } catch (err) { res.status(500).json({ success: false, error: "Dispatch run failed" }); }
});

module.exports = router;
