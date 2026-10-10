import React, { useState, useEffect } from 'react';

// Pays only this passenger's share of the ride, not the full ride price.
export default function PaymentModal({ isOpen, req, onClose, showToast }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [share, setShare] = useState(null);
  const [shareError, setShareError] = useState('');

  useEffect(() => {
    if (!isOpen || !req || !req._id) return;
    setShare(null);
    setShareError('');
    fetch(`/api/requests/${req._id}/fare-share`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.success) setShare(d);
        else setShareError(d.error || 'Could not calculate your share');
      })
      .catch(() => setShareError('Network error while calculating your share'));
  }, [isOpen, req]);

  if (!isOpen || !req) return null;

  const ride = req.rideId || {};
  const driver = ride.driverUsername || ride.driver || 'Driver';
  const amount = share ? share.myShare : null;
  const alreadyPaid = req.paymentStatus === 'paid';

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/requests/${req._id}/pay`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`✔ Payment of ₹${data.paidAmount} recorded for your share`, 'success');
          onClose();
        } else {
          showToast(data.error || 'Payment could not be recorded', 'danger');
        }
      } catch (err) {
        showToast('Payment confirmation error', 'danger');
      } finally {
        setIsProcessing(false);
      }
    }, 2000);
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-header bg-primary text-white border-0 py-3">
            <h5 className="modal-title fw-bold"><i className="fas fa-wallet me-2"></i>Pay Your Share</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body text-center p-4">
            {shareError && <div className="alert alert-danger small">{shareError}</div>}

            {!shareError && amount == null && (
              <div className="py-4"><div className="spinner-border text-primary" role="status"></div></div>
            )}

            {amount != null && (
              <>
                <div className="mb-2 text-muted small text-uppercase fw-bold">Scan with any UPI App (GPay, PhonePe, Paytm)</div>
                <div className="bg-light p-3 d-inline-block rounded-3 mb-3 border">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=swiftwheels@upi&pn=SwiftWheels&am=${amount}`} alt="UPI QR Code" />
                </div>
                <h3 className="fw-bold text-dark mb-1">₹{amount}</h3>
                <p className="text-muted small mb-1">Your share of the ₹{share.rideFare} ride fare</p>
                <p className="text-muted small">
                  {share.groupSize > 1
                    ? `Shared with ${share.groupSize - 1} co-passenger(s), split by each person's route.`
                    : 'You are riding alone, so you pay the full fare.'}
                </p>
                <p className="text-muted small">Paying driver: <strong className="text-dark">{driver}</strong></p>

                {alreadyPaid && <div className="alert alert-success small py-2">You have already paid ₹{req.paidAmount} for this ride.</div>}

                {isProcessing && (
                  <div className="my-3">
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="small text-muted mt-2">Processing secure transaction...</div>
                  </div>
                )}

                {!isProcessing && (
                  <button onClick={handleProcessPayment} className="btn btn-success w-100 py-3 rounded-pill fw-bold shadow-sm mt-2">
                    <i className="fas fa-check-circle me-2"></i> Confirm Payment of ₹{amount}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="modal-footer bg-light justify-content-center border-0 py-3">
            <small className="text-muted"><i className="fas fa-lock me-1"></i> Demo payment: no real money moves in this build</small>
          </div>
        </div>
      </div>
    </div>
  );
}
