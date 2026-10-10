const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const User = require('../models/User');
const Ride = require('../models/Ride');
const Request = require('../models/Request');
const SafetyAlert = require('../models/SafetyAlert');
const transporter = require('../utils/email');
const { getDriverStatus, isDriverApproved } = require('../utils/driverStatus');
const { getRideGroup, toPassengers } = require('../utils/fareSplit');
const { solveVRPTW } = require('../utils/vrptw');

const GENDERS = ['female', 'male', 'other', 'prefer_not_to_say', ''];
const HELPLINES = { emergency: '112', womenHelpline: '1091' };

const digitsOnly = v => String(v || '').replace(/\D/g, '');
const isEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 1. GET safety profile (gender + emergency contacts)
router.get('/safety/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).lean();
        if (!user) return res.status(404).json({ success: false, error: "User not found" });
        res.json({
            success: true,
            gender: user.gender || '',
            emergencyContacts: user.emergencyContacts || []
        });
    } catch (err) { res.status(500).json({ success: false, error: "Could not load safety profile" }); }
});

// 2. POST safety profile: gender and up to 3 emergency contacts
router.post('/safety/profile', async (req, res) => {
    try {
        const { username, gender = '', emergencyContacts = [] } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, error: "User not found" });
        if (!GENDERS.includes(gender)) return res.status(400).json({ success: false, error: "Invalid gender option" });
        if (!Array.isArray(emergencyContacts) || emergencyContacts.length > 3) {
            return res.status(400).json({ success: false, error: "You can add up to 3 emergency contacts" });
        }

        const cleaned = [];
        for (const c of emergencyContacts) {
            const name = String(c.name || '').trim().slice(0, 60);
            const phone = digitsOnly(c.phone);
            const email = String(c.email || '').trim().slice(0, 120);
            if (!name && !phone && !email) continue;
            if (!name || phone.length < 10) {
                return res.status(400).json({ success: false, error: "Each emergency contact needs a name and a 10-digit phone number" });
            }
            if (!isEmail(email)) return res.status(400).json({ success: false, error: "Emergency contact email looks invalid" });
            cleaned.push({ name, phone, email });
        }

        user.gender = gender;
        user.emergencyContacts = cleaned;
        await user.save();
        res.json({ success: true, message: "Safety settings saved", gender: user.gender, emergencyContacts: user.emergencyContacts });
    } catch (err) { res.status(500).json({ success: false, error: "Could not save safety settings" }); }
});

// 3. POST create (or return existing) trip share link for an accepted booking
router.post('/requests/:id/share-link', async (req, res) => {
    try {
        const reqItem = await Request.findById(req.params.id);
        if (!reqItem) return res.status(404).json({ success: false, error: "Booking not found" });
        if (reqItem.passenger !== req.body.username) {
            return res.status(403).json({ success: false, error: "Only the passenger can share this trip" });
        }
        if (reqItem.status !== 'accepted') {
            return res.status(400).json({ success: false, error: "You can share the trip once the driver accepts" });
        }
        if (!reqItem.shareToken) {
            reqItem.shareToken = crypto.randomBytes(16).toString('hex');
            await reqItem.save();
        }
        res.json({ success: true, token: reqItem.shareToken, sharePath: `/share/${reqItem.shareToken}` });
    } catch (err) { res.status(500).json({ success: false, error: "Could not create share link" }); }
});

// 4. GET public trip view for family/friends (no phone numbers or emails)
router.get('/share/:token', async (req, res) => {
    try {
        const token = String(req.params.token || '');
        if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ success: false, error: "Trip not found" });

        const reqItem = await Request.findOne({ shareToken: token }).populate('rideId').lean();
        if (!reqItem || !reqItem.rideId) return res.status(404).json({ success: false, error: "Trip not found" });

        const ride = reqItem.rideId;
        const driver = await User.findOne({ username: ride.driverUsername || ride.driver }).lean();
        const first = (reqItem.passenger || '').split(' ')[0];

        res.json({
            success: true,
            trip: {
                passengerFirstName: first,
                bookingStatus: reqItem.status,
                rideStatus: ride.status,
                from: ride.from,
                to: ride.to,
                travelDate: ride.travelDate,
                travelTime: ride.travelTime,
                driverName: driver ? driver.fullName : ride.driverUsername,
                vehicleModel: ride.vehicleModel || (driver && driver.vehicle ? driver.vehicle.model : ''),
                vehicleType: ride.vehicleType || '',
                plateNumber: driver && driver.vehicle ? driver.vehicle.plateNumber : '',
                driverVerified: driver ? getDriverStatus(driver) === 'verified' : false,
                currentLat: ride.currentLat,
                currentLon: ride.currentLon,
                updatedAt: new Date()
            },
            helplines: HELPLINES
        });
    } catch (err) { res.status(500).json({ success: false, error: "Could not load trip" }); }
});

// 5. POST SOS: records an alert, emails the admin and any emergency contact with an email address
router.post('/safety/sos', async (req, res) => {
    try {
        const { username, requestId, lat, lon, message = '' } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, error: "User not found" });

        let reqItem = null;
        if (requestId) reqItem = await Request.findById(requestId).populate('rideId').lean();
        const ride = reqItem && reqItem.rideId ? reqItem.rideId : null;

        const location = (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon)))
            ? { lat: Number(lat), lon: Number(lon) }
            : undefined;

        const alert = await SafetyAlert.create({
            username,
            rideId: ride ? ride._id : undefined,
            requestId: reqItem ? reqItem._id : undefined,
            location,
            message: String(message).slice(0, 300)
        });

        const mapLink = location ? `https://maps.google.com/?q=${location.lat},${location.lon}` : 'Location not shared';
        const tripLine = ride ? `${escapeHtml(ride.from)} to ${escapeHtml(ride.to)} on ${escapeHtml(ride.travelDate)}` : 'No active trip linked';
        const body = `
            <div style="font-family:Arial,sans-serif;padding:16px;border:2px solid #dc2626;border-radius:10px;">
              <h2 style="color:#dc2626;">SOS alert from ${escapeHtml(user.fullName || username)}</h2>
              <p><strong>Trip:</strong> ${tripLine}</p>
              <p><strong>Location:</strong> ${escapeHtml(mapLink)}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ''}
              <p>If this is an emergency, call 112 (police/emergency) or 1091 (women's helpline).</p>
            </div>`;

        const recipients = [];
        if (process.env.ADMIN_EMAIL) recipients.push(process.env.ADMIN_EMAIL);
        (user.emergencyContacts || []).filter(c => c.email).forEach(c => recipients.push(c.email));

        let sent = 0;
        for (const to of recipients) {
            try {
                await transporter.sendMail({ from: process.env.SYSTEM_EMAIL, to, subject: `🚨 SOS alert: ${user.fullName || username}`, html: body });
                sent++;
            } catch (mailErr) {
                console.error("SOS email failed for", to, mailErr.message);
            }
        }

        res.json({
            success: true,
            alertId: alert._id,
            notified: sent,
            contactsWithoutEmail: (user.emergencyContacts || []).filter(c => !c.email).length,
            helplines: HELPLINES,
            message: "SOS recorded. Please also call 112 or 1091 if you are in danger."
        });
    } catch (err) {
        console.error("SOS error:", err);
        res.status(500).json({ success: false, error: "Could not send SOS. Please call 112 directly." });
    }
});

// 6. GET driver itinerary: ordered pickup and drop-off stops with estimated times for accepted bookings
router.get('/rides/:id/itinerary', async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id).lean();
        if (!ride) return res.status(404).json({ success: false, error: "Ride not found" });
        const accepted = await Request.find({ rideId: ride._id, status: 'accepted' }).lean();
        if (accepted.length === 0) return res.json({ success: true, stops: [], totalDistance: 0, message: "No accepted passengers yet" });

        const group = await getRideGroup(accepted[0], ride); // includes other accepted bookings
        const pax = toPassengers(accepted, ride).filter(p => p.usable);
        if (pax.length === 0) return res.json({ success: true, stops: [], totalDistance: 0, message: "No location data for these bookings" });

        const route = solveVRPTW(pax, null, 1.15, 4);
        if (!route.feasible) {
            return res.json({ success: false, error: "Current bookings cannot be routed within the detour limit", stops: [] });
        }
        res.json({
            success: true,
            totalDistance: route.totalDistance,
            stops: route.sequence,
            passengerStats: route.passengerStats,
            driverLocation: ride.currentLat != null ? { lat: ride.currentLat, lon: ride.currentLon } : null
        });
    } catch (err) {
        console.error("Itinerary error:", err);
        res.status(500).json({ success: false, error: "Could not load itinerary" });
    }
});

module.exports = router;
