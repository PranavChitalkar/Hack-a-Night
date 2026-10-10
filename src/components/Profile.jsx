import React, { useState, useEffect } from 'react';
import { docStatus } from '../utils/driverStatus';

export default function Profile({ currentUser, onUserUpdated, onRefreshProfile, onOpenLicenseModal, showToast }) {
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [showPhoneOtpInput, setShowPhoneOtpInput] = useState(false);
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);

  // Vehicle form state
  const [regType, setRegType] = useState(currentUser?.vehicle?.type || 'Car');
  const [regModel, setRegModel] = useState(currentUser?.vehicle?.model || '');
  const [regPlate, setRegPlate] = useState(currentUser?.vehicle?.plateNumber || '');
  const [isVehicleSubmitting, setIsVehicleSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editVehicle, setEditVehicle] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setPhone(currentUser.phone || '');
      setRegType(currentUser.vehicle?.type || 'Car');
      setRegModel(currentUser.vehicle?.model || '');
      setRegPlate(currentUser.vehicle?.plateNumber || '');
    }
  }, [currentUser]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshProfile) {
      await onRefreshProfile();
      showToast("Profile & approval status synced with database", "info");
    }
    setIsRefreshing(false);
  };

  const handleSendPhoneOtp = async () => {
    if (!phone || phone.length < 10) {
      showToast("Please enter a valid 10-digit phone number", "warning");
      return;
    }

    try {
      const res = await fetch('/api/user/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, phone })
      });
      const data = await res.json();
      if (res.ok) {
        setShowPhoneOtpInput(true);
        showToast("OTP sent to your phone! Check console logs for code.", "info");
      } else {
        showToast(data.error || "Failed to send OTP", "danger");
      }
    } catch (err) {
      showToast("Network error sending OTP", "danger");
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp) {
      showToast("Please enter 6-digit OTP", "warning");
      return;
    }

    setIsPhoneVerifying(true);
    try {
      const res = await fetch('/api/user/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, otp: phoneOtp })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        showToast("Phone Number Verified Successfully!", "success");
        onUserUpdated(data.user);
        setShowPhoneOtpInput(false);
      } else {
        showToast(data.error || "Invalid OTP code", "danger");
      }
    } catch (err) {
      showToast("Verification failed", "danger");
    } finally {
      setIsPhoneVerifying(false);
    }
  };

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    if (!regModel || !regPlate) {
      showToast("Please fill vehicle model and license plate number", "warning");
      return;
    }

    setIsVehicleSubmitting(true);
    try {
      const res = await fetch('/api/user/vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          model: regModel,
          plateNumber: regPlate,
          type: regType
        })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        showToast("Vehicle details submitted successfully! Awaiting Admin Approval.", "success");
        onUserUpdated(data.user);
        setEditVehicle(false);
      } else {
        showToast(data.error || "Vehicle registration failed", "danger");
      }
    } catch (err) {
      showToast("Error registering vehicle", "danger");
    } finally {
      setIsVehicleSubmitting(false);
    }
  };

  const license = currentUser?.driverLicense || {};
  const vehicle = currentUser?.vehicle || {};
  const licStatus = docStatus(license, !!license.licenseNumber || !!license.documentPath);
  const vehicleStatus = docStatus(vehicle, !!vehicle.model || !!vehicle.plateNumber);
  const rejectionNote = [licStatus === 'rejected' && license.reviewNote && `License: ${license.reviewNote}`, vehicleStatus === 'rejected' && vehicle.reviewNote && `Vehicle: ${vehicle.reviewNote}`].filter(Boolean);

  return (
    <div id="view-profile">
      <div className="row g-4">
        
        {/* Left Column: User Card & Phone Verification */}
        <div className="col-lg-4">
          <div className="pro-card p-4 text-center h-100">
            <div className="position-relative d-inline-block mb-3">
              <div className="avatar-circle bg-primary text-white mx-auto shadow-sm" style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}>
                <i className="fas fa-user"></i>
              </div>
              <span className="position-absolute bottom-0 end-0 p-2 bg-success border border-4 border-white rounded-circle" title="Online"></span>
            </div>
            
            <h4 className="fw-bold mb-1">{currentUser?.fullName || 'User Name'}</h4>
            <p className="text-muted small mb-3">@{currentUser?.username}</p>
            
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-success bg-opacity-10 text-success rounded-pill mb-3" style={{ fontSize: '0.85rem' }}>
              <i className="fas fa-shield-alt"></i> <span>Email Verified</span>
            </div>

            {/* 📊 USER RATING & PENALTY STATS */}
            <div className="row g-2 bg-light p-3 rounded-3 mb-4 text-start border">
              <div className="col-6">
                <div className="small text-muted fw-bold">RATING</div>
                <div className="fw-bold text-dark">
                  <i className="fas fa-star text-warning me-1"></i>
                  {currentUser?.rating || 5.0} ({currentUser?.reviewCount || 0})
                </div>
              </div>
              <div className="col-6">
                <div className="small text-muted fw-bold">CANCELLATIONS</div>
                <div className="fw-bold text-dark">
                  <i className="fas fa-ban text-danger me-1"></i>
                  {currentUser?.cancellationCount || 0}
                </div>
              </div>
              <div className="col-12 border-top pt-2 mt-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-muted fw-bold">PENALTY BALANCE</span>
                  <span className={`fw-bold ${currentUser?.penaltyBalance > 0 ? 'text-danger' : 'text-success'}`}>
                    ₹{currentUser?.penaltyBalance || 0}
                  </span>
                </div>
              </div>
            </div>

            <hr className="text-muted opacity-25 my-4" />

            <div className="text-start">
              <label className="small fw-bold text-muted mb-1">PHONE NUMBER VERIFICATION</label>
              
              {currentUser?.isPhoneVerified ? (
                <div className="alert alert-success py-2 d-flex align-items-center gap-2">
                  <i className="fas fa-check-circle text-success"></i>
                  <span className="fw-bold">{currentUser.phone}</span> (Verified)
                </div>
              ) : (
                <>
                  <div className="input-group mb-2">
                    <span className="input-group-text bg-light border-end-0"><i className="fas fa-phone text-muted"></i></span>
                    <input 
                      type="text" 
                      className="form-control bg-light border-start-0" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} 
                      placeholder="9876543210" 
                      maxLength="10" 
                    />
                    <button onClick={handleSendPhoneOtp} className="btn btn-dark">Verify</button>
                  </div>

                  {showPhoneOtpInput && (
                    <div className="animate-fade mt-2">
                      <div className="input-group mb-2">
                        <input 
                          type="text" 
                          className="form-control border-primary" 
                          value={phoneOtp} 
                          onChange={e => setPhoneOtp(e.target.value)} 
                          placeholder="Enter 6-digit OTP" 
                        />
                        <button onClick={handleVerifyPhoneOtp} disabled={isPhoneVerifying} className="btn btn-primary fw-bold">
                          {isPhoneVerifying ? 'Confirming...' : 'Confirm'}
                        </button>
                      </div>
                      <small className="text-muted fst-italic">OTP sent! Check VS Code / server terminal logs.</small>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Driver License (PaddleOCR) & Vehicle Info */}
        <div className="col-lg-8">
          <div className="d-flex flex-column gap-4">

            {rejectionNote.length > 0 && (
              <div className="alert alert-danger border-0 rounded-3 mb-4">
                <strong>Your application was not approved.</strong>
                {rejectionNote.map((n, i) => <div key={i} className="small mt-1">{n}</div>)}
                <div className="small mt-1">Correct the details and resubmit below.</div>
              </div>
            )}

            {/* 🪪 DRIVER LICENSE SECTION */}
            <div className="pro-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold m-0 text-dark">
                  <i className="fas fa-id-card text-primary me-2"></i> Driver License Verification
                </h5>
                <span className={`badge ${licStatus === 'verified' ? 'bg-success' : licStatus === 'rejected' ? 'bg-danger' : licStatus === 'none' ? 'bg-secondary' : 'bg-warning text-dark'} rounded-pill px-3 py-2`}>
                  {licStatus === 'verified' ? '✔ License Verified' : licStatus === 'rejected' ? '❌ Rejected' : licStatus === 'none' ? 'Not submitted' : '⏳ Pending Admin Review'}
                </span>
              </div>

              {license.isVerified && license.licenseNumber ? (
                <div className="bg-light p-3 rounded-3 border">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="small text-muted fw-bold">LICENSE NUMBER (DL)</div>
                      <div className="fs-5 fw-bold text-primary font-monospace">{license.licenseNumber}</div>
                    </div>
                    <div className="col-md-6">
                      <div className="small text-muted fw-bold">NAME ON LICENSE</div>
                      <div className="fw-bold">{license.nameOnLicense}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="small text-muted">Date of Birth</div>
                      <div className="fw-bold">{license.dob || 'N/A'}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="small text-muted">Valid Till</div>
                      <div className="fw-bold">{license.expiryDate || 'N/A'}</div>
                    </div>
                    <div className="col-md-4">
                      <div className="small text-muted">Vehicle Class</div>
                      <div className="fw-bold text-success">{license.cov || 'LMV'}</div>
                    </div>
                  </div>

                  {license.documentPath && (
                    <div className="mt-3 pt-3 border-top d-flex align-items-center justify-content-between">
                      <span className="small text-muted"><i className="fas fa-file-image me-1"></i> Document Uploaded</span>
                      <a href={license.documentPath} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm rounded-pill">
                        <i className="fas fa-external-link-alt me-1"></i> View License Image
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="alert alert-light border-start border-4 border-warning mb-3">
                  <div className="d-flex gap-3 align-items-center">
                    <i className="fas fa-exclamation-triangle fa-2x text-warning"></i>
                    <div>
                      <strong>No Driving License Verified Yet</strong>
                      <div className="small text-muted">Upload your license image to run instant verification and extract your credentials.</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3 text-end">
                <button onClick={onOpenLicenseModal} className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm">
                  <i className="fas fa-magic me-2"></i> {license.isVerified ? 'Re-scan Driver License' : 'Verify Driver License'}
                </button>
              </div>
            </div>

            {/* 🚗 VEHICLE REGISTRATION SECTION */}
            <div className="pro-card p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold m-0"><i className="fas fa-car text-primary me-2"></i>Vehicle Registration</h5>
                <div className="d-flex align-items-center gap-2">
                  <button onClick={handleManualRefresh} disabled={isRefreshing} className="btn btn-light btn-sm rounded-pill border px-3" title="Sync Status with Server">
                    <i className={`fas fa-sync-alt me-1 ${isRefreshing ? 'fa-spin' : ''}`}></i> Sync Status
                  </button>
                  <span className={`badge ${vehicleStatus === 'verified' ? 'bg-success' : vehicleStatus === 'rejected' ? 'bg-danger' : vehicleStatus === 'none' ? 'bg-secondary' : 'bg-warning text-dark'} rounded-pill px-3 py-2`}>
                    {vehicleStatus === 'verified' ? '✔ Approved' : vehicleStatus === 'rejected' ? '❌ Rejected' : vehicleStatus === 'none' ? 'Not Registered' : '⏳ Pending Admin Approval'}
                  </span>
                </div>
              </div>

              {/* Show Approved Vehicle Card if vehicle is verified */}
              {vehicle.isVerified && vehicle.model && !editVehicle ? (
                <div className="bg-light p-4 rounded-3 border border-success border-opacity-25 mb-3" style={{ background: '#f0fdf4' }}>
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="bg-success text-white rounded-circle p-3 fs-4">
                      <i className="fas fa-check-circle"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold text-dark m-0">Vehicle Approved & Verified</h5>
                      <span className="text-success small fw-bold"><i className="fas fa-shield-alt me-1"></i> You are authorized to offer rides on SwiftWheels!</span>
                    </div>
                  </div>

                  <div className="row g-3 bg-white p-3 rounded-3 border">
                    <div className="col-md-4">
                      <div className="small text-muted fw-bold">VEHICLE TYPE</div>
                      <div className="fw-bold text-dark">
                        <i className={`fas ${vehicle.type === 'Bike' ? 'fa-motorcycle' : 'fa-car'} me-2 text-primary`}></i>
                        {vehicle.type || 'Car'}
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="small text-muted fw-bold">VEHICLE MODEL</div>
                      <div className="fs-5 fw-bold text-primary">{vehicle.model}</div>
                    </div>

                    <div className="col-md-4">
                      <div className="small text-muted fw-bold">LICENSE PLATE</div>
                      <div className="font-monospace fw-bold bg-light p-2 rounded text-dark text-center" style={{ width: 'fit-content' }}>
                        {vehicle.plateNumber}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-end">
                    <button onClick={() => setEditVehicle(true)} className="btn btn-outline-secondary btn-sm rounded-pill">
                      <i className="fas fa-edit me-1"></i> Update Vehicle Details
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {vehicle.model && !vehicle.isVerified && (
                    <div className="alert alert-warning border-start border-4 border-warning mb-3">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <strong>⏳ Application Submitted for Admin Review</strong>
                          <div className="small text-muted">Vehicle: {vehicle.model} ({vehicle.plateNumber}). Once the Admin clicks Approve in the Admin Panel, your status will update automatically.</div>
                        </div>
                        <button onClick={handleManualRefresh} className="btn btn-dark btn-sm rounded-pill px-3 text-nowrap ms-2">
                          <i className="fas fa-sync-alt me-1"></i> Check Now
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleRegisterVehicle}>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label small fw-bold text-muted">VEHICLE TYPE</label>
                        <select className="form-select p-3" value={regType} onChange={e => setRegType(e.target.value)}>
                          <option value="Car">🚗 Car (Max 4 Passengers)</option>
                          <option value="Bike">🛵 Bike (Max 1 Passenger)</option>
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-muted">VEHICLE MODEL</label>
                        <input 
                          type="text" 
                          className="form-control p-3" 
                          value={regModel} 
                          onChange={e => setRegModel(e.target.value)} 
                          placeholder="e.g. Maruti Swift" 
                          required 
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold text-muted">LICENSE PLATE</label>
                        <input 
                          type="text" 
                          className="form-control p-3" 
                          value={regPlate} 
                          onChange={e => setRegPlate(e.target.value)} 
                          placeholder="e.g. MH 12 AB 9999" 
                          required 
                        />
                      </div>
                      <div className="col-12 mt-4 d-flex gap-2">
                        {editVehicle && (
                          <button type="button" onClick={() => setEditVehicle(false)} className="btn btn-light w-50 py-3 rounded-3 fw-bold border">
                            Cancel
                          </button>
                        )}
                        <button type="submit" disabled={isVehicleSubmitting} className="btn btn-primary w-100 py-3 rounded-3 fw-bold shadow-sm">
                          {isVehicleSubmitting ? 'Submitting Details...' : 'Submit Vehicle for Driver Status'}
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}

              <div className="mt-3 text-center text-muted small">
                <i className="fas fa-lock me-1"></i> Your details are securely stored and verified in MongoDB.
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
