/**
 * Single source of truth for driver verification.
 *
 * Both the driving license and the vehicle must be approved by an admin
 * before a user can post rides. The license is read automatically by OCR,
 * but that only SUBMITS it for review; it never approves it.
 *
 * Per-document status: 'none' | 'pending' | 'verified' | 'rejected'
 * Overall driver status: 'not_submitted' | 'pending_review' | 'verified' | 'rejected'
 */

const DOC_STATUS = { NONE: 'none', PENDING: 'pending', VERIFIED: 'verified', REJECTED: 'rejected' };
const DRIVER_STATUS = {
    NOT_SUBMITTED: 'not_submitted',
    PENDING_REVIEW: 'pending_review',
    VERIFIED: 'verified',
    REJECTED: 'rejected'
};

// Records created before this change have only boolean flags. Those were
// set automatically, so they are treated as pending until an admin approves.
function docStatus(doc, hasData) {
    if (doc && doc.status) return doc.status;
    if (doc && doc.isVerified) return DOC_STATUS.PENDING;
    return hasData ? DOC_STATUS.PENDING : DOC_STATUS.NONE;
}

function getDriverStatus(user) {
    const lic = (user && user.driverLicense) || {};
    const veh = (user && user.vehicle) || {};

    const licStatus = docStatus(lic, !!lic.licenseNumber || !!lic.documentPath);
    const vehStatus = docStatus(veh, !!veh.model || !!veh.plateNumber);

    if (licStatus === DOC_STATUS.REJECTED || vehStatus === DOC_STATUS.REJECTED) return DRIVER_STATUS.REJECTED;
    if (licStatus === DOC_STATUS.VERIFIED && vehStatus === DOC_STATUS.VERIFIED) return DRIVER_STATUS.VERIFIED;
    if (licStatus === DOC_STATUS.NONE && vehStatus === DOC_STATUS.NONE) return DRIVER_STATUS.NOT_SUBMITTED;
    return DRIVER_STATUS.PENDING_REVIEW;
}

function isDriverApproved(user) {
    return getDriverStatus(user) === DRIVER_STATUS.VERIFIED;
}

module.exports = { DOC_STATUS, DRIVER_STATUS, getDriverStatus, isDriverApproved };
