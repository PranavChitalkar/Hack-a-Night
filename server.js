require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// 1. Import our custom utilities and routes
const transporter = require('./utils/email'); 
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const requestRoutes = require('./routes/requests'); // 🆕 Added
const adminRoutes = require('./routes/admin');      // 🆕 Added
const driverRoutes = require('./routes/driver');    // 🪪 PaddleOCR Driver Verification
const batchRoutes = require('./routes/batch');      // 🧮 VRPTW & Shapley Batch Engine
const poolRoutes = require('./routes/pools');        // 🔁 Shared-ride requests and pools
const { startDispatchWorker } = require('./utils/dispatchWorker');
const safetyRoutes = require('./routes/safety');    // 🛡️ Safety: SOS, contacts, trip sharing

const User = require('./models/User');
const Ride = require('./models/Ride');

const app = express();
app.use(express.static('public')); 
app.use(express.json());

// ==========================
// 🗄️ DATABASE SETUP
// ==========================
mongoose.connect(process.env.MONGO_URI)
  .then(() => { console.log("🚀 Success: Connected to MongoDB!"); startDispatchWorker(); })
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ==========================
// 🏠 VIEWS / FRONTEND
// ==========================
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/public/admin.html')); 

// ==========================
// 🔗 ROUTER MIDDLEWARE (The MVC Magic)
// ==========================
app.use('/api', authRoutes); 
app.use('/api', rideRoutes);
app.use('/api', requestRoutes); 
app.use('/api', adminRoutes);   
app.use('/api', driverRoutes);   
app.use('/api', batchRoutes);   
app.use('/api', safetyRoutes);
app.use('/api', poolRoutes);

// Serve uploaded license documents statically
app.use('/uploads', express.static(__dirname + '/public/uploads'));

// SPA Catch-all route for React routing
app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
    }
    if (req.method === 'GET') {
        return res.sendFile(__dirname + '/public/index.html');
    }
    next();
});   

// ==========================
// 👤 USER PROFILE & MISC ROUTES (Left here for simplicity)
// ==========================
app.post('/api/user/update', async (req, res) => {
    try {
        const user = await User.findOneAndUpdate({ username: req.body.username }, { phone: req.body.phone }, { new: true }).lean();
        res.json({ message: "Profile Updated", user });
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

app.get('/api/user/me/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).lean();
        if(!user) return res.status(404).json({ error: "User not found" });
        res.json({ user });
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/api/user/vehicle', async (req, res) => {
    try {
        const { username, model, plateNumber, type } = req.body; 
        const user = await User.findOneAndUpdate(
            { username }, { vehicle: { model, plateNumber, type, status: 'pending', reviewNote: '', isVerified: false } }, { new: true }
        ).lean();
        res.json({ message: "Vehicle details submitted for admin review.", user });
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

app.post('/api/user/rate', async (req, res) => {
    try {
        const { username, stars } = req.body; 
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: "User not found" });

        const newCount = user.reviewCount + 1;
        const newRating = ((user.rating * user.reviewCount) + stars) / newCount;

        user.rating = newRating.toFixed(1); 
        user.reviewCount = newCount;
        await user.save();
        res.json({ message: "Rating submitted!", newRating: user.rating });
    } catch (err) { res.status(500).json({ error: "Error rating user" }); }
});

app.post('/api/user/phone/send-otp', async (req, res) => {
    try {
        const { username, phone } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await User.findOneAndUpdate({ username }, { phone, phoneOtp: otp });
        console.log(`\n📱 SMS FOR ${phone}: ${otp}\n`);
        res.json({ message: "OTP sent to phone!" });
    } catch (err) { res.status(500).json({ error: "Error sending OTP" }); }
});

app.post('/api/user/phone/verify-otp', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (user && user.phoneOtp === req.body.otp) {
            user.isPhoneVerified = true; user.phoneOtp = undefined; 
            await user.save();
            res.json({ message: "Phone Verified!", user });
        } else {
            res.status(400).json({ error: "Invalid OTP" });
        }
    } catch (err) { res.status(500).json({ error: "Verification failed" }); }
});

// 📱 MOBILE CONFIRMATION PAGE
app.get('/pay-confirm/:id', async (req, res) => {
    try {
        await Ride.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid' });
        res.send(`<div style="text-align:center; padding-top:50px; font-family:sans-serif;">
                    <h1 style="color:green; font-size:50px;">✔</h1><h2>Payment Successful!</h2>
                  </div>`);
    } catch (err) { res.send("Error processing payment"); }
});

// 📩 CONTACT / FEEDBACK ROUTE
/*
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: "Please fill all fields" });

        await transporter.sendMail({
            from: process.env.SYSTEM_EMAIL, to: process.env.ADMIN_EMAIL, replyTo: email,
            subject: `📢 New Feedback from ${name}`,
            html: `<p><strong>From:</strong> ${name} (${email})</p><p>${message}</p>`
        });
        res.json({ message: "Feedback sent successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to send message" }); }
});
*/
// 📩 CONTACT / FEEDBACK ROUTE
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: "Please fill all fields" });

        await transporter.sendMail({
            from: `"SwiftWheels System" <${process.env.EMAIL_USER}>`, // Must be your authenticated email
            to: process.env.ADMIN_EMAIL, 
            replyTo: email, // This allows you to click 'Reply' in your inbox to email the user back
            subject: `📢 New Feedback from ${name}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h3>New Feedback Received</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>User Email:</strong> ${email}</p>
                    <hr>
                    <p><strong>Message:</strong></p>
                    <p>${message}</p>
                </div>
            `
        });
        res.json({ message: "Feedback sent successfully!" });

    } catch (error) {
        // This is what happens on Render
        console.log("------------------------------------------");
        console.log("📢 NEW FEEDBACK (RENDER LOG BYPASS)");
        console.log(`From: ${req.body.name} (${req.body.email})`);
        console.log(`Message: ${req.body.message}`);
        console.log("------------------------------------------");

        res.json({ 
            message: "Feedback received! (Demo Mode: Logged to Console)",
            isDemo: true 
        });
    }
});
app.listen(process.env.PORT, () => console.log(`🚀 Server running at http://localhost:${process.env.PORT}`));