// File: routes/requests.js
const express = require('express');
const router = express.Router();

const Request = require('../models/Request');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { solveVRPTW } = require('../utils/vrptw');
const { getRideGroup, toPassengers } = require('../utils/fareSplit');
const { computeFareShares } = require('../utils/fareSplit');

// 1. CREATE BOOKING REQUEST (Support both /requests and /requests/create)
const handleCreateRequest = async (req, res) => {
    try {
        const passenger = req.body.passengerUsername || req.body.passenger;
        const { rideId, pickupSpot, pickupPoint } = req.body;

        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, error: "Ride not found" });
        if (ride.seats <= 0) return res.status(400).json({ success: false, error: "Ride is fully booked" });

        const userObj = await User.findOne({ username: passenger }).lean();
        const passengerPhone = userObj ? userObj.phone : "Not set";
        const passengerGender = userObj ? (userObj.gender || '') : '';

        // Women-only rides: only female passengers may book
        if (ride.womenOnly && passengerGender !== 'female') {
            return res.status(403).json({ success: false, error: "This is a women-only ride. Set your gender to female in Safety settings to book it." });
        }

        const rideDetails = req.body.rideDetails || {
            from: ride.from,
            to: ride.to,
            price: ride.price,
            date: ride.travelDate,
            time: ride.travelTime
        };

        const num = v => (v === undefined || v === null || v === '' || isNaN(Number(v))) ? undefined : Number(v);
        const newReq = new Request({
            rideId,
            passenger,
            driver: ride.driverUsername || ride.driver,
            rideDetails,
            passengerPhone,
            passengerGender,
            womenOnly: !!ride.womenOnly,
            pickupLat: num(req.body.pickupLat),
            pickupLon: num(req.body.pickupLon),
            dropoffLat: ride.toLat,
            dropoffLon: ride.toLon,
            pickupPoint: pickupSpot || pickupPoint || "Agreed Pickup Location"
        });

        await newReq.save();
        res.status(201).json({ success: true, message: "Request Sent", request: newReq });
    } catch (err) {
        console.error("Create request error:", err);
        res.status(400).json({ success: false, error: "Error creating booking request" });
    }
};

router.post('/requests', handleCreateRequest);
router.post('/requests/create', handleCreateRequest);

// 2. GET REQUESTS FOR DRIVER
router.get('/requests/driver/:username', async (req, res) => {
    try {
        const requests = await Request.find({ driver: req.params.username }).populate('rideId').lean();
        res.json({ success: true, requests });
    } catch (err) { res.status(500).json({ success: false, error: "Fetch failed" }); }
});

// 3. GET REQUESTS FOR PASSENGER
router.get('/requests/passenger/:username', async (req, res) => {
    try {
        const all = await Request.find({ passenger: req.params.username, status: { $ne: 'cancelled' } }).populate('rideId').lean();
        const requests = all.filter(r => r.rideId && !['cancelled', 'completed'].includes(r.rideId.status));
        res.json({ success: true, requests });
    } catch (err) { res.status(500).json({ success: false, error: "Fetch failed" }); }
});

// 4. GET REQUESTS FOR A SPECIFIC RIDE
router.get('/requests/ride/:rideId', async (req, res) => {
    try {
        const requests = await Request.find({ rideId: req.params.rideId }).lean();
        res.json({ success: true, requests });
    } catch (err) { res.status(500).json({ success: false, error: "Fetch failed" }); }
});

// 5. UPDATE REQUEST STATUS BY DRIVER (Accept / Reject)
const handleStatusUpdate = async (req, res) => {
    try {
        const id = req.params.id;
        const action = req.params.action || req.body.status;
        const reqItem = await Request.findById(id);
        if (!reqItem) return res.status(404).json({ success: false, error: "Request not found" });

        if (action === 'reject' || action === 'rejected') {
            reqItem.status = 'rejected';
            await reqItem.save();
            return res.json({ success: true, message: "Rejected" });
        }

        if (action === 'accept' || action === 'accepted') {
            const ride = await Ride.findById(reqItem.rideId);
            if (!ride || ride.seats <= 0) return res.status(400).json({ success: false, error: "Ride is full" });

            // Detour gate: accepting this passenger must keep every co-passenger within 15%
            // and within their time windows. Otherwise the booking is refused.
            const group = await getRideGroup(reqItem, ride);
            if (group.length > 1) {
                const pax = toPassengers(group, ride);
                if (pax.every(p => p.usable)) {
                    const route = solveVRPTW(pax, null, 1.15, 4);
                    if (!route.feasible) {
                        return res.status(409).json({
                            success: false,
                            error: "Accepting this passenger would push a co-passenger past the 15% detour limit. Decline this request or accept it on a different ride."
                        });
                    }
                }
            }

            const dUser = await User.findOne({ username: reqItem.driver }).lean();
            ride.seats -= 1;
            await ride.save();

            reqItem.status = 'accepted';
            reqItem.driverPhone = dUser ? dUser.phone : "Not set";
            await reqItem.save();
            return res.json({ success: true, message: "Accepted" });
        }

        res.status(400).json({ success: false, error: "Invalid action" });
    } catch (err) { res.status(500).json({ success: false, error: "Action failed" }); }
};

// 6. CANCEL PASSENGER REQUEST (WITH PENALTY & EMERGENCY MATCHING)
router.post('/requests/:id/cancel', async (req, res) => {
    try {
        const reqItem = await Request.findById(req.params.id).populate('rideId');
        if (!reqItem) return res.status(404).json({ success: false, error: "Booking request not found" });

        const passengerUsername = req.body.passengerUsername || req.body.passenger || reqItem.passenger;
        let penaltyAmount = 0;

        // If booking was already accepted by driver, charge passenger ₹50 cancellation penalty & restore seat
        if (reqItem.status === 'accepted') {
            penaltyAmount = 50;
            if (reqItem.rideId) {
                const ride = await Ride.findById(reqItem.rideId._id || reqItem.rideId);
                if (ride) {
                    ride.seats += 1;
                    await ride.save();
                }
            }

            const passengerUser = await User.findOne({ username: passengerUsername });
            if (passengerUser) {
                passengerUser.penaltyBalance = (passengerUser.penaltyBalance || 0) + penaltyAmount;
                passengerUser.cancellationCount = (passengerUser.cancellationCount || 0) + 1;
                await passengerUser.save();
            }
        }

        reqItem.status = 'cancelled';
        reqItem.cancelledBy = passengerUsername;
        reqItem.cancellationPenalty = penaltyAmount;
        await reqItem.save();

        // Find Emergency Alternative Rides for Passenger
        const rideFrom = reqItem.rideDetails?.from || reqItem.rideId?.from;
        const rideTo = reqItem.rideDetails?.to || reqItem.rideId?.to;

        let emergencyRides = [];
        if (rideFrom || rideTo) {
            const fromRegex = new RegExp(rideFrom || '', 'i');
            const toRegex = new RegExp(rideTo || '', 'i');

            emergencyRides = await Ride.find({
                status: 'scheduled',
                seats: { $gt: 0 },
                _id: { $ne: reqItem.rideId?._id },
                $or: [
                    { from: fromRegex },
                    { to: toRegex },
                    { stops: { $in: [fromRegex, toRegex] } }
                ]
            }).lean();

            const driverUsernames = [...new Set(emergencyRides.map(r => r.driverUsername || r.driver))];
            const drivers = await User.find({ username: { $in: driverUsernames } }).lean();
            const driverMap = {};
            drivers.forEach(d => driverMap[d.username] = d);

            emergencyRides = emergencyRides.map(r => ({
                ...r,
                driverRating: driverMap[r.driverUsername || r.driver]?.rating || 5.0
            }));
        }

        res.json({
            success: true,
            message: penaltyAmount > 0 
                ? `Booking cancelled. Penalty of ₹${penaltyAmount} charged for cancelling an accepted trip.`
                : `Booking request cancelled.`,
            penaltyAmount,
            request: reqItem,
            emergencyRides
        });
    } catch (err) {
        console.error("Cancel request error:", err);
        res.status(500).json({ success: false, error: "Error cancelling request" });
    }
});

// 7. FARE SHARE FOR ONE PASSENGER (Shapley-based, scaled to the ride price)
// Co-passenger names are not returned, only this passenger's share.
router.get('/requests/:id/fare-share', async (req, res) => {
    try {
        const reqItem = await Request.findById(req.params.id).lean();
        if (!reqItem) return res.status(404).json({ success: false, error: "Booking not found" });
        const share = await computeFareShares(reqItem);
        if (!share) return res.status(404).json({ success: false, error: "Ride not found" });
        res.json({
            success: true,
            method: share.method,
            rideFare: share.rideFare,
            groupSize: share.groupSize,
            myShare: share.myShare,
            checks: share.checks
        });
    } catch (err) {
        console.error("Fare share error:", err);
        res.status(500).json({ success: false, error: "Could not calculate your share" });
    }
});

// 8. PAY YOUR OWN SHARE (per passenger, not per ride)
router.post('/requests/:id/pay', async (req, res) => {
    try {
        const reqItem = await Request.findById(req.params.id);
        if (!reqItem) return res.status(404).json({ success: false, error: "Booking not found" });
        if (reqItem.status !== 'accepted') {
            return res.status(400).json({ success: false, error: "You can pay once the driver accepts your booking." });
        }
        const share = await computeFareShares(reqItem.toObject());
        if (!share || share.myShare == null) return res.status(400).json({ success: false, error: "Could not calculate your share" });

        reqItem.paymentStatus = 'paid';
        reqItem.paidAmount = share.myShare;
        await reqItem.save();
        res.json({ success: true, message: "Payment recorded for your share", paidAmount: share.myShare });
    } catch (err) {
        console.error("Pay share error:", err);
        res.status(500).json({ success: false, error: "Payment failed" });
    }
});

// Generic accept / reject route is registered last so it cannot swallow other actions
const handleStatusRoutes = handleStatusUpdate;
router.post('/requests/:id/:action', handleStatusRoutes);
router.patch('/requests/:id/status', handleStatusRoutes);

module.exports = router;
