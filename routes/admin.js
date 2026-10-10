// File: routes/admin.js
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Ride = require('../models/Ride');
const Request = require('../models/Request');
const SafetyAlert = require('../models/SafetyAlert');
const { getDriverStatus } = require('../utils/driverStatus');

// 🛑 THE BOUNCER (Middleware)
// This function runs BEFORE any of the admin routes below.
const verifyAdmin = async (req, res, next) => {
    try {
        // We will make the frontend send the username in the headers
        const username = req.headers['x-admin-username']; 
        
        if (!username) {
            return res.status(401).json({ error: "Access Denied: Who are you?" });
        }

        const user = await User.findOne({ username });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: "Access Denied: Admins Only!" });
        }

        next(); // ID checks out. Let them into the club!
    } catch (err) {
        res.status(500).json({ error: "Server Error during authentication" });
    }
};

// Apply the Bouncer to all routes in this file
// Notice how we put `verifyAdmin` in the middle!

// Approve the driver: license and vehicle must both be submitted, then both are approved together.
const approveDriver = async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) return res.status(404).json({ error: "User not found" });
        if (!user.driverLicense || !(user.driverLicense.licenseNumber || user.driverLicense.documentPath)) {
            return res.status(400).json({ error: "The driving license has not been submitted yet." });
        }
        if (!user.vehicle || !user.vehicle.model) {
            return res.status(400).json({ error: "The vehicle has not been submitted yet." });
        }
        user.driverLicense.status = 'verified';
        user.driverLicense.isVerified = true;
        user.driverLicense.verifiedAt = new Date();
        user.driverLicense.reviewNote = '';
        user.vehicle.status = 'verified';
        user.vehicle.isVerified = true;
        user.vehicle.reviewNote = '';
        await user.save();
        res.json({ message: "Driver approved: license and vehicle verified.", status: getDriverStatus(user) });
    } catch (err) { res.status(500).json({ error: "Error approving driver" }); }
};

// Reject the license, the vehicle, or both, with a reason the driver can see.
const rejectDriver = async (req, res) => {
    try {
        const { username, reason = '', scope = 'both' } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: "User not found" });
        const note = String(reason).slice(0, 300) || 'Please check your details and resubmit.';
        if (scope === 'license' || scope === 'both') {
            user.driverLicense.status = 'rejected';
            user.driverLicense.isVerified = false;
            user.driverLicense.reviewNote = note;
        }
        if (scope === 'vehicle' || scope === 'both') {
            user.vehicle.status = 'rejected';
            user.vehicle.isVerified = false;
            user.vehicle.reviewNote = note;
        }
        await user.save();
        res.json({ message: "Driver application rejected.", status: getDriverStatus(user) });
    } catch (err) { res.status(500).json({ error: "Error rejecting driver" }); }
};

router.post('/admin/approve-driver', verifyAdmin, approveDriver);
router.post('/admin/reject-driver', verifyAdmin, rejectDriver);
// Legacy routes use the same logic
router.post('/admin/verify-vehicle', verifyAdmin, approveDriver);
router.post('/admin/reject-vehicle', verifyAdmin, (req, res) => { req.body.scope = 'vehicle'; return rejectDriver(req, res); });

// Safety alerts (SOS presses) for admin follow-up
router.get('/admin/safety-alerts', verifyAdmin, async (req, res) => {
    try {
        const alerts = await SafetyAlert.find().sort({ createdAt: -1 }).limit(100).lean();
        res.json({ success: true, alerts });
    } catch (err) { res.status(500).json({ error: "Could not load safety alerts" }); }
});

router.post('/admin/safety-alerts/:id/resolve', verifyAdmin, async (req, res) => {
    try {
        await SafetyAlert.findByIdAndUpdate(req.params.id, { status: 'resolved' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Could not update alert" }); }
});

router.get('/admin/stats', verifyAdmin, async (req, res) => {
    try {
        const [userCount, rideCount, reqCount] = await Promise.all([
            User.countDocuments(), Ride.countDocuments(), Request.countDocuments()
        ]);
        res.json({ userCount, rideCount, reqCount });
    } catch (err) { res.status(500).json({ error: "Stats error" }); }
});

router.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({ username: { $ne: null, $exists: true, $regex: /.+/ } }, '-password -otp').lean();
        res.json(users);
    } catch (err) { res.status(500).json({ error: "Fetch error" }); }
});

router.delete('/admin/users/:id', verifyAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        // Only remove rides belonging to the banned user (previously wiped ALL rides)
        await Ride.deleteMany({ driverUsername: user.username });
        res.json({ message: "User Banned" });
    } catch (err) { res.status(500).json({ error: "Delete error" }); }
});

module.exports = router;