import React, { useState, useEffect } from 'react';

export default function DriverDashboard({ currentUser, showToast }) {
  const [activeRide, setActiveRide] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingRide, setCancellingRide] = useState(false);
  const [itinerary, setItinerary] = useState(null);

  // Share the driver's position while a trip is active. Only fixes accurate to 100 m or better are sent.
  useEffect(() => {
    if (!activeRide?._id || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        if (accuracy > 100) return;
        fetch(`/api/rides/${activeRide._id}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon })
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [activeRide?._id]);

  // Live itinerary: refresh every 10 seconds while a trip is active
  useEffect(() => {
    if (!activeRide?._id) { setItinerary(null); return; }
    let cancelled = false;
    const load = () => fetch(`/api/rides/${activeRide._id}/itinerary`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setItinerary(d); })
      .catch(() => {});
    load();
    const timer = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [activeRide?._id]);

  const fetchDriverData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Fetch driver active ride
      const rideRes = await fetch(`/api/rides/driver/${currentUser.username}`);
      const rideData = await rideRes.json();
      if (rideData.success && rideData.ride) {
        setActiveRide(rideData.ride);
        // Fetch requests for this ride
        const reqRes = await fetch(`/api/requests/ride/${rideData.ride._id}`);
        const reqData = await reqRes.json();
        if (reqData.success) {
          setRequests(reqData.requests || []);
        }
      } else {
        setActiveRide(null);
        setRequests([]);
      }
    } catch (err) {
      console.error("Fetch driver dashboard err:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverData();
  }, [currentUser]);

  const handleUpdateRequest = async (reqId, status) => {
    try {
      const res = await fetch(`/api/requests/${reqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Request ${status}!`, 'success');
        fetchDriverData();
      } else {
        showToast(data.error || 'Failed to update request', 'danger');
      }
    } catch (err) {
      showToast('Error updating request status', 'danger');
    }
  };

  const handleCancelDriverTrip = async () => {
    if (!activeRide) return;
    setCancellingRide(true);
    try {
      const res = await fetch(`/api/rides/${activeRide._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverUsername: currentUser.username })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`⚠️ Trip Cancelled. Penalty ₹${data.penaltyAmount} applied & rating reduced by 0.2.`, 'warning');
        setShowCancelModal(false);
        setActiveRide(null);
        setRequests([]);
        fetchDriverData();
      } else {
        showToast(data.error || 'Failed to cancel trip', 'danger');
      }
    } catch (err) {
      showToast('Error cancelling trip', 'danger');
    } finally {
      setCancellingRide(false);
    }
  };

  return (
    <section id="view-dashboard">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold m-0">Driver Dashboard</h4>
            <p className="text-muted small m-0">Manage your active trip, passenger requests & trip cancellations</p>
          </div>
          <button className="btn btn-primary btn-sm rounded-pill px-4" onClick={fetchDriverData} disabled={loading}>
            <i className={`fas fa-sync-alt me-2 ${loading ? 'fa-spin' : ''}`}></i> Refresh
          </button>
        </div>

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="pro-card border-0 shadow-sm bg-white overflow-hidden">
              <div className="bg-light px-4 py-3 border-bottom d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="fas fa-route text-primary me-2"></i>
                  <h6 className="fw-bold m-0">Active Trip Details</h6>
                </div>
                {activeRide && (
                  <button 
                    onClick={() => setShowCancelModal(true)} 
                    className="btn btn-outline-danger btn-sm rounded-pill px-3 fw-bold"
                  >
                    <i className="fas fa-times-circle me-1"></i> Cancel Trip
                  </button>
                )}
              </div>
              <div className="p-4" id="driver-active-ride">
                {activeRide ? (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-primary px-3 py-2 rounded-pill">Active Trip</span>
                      <span className="fs-4 fw-bold text-success">₹{activeRide.price}</span>
                    </div>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="small text-muted fw-bold">FROM</div>
                        <div className="fs-5 fw-bold text-dark">{activeRide.from}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-muted fw-bold">TO</div>
                        <div className="fs-5 fw-bold text-dark">{activeRide.to}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Date</div>
                        <div className="fw-bold">{activeRide.travelDate || 'Today'}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Time</div>
                        <div className="fw-bold">{activeRide.travelTime || 'Flexible'}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Available Seats</div>
                        <div className="fw-bold text-primary">{activeRide.seats} Seats Remaining</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <i className="fas fa-car-side fa-3x mb-3 opacity-25"></i>
                    <h6>No Active Trip</h6>
                    <p className="small">Publish a new trip from the 'Post Ride' section to start accepting passengers.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="pro-card border-0 shadow-sm bg-white overflow-hidden">
              <div className="bg-light px-4 py-3 border-bottom">
                <h6 className="fw-bold m-0"><i className="fas fa-user-friends text-primary me-2"></i>Passenger Requests</h6>
              </div>
              <div className="list-group list-group-flush p-2">
                {requests.length === 0 ? (
                  <div className="p-4 text-center text-muted small">No pending passenger requests</div>
                ) : (
                  requests.map((req) => (
                    <div key={req._id} className="list-group-item border-0 border-bottom p-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong className="text-dark">{req.passengerUsername || req.passenger}</strong>
                        <span className={`badge ${req.status === 'accepted' ? 'bg-success' : req.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="small text-muted mb-2">Pickup: {req.pickupSpot || req.pickupPoint || 'Main Location'}</div>
                      
                      {req.status === 'pending' && (
                        <div className="d-flex gap-2 mt-2">
                          <button onClick={() => handleUpdateRequest(req._id, 'accepted')} className="btn btn-success btn-sm w-100 rounded-pill">Accept</button>
                          <button onClick={() => handleUpdateRequest(req._id, 'rejected')} className="btn btn-outline-danger btn-sm w-100 rounded-pill">Reject</button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 LIVE ITINERARY: pickup and drop-off order for accepted passengers */}
      {activeRide && (
        <div className="pro-card border-0 shadow-sm bg-white mt-4 p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold m-0"><i className="fas fa-map-signs text-primary me-2"></i>Pickup & Drop-off Order</h6>
            {itinerary?.totalDistance > 0 && <span className="badge bg-light text-dark border">{itinerary.totalDistance} km (straight-line)</span>}
          </div>
          {!itinerary ? (
            <div className="small text-muted">Loading itinerary...</div>
          ) : itinerary.success === false ? (
            <div className="alert alert-warning small mb-0">{itinerary.error}</div>
          ) : itinerary.stops && itinerary.stops.length > 0 ? (
            <ol className="list-unstyled mb-0">
              {itinerary.stops.map((stop, idx) => (
                <li key={idx} className="d-flex align-items-center gap-3 py-2 border-bottom">
                  <span className={`badge rounded-circle ${stop.type === 'pickup' ? 'bg-success' : 'bg-danger'}`} style={{ width: 28, height: 28, lineHeight: '18px' }}>{idx + 1}</span>
                  <div className="flex-grow-1">
                    <div className="fw-bold small">{stop.type === 'pickup' ? 'Pick up' : 'Drop off'} {stop.passengerName}</div>
                    <div className="small text-muted">{stop.label}</div>
                  </div>
                  <div className="small text-muted font-monospace">~{Math.round(stop.etaMinutes)} min</div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="small text-muted">{itinerary.message || 'No accepted passengers with locations yet.'}</div>
          )}
        </div>
      )}

      {/* ⚠️ DRIVER CANCELLATION PENALTY MODAL */}
      {showCancelModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header bg-danger text-white border-0 py-3">
                <h5 className="modal-header-title fw-bold m-0 text-white">
                  <i className="fas fa-exclamation-triangle me-2"></i> Driver Cancellation Warning
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCancelModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="fw-bold text-dark">Are you sure you want to cancel your active trip?</p>
                <div className="alert alert-danger mb-3">
                  <div className="fw-bold mb-1"><i className="fas fa-shield-alt me-1"></i> Driver Penalty Protocol:</div>
                  <ul className="mb-0 ps-3 small">
                    <li><strong>₹150 Penalty Balance</strong> charged to your account.</li>
                    <li><strong>Driver Rating Drop</strong> of -0.2 stars.</li>
                    <li>All passenger bookings will be cancelled and emergency replacement routes suggested.</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer border-0 p-3 pt-0 gap-2">
                <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowCancelModal(false)}>Don't Cancel</button>
                <button type="button" className="btn btn-danger rounded-pill px-4 fw-bold" onClick={handleCancelDriverTrip} disabled={cancellingRide}>
                  {cancellingRide ? 'Cancelling...' : 'Confirm & Accept Penalty'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
