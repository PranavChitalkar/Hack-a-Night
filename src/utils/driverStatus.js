// Mirrors utils/driverStatus.js on the server. Keep the two in sync.
export function docStatus(doc, hasData) {
  if (doc && doc.status) return doc.status;
  if (doc && doc.isVerified) return 'pending';
  return hasData ? 'pending' : 'none';
}

export function getDriverStatus(user) {
  const lic = (user && user.driverLicense) || {};
  const veh = (user && user.vehicle) || {};
  const licStatus = docStatus(lic, !!lic.licenseNumber || !!lic.documentPath);
  const vehStatus = docStatus(veh, !!veh.model || !!veh.plateNumber);
  if (licStatus === 'rejected' || vehStatus === 'rejected') return 'rejected';
  if (licStatus === 'verified' && vehStatus === 'verified') return 'verified';
  if (licStatus === 'none' && vehStatus === 'none') return 'not_submitted';
  return 'pending_review';
}

export function isDriverApproved(user) {
  return getDriverStatus(user) === 'verified';
}
