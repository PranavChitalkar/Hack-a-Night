import React, { useState } from 'react';
import { getCurrentLocation, MAX_GPS_ACCURACY_M } from '../utils/geo';

export default function BookingModal({ isOpen, ride, currentUser, onClose, onConfirmBooking, showToast }) {
  const [pickupSpot, setPickupSpot] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locStatus, setLocStatus] = useState('');

  // Save the GPS pickup only if it is accurate enough to pool and split fares fairly
  const useMyLocation = async () => {
    setLocStatus('Getting your location...');
    setCoords(null);
    try {
      const loc = await getCurrentLocation();
      if (loc.accuracy > MAX_GPS_ACCURACY_M) {
        setLocStatus(`Location is only accurate to about ${loc.accuracy} m. Move to an open area and try again, or type your pickup spot.`);
        return;
      }
      setCoords({ lat: loc.lat, lon: loc.lon });
      setLocStatus(`Pickup location saved (accurate to about ${loc.accuracy} m).`);
    } catch (err) {
      setLocStatus(err.message);
    }
  };

  if (!isOpen || !ride) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirmBooking(ride, pickupSpot || 'Main Pickup Point', coords);
      onClose();
    } catch (err) {
      showToast("Booking failed", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 rounded-4 p-4 shadow-lg">
          <div className="text-center mb-3">
            <h5 className="fw-bold mb-1">Confirm Booking Request</h5>
            <p className="text-muted small">Ride with <span className="fw-bold text-dark">{ride.driverUsername || ride.driver}</span></p>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="bg-light p-3 rounded-3 mb-3 border">
              <div className="d-flex justify-content-between mb-2">
                <span>Route:</span>
                <strong className="text-dark">{ride.from} ➔ {ride.to}</strong>
              </div>

              <div className="d-flex justify-content-between mb-2">
                <span>Total Fare:</span>
                <strong className="text-success fs-5">₹{ride.price}</strong>
              </div>
              
              {ride.womenOnly && (
                <div className="alert alert-danger py-2 small mb-3"><i className="fas fa-venus me-1"></i> Women-only ride. Only female passengers can book.</div>
              )}

              <label className="small fw-bold text-muted mb-1 mt-2">YOUR PICKUP SPOT</label>
              <input 
                type="text" 
                className="form-control" 
                value={pickupSpot} 
                onChange={e => setPickupSpot(e.target.value)} 
                placeholder="e.g. Main Gate, Starbucks, Highway Toll" 
              />
              <div className="d-flex align-items-center gap-2 mt-2">
                <button type="button" className="btn btn-outline-primary btn-sm rounded-pill" onClick={useMyLocation}>
                  <i className="fas fa-crosshairs me-1"></i> Use my location
                </button>
                {locStatus && <span className="small text-muted">{locStatus}</span>}
              </div>
            </div>

            <div className="d-flex gap-2">
              <button type="button" className="btn btn-light rounded-pill w-50" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={loading} className="btn btn-primary rounded-pill w-50 py-2 fw-bold shadow-sm">
                {loading ? 'Sending Request...' : 'Send Request 🚗'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
