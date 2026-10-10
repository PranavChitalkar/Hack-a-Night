const mongoose = require('mongoose');

// Records every SOS press so admins can follow up.
const safetyAlertSchema = new mongoose.Schema({
    username: { type: String, required: true },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    type: { type: String, enum: ['sos'], default: 'sos' },
    location: { lat: Number, lon: Number },
    message: { type: String, default: '' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SafetyAlert', safetyAlertSchema);
