import React, { useState, useEffect } from 'react';

export default function MyTrips({ currentUser, onOpenPayment, showToast, onBookRide }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelModalReq, setCancelModalReq] = useState(null);
  const [emergencyRides, setEmergencyRides] = useState([]);

  const fetchMyRequests = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/requests/passenger/${currentUser.username}`);
      const data = await res.json();
      if (data.success) {
        setRequests((data.requests || []).filter(r => r.status !== 'cancelled' && !['cancelled', 'completed'].includes(r.rideId?.status)));
      }
    } catch (err) {
      console.error("Fetch passenger requests err:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
  }, [currentUser]);

  const handleShareTrip = async (req) => {
    try {
      const res = await fetch(`/api/requests/${req._id}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Could not create trip link', 'danger');
        return;
      }
      const link = `${window.location.origin}${data.sharePath}`;
      try {
        await navigator.clipboard.writeText(link);
        showToast('Trip link copied. Send it to someone you trust.', 'success');
      } catch (e) {
        window.prompt('Copy this trip link:', link);
      }
    } catch (err) {
      showToast('Could not create trip link', 'danger');
    }
  };

  const handleCancelClick = (req) => {
    setCancelModalReq(req);
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalReq) return;
    setCancellingId(cancelModalReq._id);
    try {
      const res = await fetch(`/api/requests/${cancelModalReq._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passengerUsername: currentUser.username })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.penaltyAmount > 0) {
          showToast(`⚠️ Booking cancelled. Penalty of ₹${data.penaltyAmount} charged.`, 'warning');
        } else {
          showToast('✔ Booking request cancelled successfully.', 'info');
        }
        if (data.emergencyRides && data.emergencyRides.length > 0) {
          setEmergencyRides(data.emergencyRides);
        }
        fetchMyRequests();
      } else {
        showToast(data.error || 'Failed to cancel booking', 'danger');
      }
    } catch (err) {
      showToast('Error cancelling booking request', 'danger');
    } finally {
      setCancellingId(null);
      setCancelModalReq(null);
    }
  };

  return (
    <div id="view-trips">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold m-0">My Bookings & Trips</h4>
          <p className="text-muted small m-0">Track your ride requests, cancellations & payment status</p>
        </div>
        <button className="btn btn-primary btn-sm rounded-pill px-4" onClick={fetchMyRequests} disabled={loading}>
          <i className={`fas fa-sync-alt me-2 ${loading ? 'fa-spin' : ''}`}></i> Refresh
        </button>
      </div>

      {/* 🚨 EMERGENCY ROUTE RE-BOOKING SUGGESTION SECTION */}
      {emergencyRides.length > 0 && (
        <div className="alert alert-warning border-start border-4 border-warning shadow-sm mb-4 p-4 rounded-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="fw-bold text-dark m-0">
                <i className="fas fa-route text-warning me-2"></i> Emergency Replacement Rides Suggested
              </h5>
              <p className="small text-muted mb-0">We found active drivers along your route available for 1-click re-booking!</p>
            </div>
            <button className="btn btn-sm btn-outline-secondary rounded-circle" onClick={() => setEmergencyRides([])}>✕</button>
          </div>

          <div className="row g-3">
            {emergencyRides.map(ride => (
              <div key={ride._id} className="col-md-6 col-lg-4">
                <div className="bg-white p-3 rounded-3 border shadow-sm h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="badge bg-success bg-opacity-10 text-success fw-bold">Emergency Match</span>
                      <span className="fw-bold text-success">₹{ride.price}</span>
                    </div>
                    <div className="fw-bold text-dark small">{ride.from} ➔ {ride.to}</div>
                    <div className="small text-muted mt-1">
                      <i className="fas fa-user-tie me-1"></i> {ride.driverUsername || ride.driver} ({ride.driverRating || 5.0}★)
                    </div>
                    <div className="small text-muted">
                      <i className="fas fa-couch me-1 text-primary"></i> {ride.seats} Seats Available
                    </div>
                  </div>
                  <button 
                    onClick={() => onBookRide && onBookRide(ride)}
                    className="btn btn-warning btn-sm w-100 rounded-pill fw-bold mt-3"
                  >
                    <i className="fas fa-bolt me-1"></i> Re-book Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRIP BOOKINGS LIST */}
      <div className="row g-4">
        {requests.length === 0 ? (
          <div className="col-12 text-center py-5">
            <i className="fas fa-ticket-alt fa-3x text-muted mb-3 opacity-25"></i>
            <h5 className="text-muted fw-bold">No active trip bookings</h5>
            <p className="small text-secondary">Search available rides in Marketplace and request a seat.</p>
          </div>
        ) : (
          requests.map((req) => {
            const ride = req.rideId || req.rideDetails || {};
            const isCancelled = req.status === 'cancelled';

            return (
              <div key={req._id} className="col-md-6 col-lg-4">
                <div className="pro-card p-4 h-100 d-flex flex-column justify-content-between border">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className={`badge ${
                        req.status === 'accepted' ? 'bg-success' 
                        : req.status === 'rejected' ? 'bg-danger' 
                        : req.status === 'cancelled' ? 'bg-secondary' 
                        : 'bg-warning text-dark'
                      } px-3 py-2 rounded-pill`}>
                        {req.status === 'accepted' ? '✔ Accepted' 
                         : req.status === 'rejected' ? '❌ Rejected' 
                         : req.status === 'cancelled' ? '🚫 Cancelled' 
                         : '⏳ Pending Approval'}
                      </span>
                      <span className="fs-5 fw-bold text-success">₹{ride.price || req.rideDetails?.price || '0'}</span>
                    </div>

                    <div className="location-timeline">
                      <div className="timeline-dot top"></div>
                      <div className="fw-bold text-dark mb-1">{ride.from || req.rideDetails?.from || 'Origin'}</div>
                      <div className="timeline-dot bottom"></div>
                      <div className="fw-bold text-dark mt-3">{ride.to || req.rideDetails?.to || 'Destination'}</div>
                    </div>

                    <div className="bg-light p-3 rounded-3 my-3">
                      <div className="small text-muted mb-1">
                        <strong>Driver:</strong> {ride.driverUsername || ride.driver || req.driver || 'Driver'}
                      </div>
                      <div className="small text-muted">
                        <strong>Pickup:</strong> {req.pickupPoint || req.pickupSpot || 'Main Meeting Spot'}
                      </div>
                      {req.cancellationPenalty > 0 && (
                        <div className="small text-danger fw-bold mt-2">
                          <i className="fas fa-exclamation-triangle me-1"></i> Penalty Applied: ₹{req.cancellationPenalty}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {req.status === 'accepted' && req.paymentStatus === 'paid' && (
                      <div className="badge bg-success bg-opacity-10 text-success w-100 rounded-pill py-2 mb-2">
                        <i className="fas fa-check-circle me-1"></i> Your share paid: ₹{req.paidAmount}
                      </div>
                    )}

                    {req.status === 'accepted' && req.paymentStatus !== 'paid' && (
                      <button 
                        onClick={() => onOpenPayment && onOpenPayment(req)} 
                        className="btn btn-success w-100 rounded-pill py-2 fw-bold shadow-sm mb-2"
                      >
                        <i className="fas fa-wallet me-2"></i> Pay your share via UPI
                      </button>
                    )}

                    {req.status === 'accepted' && (
                      <button
                        onClick={() => handleShareTrip(req)}
                        className="btn btn-outline-primary w-100 rounded-pill py-2 small fw-bold mb-2"
                      >
                        <i className="fas fa-share-alt me-1"></i> Share trip link
                      </button>
                    )}

                    {!isCancelled && req.status !== 'rejected' && (
                      <button
                        onClick={() => handleCancelClick(req)}
                        disabled={cancellingId === req._id}
                        className="btn btn-outline-danger w-100 rounded-pill py-2 small fw-bold"
                      >
                        <i className="fas fa-times-circle me-1"></i> Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ⚠️ CANCELLATION PENALTY CONFIRMATION MODAL */}
      {cancelModalReq && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header bg-danger text-white border-0 py-3">
                <h5 className="modal-header-title fw-bold m-0 text-white">
                  <i className="fas fa-exclamation-triangle me-2"></i> Confirm Cancellation
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setCancelModalReq(null)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="fw-bold text-dark">Are you sure you want to cancel this booking?</p>
                {cancelModalReq.status === 'accepted' ? (
                  <div className="alert alert-danger mb-0">
                    <i className="fas fa-coins me-2"></i>
                    <strong>₹50 Penalty Fee Notice:</strong> Since the driver has already accepted your booking request, cancelling will deduct/charge a ₹50 penalty balance from your account.
                  </div>
                ) : (
                  <div className="alert alert-info mb-0">
                    <i className="fas fa-info-circle me-2"></i>
                    Your booking request is currently pending. Cancelling now incurs <strong>₹0 penalty fee</strong>.
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 p-3 pt-0 gap-2">
                <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setCancelModalReq(null)}>Keep Booking</button>
                <button type="button" className="btn btn-danger rounded-pill px-4 fw-bold" onClick={handleConfirmCancel}>
                  Proceed & Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
