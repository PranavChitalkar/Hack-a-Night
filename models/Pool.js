const mongoose = require('mongoose');

// A proposed group of commuters whose routes stay within the 15% detour bound.
const poolSchema = new mongoose.Schema({
    members: [{
        requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PoolRequest' },
        username: String,
        passengerName: String
    }],
    plan: { type: mongoose.Schema.Types.Mixed }, // route + Shapley split, computed by the planner
    seatsNeeded: { type: Number, required: true },
    // open -> accepted (driver took it) | expired (not taken in time or a member left)
    status: { type: String, enum: ['open', 'accepted', 'expired'], default: 'open', index: true },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
});

module.exports = mongoose.model('Pool', poolSchema);
