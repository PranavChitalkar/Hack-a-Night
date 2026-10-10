import React, { useEffect, useState } from 'react';

// Public page opened from a trip-share link. Shows no phone numbers or emails.
export default function TripShare({ token }) {
  const [trip, setTrip] = useState(null);
  const [helplines, setHelplines] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    fetch(`/api/share/${token}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.success) { setTrip(d.trip); setHelplines(d.helplines); setError(''); }
        else setError(d.error || 'Trip not found');
      })
      .catch(() => setError('Could not load this trip'));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000); // refresh every 15 seconds
    return () => clearInterval(timer);
  }, [token]);

  return (
    <div className="container py-5" style={{ maxWidth: 560 }}>
      <div className="text-center mb-4">
        <h3 className="fw-bold"><i className="fas fa-route text-primary me-2"></i>Shared trip</h3>
        <p className="text-muted small">Updates every 15 seconds. Shared by a SwiftWheels passenger.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {trip && (
        <div className="pro-card p-4 bg-white shadow-sm rounded-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="fw-bold">{trip.passengerFirstName}'s trip</span>
            <span className={`badge ${trip.bookingStatus === 'accepted' ? 'bg-success' : 'bg-secondary'} rounded-pill px-3 py-2`}>
              {trip.bookingStatus === 'accepted' ? 'Confirmed' : trip.bookingStatus}
            </span>
          </div>

          <div className="mb-3">
            <div className="small text-muted fw-bold">ROUTE</div>
            <div className="fw-bold">{trip.from} ➔ {trip.to}</div>
            <div className="small text-muted">{trip.travelDate} at {trip.travelTime}</div>
          </div>

          <div className="bg-light rounded-3 p-3 mb-3">
            <div className="small text-muted fw-bold">DRIVER</div>
            <div className="fw-bold">{trip.driverName} {trip.driverVerified && <span className="badge bg-success ms-1">Verified</span>}</div>
            <div className="small">{trip.vehicleModel} {trip.vehicleType ? `(${trip.vehicleType})` : ''}</div>
            <div className="font-monospace fw-bold fs-5 mt-1">{trip.plateNumber || 'Plate not set'}</div>
          </div>

          <div className="small text-muted mb-3">
            Ride status: <strong className="text-dark">{trip.rideStatus}</strong>
            {trip.currentLat != null && <> &middot; Driver location: {Number(trip.currentLat).toFixed(4)}, {Number(trip.currentLon).toFixed(4)}</>}
          </div>

          {helplines && (
            <div className="alert alert-warning small mb-0">
              In an emergency call <strong>112</strong>. Women's helpline: <strong>1091</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
