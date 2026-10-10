// File: routes/rides.js
const express = require('express');
const router = express.Router();

const Ride = require('../models/Ride');
const User = require('../models/User');
const Request = require('../models/Request');
const transporter = require('../utils/email');
const { isDriverApproved } = require('../utils/driverStatus');
const { quoteRide } = require('../utils/geo');

// 1. GET ALL RIDES
router.get('/rides', async (req, res) => {
    try {
        const rides = await Ride.find({ status: 'scheduled' }).lean();
        
        const driverUsernames = [...new Set(rides.map(r => r.driverUsername || r.driver))];
        const drivers = await User.find({ username: { $in: driverUsernames } }).lean();
        
        const driverMap = {};
        drivers.forEach(d => driverMap[d.username] = d);

        const enrichedRides = rides.map(ride => {
            const driver = driverMap[ride.driverUsername || ride.driver];
            return {
                ...ride,
                driverRating: driver ? driver.rating : 5.0,
                driverReviews: driver ? driver.reviewCount : 0
            };
        });
        res.json(enrichedRides);
    } catch (err) { res.status(500).json({ error: "Error fetching rides" }); }
});

// 2. SEARCH RIDES
router.get('/rides/search', async (req, res) => {
    try {
        const { to, query } = req.query; 
        const searchTerm = to || query;
        if (!searchTerm) {
            const rides = await Ride.find({ status: 'scheduled', seats: { $gt: 0 } }).lean();
            return res.json(rides);
        }

        const regex = new RegExp(searchTerm, 'i');
        const rides = await Ride.find({
            $or: [{ from: regex }, { to: regex }, { stops: { $in: [regex] } }],
            status: 'scheduled', 
            seats: { $gt: 0 }    
        }).lean();

        const driverUsernames = [...new Set(rides.map(r => r.driverUsername || r.driver))];
        const drivers = await User.find({ username: { $in: driverUsernames } }).lean();
        
        const driverMap = {};
        drivers.forEach(d => driverMap[d.username] = d);

        const enrichedRides = rides.map(ride => {
            const driver = driverMap[ride.driverUsername || ride.driver];
            return { ...ride, driverRating: driver ? driver.rating : 5.0, driverReviews: driver ? driver.reviewCount : 0 };
        });

        res.json(enrichedRides);
    } catch (err) { res.status(500).json({ error: "Search failed" }); }
});

// 3. EMERGENCY ROUTE MATCHING (Suggested Rides on Cancellation)
router.get('/rides/emergency-match', async (req, res) => {
    try {
        const { from, to, excludeId } = req.query;
        let queryFilter = {
            status: 'scheduled',
            seats: { $gt: 0 }
        };

        if (excludeId) {
            queryFilter._id = { $ne: excludeId };
        }

        let conditions = [];
        if (from) {
            const fromRegex = new RegExp(from, 'i');
            conditions.push({ from: fromRegex }, { stops: { $in: [fromRegex] } });
        }
        if (to) {
            const toRegex = new RegExp(to, 'i');
            conditions.push({ to: toRegex }, { stops: { $in: [toRegex] } });
        }

        if (conditions.length > 0) {
            queryFilter.$or = conditions;
        }

        const rides = await Ride.find(queryFilter).lean();
        const driverUsernames = [...new Set(rides.map(r => r.driverUsername || r.driver))];
        const drivers = await User.find({ username: { $in: driverUsernames } }).lean();
        const driverMap = {};
        drivers.forEach(d => driverMap[d.username] = d);

        const enriched = rides.map(ride => {
            const d = driverMap[ride.driverUsername || ride.driver];
            return {
                ...ride,
                driverRating: d ? d.rating : 5.0,
                driverReviews: d ? d.reviewCount : 0,
                vehicleModel: d ? d.vehicle?.model : ride.vehicleModel
            };
        });

        res.json({ success: true, count: enriched.length, emergencyRides: enriched });
    } catch (err) {
        console.error("Emergency match error:", err);
        res.status(500).json({ success: false, error: "Failed to find emergency replacement rides" });
    }
});

// 4. GET ACTIVE/SCHEDULED RIDE FOR A DRIVER
router.get('/rides/driver/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const ride = await Ride.findOne({
            $or: [{ driverUsername: username }, { driver: username }],
            status: { $in: ['scheduled', 'active'] }
        }).lean();

        if (!ride) {
            return res.json({ success: false, message: "No active ride found", ride: null });
        }

        const driverUser = await User.findOne({ username }).lean();
        const enrichedRide = {
            ...ride,
            driverRating: driverUser ? driverUser.rating : 5.0,
            driverReviews: driverUser ? driverUser.reviewCount : 0
        };

        res.json({ success: true, ride: enrichedRide });
    } catch (err) {
        res.status(500).json({ success: false, error: "Error fetching driver ride" });
    }
});

// 5. POST A NEW RIDE
const handlePostRide = async (req, res) => {
    try {
        const driverUsername = req.body.driverUsername || req.body.driver;
        const user = await User.findOne({ username: driverUsername }).lean();
        if (!user || !isDriverApproved(user)) {
            return res.status(403).json({ error: "⛔ Your driver license and vehicle must both be approved by an admin before you can post rides." });
        }

        // Distance and price come from the stored coordinates, never from the browser
        const quote = quoteRide(req.body);
        if (!quote.ok) return res.status(400).json({ success: false, error: quote.error });

        const payload = {
            ...req.body,
            fromLat: Number(req.body.fromLat), fromLon: Number(req.body.fromLon),
            toLat: Number(req.body.toLat), toLon: Number(req.body.toLon),
            distanceKm: quote.distanceKm,
            ratePerKm: quote.ratePerKm,
            price: quote.price, // server sets the price, never the browser
            driver: req.body.driver || driverUsername,
            driverUsername: driverUsername,
            womenOnly: !!req.body.womenOnly,
            vehicleType: req.body.vehicleType || user.vehicle.type || 'Car',
            vehicleModel: req.body.vehicleModel || user.vehicle.model || ''
        };

        const newRide = new Ride(payload);
        await newRide.save();
        res.status(201).json({ success: true, message: "Ride Posted", ride: newRide });
    } catch (err) { 
        console.error("Post ride error:", err);
        res.status(400).json({ success: false, error: "Error posting ride" }); 
    }
};

router.post('/rides', handlePostRide);
router.post('/rides/create', handlePostRide);

// 6. CANCEL RIDE BY DRIVER (WITH PENALTY & EMERGENCY MATCHING)
router.post('/rides/:id/cancel', async (req, res) => {
    try {
        const rideId = req.params.id;
        const ride = await Ride.findById(rideId);
        if (!ride) return res.status(404).json({ success: false, error: "Ride not found" });

        const driverUsername = req.body.driverUsername || ride.driverUsername || ride.driver;
        const penaltyAmount = 150;

        // 1. Update Ride Document
        ride.status = 'cancelled';
        ride.cancelledBy = driverUsername;
        ride.cancellationPenalty = penaltyAmount;
        await ride.save();

        // 2. Apply Driver Penalty & Rating Drop
        const driverUser = await User.findOne({ username: driverUsername });
        if (driverUser) {
            driverUser.penaltyBalance = (driverUser.penaltyBalance || 0) + penaltyAmount;
            driverUser.cancellationCount = (driverUser.cancellationCount || 0) + 1;
            const currentRating = driverUser.rating || 5.0;
            driverUser.rating = Math.max(1.0, parseFloat((currentRating - 0.2).toFixed(1)));
            await driverUser.save();
        }

        // 3. Cancel all passenger bookings/requests for this ride
        await Request.updateMany(
            { rideId: ride._id, status: { $in: ['pending', 'accepted'] } },
            { $set: { status: 'cancelled', cancelledBy: driverUsername, cancellationPenalty: 0 } }
        );

        // 4. Find Emergency Route Replacements for affected passengers
        const fromRegex = new RegExp(ride.from, 'i');
        const toRegex = new RegExp(ride.to, 'i');
        const emergencyRides = await Ride.find({
            _id: { $ne: ride._id },
            status: 'scheduled',
            seats: { $gt: 0 },
            $or: [
                { from: fromRegex },
                { to: toRegex },
                { stops: { $in: [fromRegex, toRegex] } }
            ]
        }).lean();

        res.json({
            success: true,
            message: `Trip cancelled. Penalty of ₹${penaltyAmount} applied to driver profile.`,
            penaltyAmount,
            ride,
            emergencyRides
        });
    } catch (err) {
        console.error("Cancel ride error:", err);
        res.status(500).json({ success: false, error: "Failed to cancel trip" });
    }
});

// 7. DELETE A RIDE
router.delete('/rides/:id', async (req, res) => {
    try {
        await Ride.findByIdAndDelete(req.params.id);
        res.json({ message: "Ride Deleted" });
    } catch (err) { res.status(500).json({ error: "Error deleting ride" }); }
});

// 8. UPDATE RIDE STATUS
router.post('/rides/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        let updateData = { status };
        if(status === 'started') updateData.startTime = new Date();
        await Ride.findByIdAndUpdate(req.params.id, updateData);
        res.json({ message: `Ride ${status}` });
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// 9. UPDATE LIVE LOCATION
router.post('/rides/:id/location', async (req, res) => {
    try {
        await Ride.findByIdAndUpdate(req.params.id, { currentLat: req.body.lat, currentLon: req.body.lon });
        res.json({ message: "Location updated" });
    } catch (err) { res.status(500).json({ error: "Error updating location" }); }
});

// 10. GET LIVE LOCATION
router.get('/rides/:id/location', async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id).lean();
        if(!ride) return res.status(404).json({ error: "Ride not found" });
        res.json({ lat: ride.currentLat, lon: ride.currentLon, status: ride.status });
    } catch (err) { res.status(500).json({ error: "Error fetching location" }); }
});

// 11. PAY FOR RIDE
router.post('/rides/:id/pay', async (req, res) => {
    console.log("💰 Payment Request Received:", req.body);
    try {
        const { userEmail, amount } = req.body; 
        const ride = await Ride.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid' }, { new: true });

        const mailOptions = {
            from: process.env.SYSTEM_EMAIL, 
            to: userEmail,
            subject: '🚖 Payment Receipt - SwiftWheels',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">Payment Successful!</h2>
                    <p>Hi there,</p>
                    <p>Thank you for riding with SwiftWheels. Here is your receipt.</p>
                    <table style="width: 100%; margin-top: 20px;">
                        <tr><td><strong>Amount Paid:</strong></td><td>₹${amount}</td></tr>
                        <tr><td><strong>Driver:</strong></td><td>${ride.driver || 'SwiftWheels Driver'}</td></tr>
                        <tr><td><strong>Date:</strong></td><td>${new Date().toDateString()}</td></tr>
                        <tr><td><strong>Status:</strong></td><td style="color:green; font-weight:bold;">PAID via UPI</td></tr>
                    </table>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) console.error("❌ Email Error:", err);
            else console.log("✅ Receipt sent:", info.response);
        });

        res.json({ message: "Payment Successful & Receipt Sent" });
    } catch (err) { 
        console.error("Payment Route Error:", err);
        res.status(500).json({ error: "Payment failed" }); 
    }
});

module.exports = router;