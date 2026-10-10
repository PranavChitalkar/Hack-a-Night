import React, { useState, useEffect } from 'react';
import { getDriverStatus, isDriverApproved } from '../utils/driverStatus';
import { searchPlaces, haversineKm, DEFAULT_RATE_PER_KM } from '../utils/geo';

export default function PostRide({ currentUser, onPublishRide, onRefreshProfile, showToast }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stops, setStops] = useState('');
  const [distance, setDistance] = useState('');
  const [ratePerKm, setRatePerKm] = useState(String(DEFAULT_RATE_PER_KM));
  const [fromPlace, setFromPlace] = useState(null); // { label, lat, lon } chosen from search
  const [toPlace, setToPlace] = useState(null);
  const [finding, setFinding] = useState(false);
  const [price, setPrice] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [travelTime, setTravelTime] = useState('');
  const [seats, setSeats] = useState(1);
  const [vibe, setVibe] = useState('🎵 Music');
  const [womenOnly, setWomenOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const vehicleType = currentUser?.vehicle?.type || 'Car';
  const vehicleModel = currentUser?.vehicle?.model || 'Maruti Swift';
  const maxSeats = vehicleType === 'Bike' ? 1 : 4;

  useEffect(() => {
    if (vehicleType === 'Bike') setSeats(1);
  }, [vehicleType]);

  const handleManualCheck = async () => {
    setIsRefreshing(true);
    if (onRefreshProfile) {
      await onRefreshProfile();
      showToast("Checked latest approval status from database", "info");
    }
    setIsRefreshing(false);
  };

  // Look up both places (one request at a time, per the OpenStreetMap usage policy),
  // then compute the straight-line distance and the price from the rate.
  const handleCalculateDistance = async () => {
    if (!from || !to) {
      showToast("Please enter From and To locations", "warning");
      return;
    }
    setFinding(true);
    try {
      const fromResults = await searchPlaces(from, 1);
      await new Promise(r => setTimeout(r, 1100));
      const toResults = await searchPlaces(to, 1);
      if (fromResults.length === 0) { showToast(`Could not find "${from}". Add the city name.`, "warning"); setFromPlace(null); return; }
      if (toResults.length === 0) { showToast(`Could not find "${to}". Add the city name.`, "warning"); setToPlace(null); return; }

      const f = fromResults[0], t = toResults[0];
      const km = Math.round(haversineKm(f.lat, f.lon, t.lat, t.lon) * 100) / 100;
      if (km < 0.1) { showToast("From and To are the same place.", "warning"); return; }
      setFromPlace(f);
      setToPlace(t);
      setDistance(km.toString());
      setPrice(String(Math.round(km * (parseFloat(ratePerKm) || DEFAULT_RATE_PER_KM))));
      showToast(`Straight-line distance: ${km} km`, "info");
    } catch (err) {
      showToast(err.message || "Place search failed", "danger");
    } finally {
      setFinding(false);
    }
  };

  const handleRateChange = (rate) => {
    setRatePerKm(rate);
    if (distance) {
      setPrice(String(Math.round(parseFloat(distance) * (parseFloat(rate) || 0))));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!from || !to || !travelDate || !travelTime || !price) {
      showToast("Please fill in all required trip details", "warning");
      return;
    }
    if (!fromPlace || !toPlace) {
      showToast("Click 'Find Places & Calculate Fare' to confirm both locations", "warning");
      return;
    }

    setLoading(true);
    try {
      await onPublishRide({
        driverUsername: currentUser.username,
        driver: currentUser.username,
        driverRating: currentUser.rating || 5.0,
        from,
        to,
        stops: stops ? stops.split(',').map(s => s.trim()) : [],
        distance,
        price,
        travelDate,
        travelTime,
        vehicleType,
        vehicleModel,
        seats: parseInt(seats),
        vibe,
        womenOnly,
        fromLat: fromPlace.lat,
        fromLon: fromPlace.lon,
        toLat: toPlace.lat,
        toLon: toPlace.lon,
        ratePerKm: parseFloat(ratePerKm) || DEFAULT_RATE_PER_KM
      });
      // Clear form
      setFrom('');
      setTo('');
      setStops('');
      setDistance('');
      setPrice('');
      setFromPlace(null);
      setToPlace(null);
    } catch (err) {
      showToast("Failed to publish ride", "danger");
    } finally {
      setLoading(false);
    }
  };

  const driverStatus = getDriverStatus(currentUser);
  if (!isDriverApproved(currentUser)) {
    return (
      <div className="card p-5 border-0 shadow-sm rounded-4 text-center" style={{ maxWidth: '650px', margin: '0 auto' }}>
        <i className="fas fa-shield-alt fa-3x text-warning mb-3"></i>
        <h4 className="fw-bold mb-2">Driver Approval Required</h4>
        <p className="text-muted mb-4">
          {driverStatus === 'not_submitted' && (
            <span>To post rides, submit your driving license and vehicle details in your Profile. An admin will review them.</span>
          )}
          {driverStatus === 'pending_review' && (
            <span>Your license and vehicle are waiting for admin approval. You can post rides once both are approved.</span>
          )}
          {driverStatus === 'rejected' && (
            <span>Your application was not approved. Check the reason in your Profile, then resubmit your details.</span>
          )}
        </p>
        <div>
          <button onClick={handleManualCheck} disabled={isRefreshing} className="btn btn-primary rounded-pill px-4 py-2 fw-bold shadow-sm">
            <i className={`fas fa-sync-alt me-2 ${isRefreshing ? 'fa-spin' : ''}`}></i> Sync / Check Admin Approval
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 border-0 shadow-sm rounded-4" style={{ maxWidth: '650px', margin: '0 auto' }}>
      <h5 className="fw-bold mb-4"><i className="fas fa-plus-circle text-primary me-2"></i>Create New Trip</h5>
      <form onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-12">
            <div className="form-check form-switch p-3 bg-light rounded-3 border">
              <input className="form-check-input ms-0 me-2" type="checkbox" id="womenOnlySwitch" checked={womenOnly} onChange={e => setWomenOnly(e.target.checked)} />
              <label className="form-check-label fw-bold small" htmlFor="womenOnlySwitch">Women-only ride</label>
              <div className="small text-muted">Only passengers who set their gender to female can book this ride.</div>
            </div>
          </div>
          <div className="col-5">
            <label className="small fw-bold text-muted">FROM</label>
            <input className="form-control" value={from} onChange={e => { setFrom(e.target.value); setFromPlace(null); setDistance(''); setPrice(''); }} placeholder="City A (e.g. Nashik)" required />
          </div>
          <div className="col-2 text-center pt-4"><i className="fas fa-arrow-right text-muted"></i></div>
          <div className="col-5">
            <label className="small fw-bold text-muted">TO</label>
            <input className="form-control" value={to} onChange={e => { setTo(e.target.value); setToPlace(null); setDistance(''); setPrice(''); }} placeholder="City B (e.g. Pune)" required />
          </div>

          <div className="col-12">
            <label className="small fw-bold text-muted">ROUTE STOPS (VIA)</label>
            <input className="form-control" value={stops} onChange={e => setStops(e.target.value)} placeholder="Add stops separated by comma (e.g. Jatra, Ozar, Amrutdham)" />
            <small className="text-muted">Passengers searching for these locations will see your ride.</small>
          </div>

          <div className="col-12">
            <button type="button" onClick={handleCalculateDistance} disabled={finding} className="btn btn-outline-primary w-100 btn-sm">
              <i className={`fas fa-map-marked-alt me-1 ${finding ? 'fa-spin' : ''}`}></i> {finding ? 'Finding places...' : 'Find Places & Calculate Fare'}
            </button>
            {fromPlace && toPlace && (
              <div className="small text-muted mt-2">
                <div><strong>From:</strong> {fromPlace.label}</div>
                <div><strong>To:</strong> {toPlace.label}</div>
              </div>
            )}
          </div>

          <div className="col-4">
            <label className="small text-muted">Straight-line km</label>
            <input className="form-control bg-light" value={distance} readOnly placeholder="0" />
          </div>
          <div className="col-4">
            <label className="small text-muted">Rate/Km (₹)</label>
            <input className="form-control" value={ratePerKm} onChange={e => handleRateChange(e.target.value)} placeholder="10" />
          </div>
          <div className="col-4">
            <label className="small fw-bold text-success">Total ₹</label>
            <input className="form-control bg-success text-white fw-bold" value={price} readOnly required placeholder="₹ 0" />
          </div>

          <hr className="my-2" />

          <div className="col-6">
            <label className="small text-muted">Date</label>
            <input type="date" className="form-control" value={travelDate} onChange={e => setTravelDate(e.target.value)} required />
          </div>
          <div className="col-6">
            <label className="small text-muted">Time</label>
            <input type="time" className="form-control" value={travelTime} onChange={e => setTravelTime(e.target.value)} required />
          </div>

          <div className="col-md-4">
            <label className="form-label small fw-bold text-muted">Vehicle</label>
            <input className="form-control bg-light" value={vehicleType} readOnly />
          </div>

          <div className="col-md-4">
            <label className="form-label small fw-bold text-muted">Model</label>
            <input className="form-control bg-light" value={vehicleModel} readOnly />
          </div>

          <div className="col-md-4">
            <label className="form-label small fw-bold text-muted">Seats Available</label>
            <input type="number" className="form-control" value={seats} onChange={e => setSeats(e.target.value)} min="1" max={maxSeats} required />
            <small className="text-muted" style={{ fontSize: '0.7rem' }}>Max {maxSeats} for {vehicleType}</small>
          </div>

          <div className="col-12">
            <label className="small text-muted">Trip Vibe</label>
            <select className="form-select" value={vibe} onChange={e => setVibe(e.target.value)}>
              <option value="🎵 Music">🎵 Music & Conversation</option>
              <option value="🤫 Silent">🤫 Silent & Peaceful</option>
              <option value="💼 Business">💼 Work / Professional</option>
            </select>
          </div>

          <div className="col-12 mt-4">
            <button type="submit" disabled={loading} className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm">
              {loading ? 'Publishing...' : 'Publish Ride 🚀'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
