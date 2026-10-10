const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    passenger: { type: String, required: true },
    passengerPhone: { type: String, default: "Not set" }, // Added for easy contact
    driver: { type: String, required: true },
    status: { type: String, default: 'pending' }, // pending, accepted, rejected, cancelled
    cancelledBy: { type: String, default: "" },
    cancellationPenalty: { type: Number, default: 0 },
    
    // 📍 Coordinates for route planning and fare split (optional)
    pickupLat: { type: Number },
    pickupLon: { type: Number },
    dropoffLat: { type: Number },
    dropoffLon: { type: Number },
    womenOnly: { type: Boolean, default: false },
    passengerGender: { type: String, default: '' },

    // 🔗 Trip sharing link for family / friends
    shareToken: { type: String, default: '' },

    // 💰 Individual payment
    paymentStatus: { type: String, default: 'pending' }, // pending | paid
    paidAmount: { type: Number, default: 0 },

    // 📍 NEW: Specific Pickup Spot
    pickupPoint: { type: String, default: "Agreed Location" },
    
    rideDetails: {
        from: String,
        to: String,
        price: Number,
        date: String,
        time: String
    }
});

module.exports = mongoose.model('Request', requestSchema);