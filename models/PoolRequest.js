const mongoose = require('mongoose');

// A commuter's request to share a ride. The dispatch worker pools waiting requests.
const poolRequestSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    passengerName: { type: String, default: '' },
    gender: { type: String, default: '' },
    womenOnly: { type: Boolean, default: false },
    pickup: { lat: Number, lon: Number, label: String },
    dropoff: { lat: Number, lon: Number, label: String },
    pickupWithinMinutes: { type: Number, default: 15 }, // pickup must happen within this time of departure
    // waiting -> pooled (in an open pool) -> matched (driver accepted) | cancelled | expired
    status: { type: String, enum: ['waiting', 'pooled', 'matched', 'cancelled', 'expired'], default: 'waiting', index: true },
    poolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pool', default: null },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PoolRequest', poolRequestSchema);
