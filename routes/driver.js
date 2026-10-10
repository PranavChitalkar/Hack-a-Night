const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const User = require('../models/User');

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../public/uploads/licenses');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'license-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPG, PNG, JPEG, WEBP) are allowed!'));
        }
    }
});

/**
 * 1. 🪪 POST /api/driver/verify-license-ocr
 * Uploads license image, runs PaddleOCR script, returns extracted info to client.
 */
router.post('/driver/verify-license-ocr', upload.single('licenseImg'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "Please upload a valid Driving License image." });
        }

        const imagePath = req.file.path;
        const relativeDocumentPath = `/uploads/licenses/${req.file.filename}`;

        // Execute Python PaddleOCR script
        const pythonScript = path.join(__dirname, '../utils/license_ocr.py');

        // Execute python process
        execFile('python', [pythonScript, imagePath], { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ OCR Process Error:", error, stderr);
                return res.status(500).json({
                    success: false,
                    error: "Could not read the license. " + (stderr || error.message),
                    documentPath: relativeDocumentPath
                });
            }

            try {
                // Find start of JSON in stdout (in case python outputs info warnings)
                const jsonStartIdx = stdout.indexOf('{');
                const jsonEndIdx = stdout.lastIndexOf('}');
                
                if (jsonStartIdx === -1 || jsonEndIdx === -1) {
                    throw new Error("Invalid JSON output from PaddleOCR script");
                }

                const jsonString = stdout.substring(jsonStartIdx, jsonEndIdx + 1);
                const ocrResult = JSON.parse(jsonString);

                if (!ocrResult.success) {
                    return res.status(400).json({
                        success: false,
                        error: ocrResult.error || "Could not read driving license image",
                        documentPath: relativeDocumentPath
                    });
                }

                return res.json({
                    success: true,
                    message: "License read successfully!",
                    licenseData: {
                        licenseNumber: ocrResult.licenseNumber || "",
                        nameOnLicense: ocrResult.nameOnLicense || "",
                        dob: ocrResult.dob || "",
                        expiryDate: ocrResult.expiryDate || "",
                        cov: ocrResult.cov || "LMV",
                        rawOcrText: ocrResult.rawOcrText || []
                    },
                    documentPath: relativeDocumentPath
                });

            } catch (parseError) {
                console.error("❌ OCR JSON Parse Error:", parseError, stdout);
                return res.status(500).json({
                    success: false,
                    error: "Could not read the license details",
                    documentPath: relativeDocumentPath
                });
            }
        });

    } catch (err) {
        console.error("❌ License Upload Route Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * 2. 💾 POST /api/driver/save-license
 * Saves confirmed driving license details to the user profile in MongoDB.
 */
router.post('/driver/save-license', async (req, res) => {
    try {
        const { username, licenseNumber, nameOnLicense, dob, expiryDate, cov, documentPath, rawOcrText } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, error: "Username is required" });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        // Saving submits the license for admin review. Only an admin can verify it.
        user.driverLicense = {
            licenseNumber: licenseNumber || user.driverLicense?.licenseNumber || "",
            nameOnLicense: nameOnLicense || user.driverLicense?.nameOnLicense || "",
            dob: dob || user.driverLicense?.dob || "",
            expiryDate: expiryDate || user.driverLicense?.expiryDate || "",
            cov: cov || user.driverLicense?.cov || "LMV",
            documentPath: documentPath || user.driverLicense?.documentPath || "",
            status: 'pending',
            reviewNote: '',
            isVerified: false,
            verifiedAt: undefined,
            rawOcrText: rawOcrText || user.driverLicense?.rawOcrText || []
        };

        await user.save();

        res.json({
            success: true,
            message: "License details submitted for admin review.",
            user: {
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                isVerified: user.isVerified,
                driverLicense: user.driverLicense,
                vehicle: user.vehicle
            }
        });

    } catch (err) {
        console.error("❌ Save License Error:", err);
        res.status(500).json({ success: false, error: "Failed to save driver license details" });
    }
});

/**
 * 3. 📋 GET /api/admin/drivers
 * Fetch all registered drivers and their license verification status.
 */
router.get('/admin/drivers', async (req, res) => {
    try {
        const drivers = await User.find({
            $or: [
                { 'driverLicense.licenseNumber': { $ne: "" } },
                { 'vehicle.model': { $ne: "" } }
            ]
        }).select('-password -otp -phoneOtp').lean();

        res.json({ success: true, drivers });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch drivers" });
    }
});

module.exports = router;
