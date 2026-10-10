const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    
    // 🛡️ AUTH
    gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say', ''], default: '' },
    emergencyContacts: [{
        name: { type: String, default: '' },
        phone: { type: String, default: '' },
        email: { type: String, default: '' }
    }],
    isAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false }, 
    otp: { type: String },

    // 📱 PHONE VERIFICATION (New)
    phone: { type: String, default: "" },
    phoneOtp: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    
    // 🚗 DRIVER DETAILS
    vehicle: {
        model: { type: String, default: "" },
        plateNumber: { type: String, default: "" }, 
        // 🔒 NEW: Store the Type permanently
        type: { type: String, enum: ['Car', 'Bike'], default: 'Bike' },
        status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
        reviewNote: { type: String, default: '' },
        isVerified: { type: Boolean, default: false }
    },

    // 🪪 DRIVER LICENSE & PADDLE OCR VERIFICATION
    driverLicense: {
        licenseNumber: { type: String, default: "" },
        nameOnLicense: { type: String, default: "" },
        dob: { type: String, default: "" },
        expiryDate: { type: String, default: "" },
        cov: { type: String, default: "" },
        documentPath: { type: String, default: "" },
        status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
        reviewNote: { type: String, default: '' },
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        rawOcrText: [{ type: String }]
    },

    // ⭐ RATINGS & PENALTIES
    rating: { type: Number, default: 5.0 }, 
    reviewCount: { type: Number, default: 0 },
    penaltyBalance: { type: Number, default: 0 },
    cancellationCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);