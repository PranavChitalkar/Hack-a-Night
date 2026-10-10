import React, { useState } from 'react';

export default function AuthModal({ isOpen, mode, onClose, onLoginSuccess, onRegisterSuccess, showToast }) {
  const [activeTab, setActiveTab] = useState(mode || 'login');
  
  // Login State
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  
  // Register State
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  // Driver License OCR Upload on Registration
  const [isDriverAccount, setIsDriverAccount] = useState(false);
  const [licenseFile, setLicenseFile] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [extractedLicense, setExtractedLicense] = useState(null);

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUser || !loginPass) {
      showToast("Please enter username and password", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        showToast("Welcome back, " + (data.user.fullName || data.user.username) + "!", "success");
        onLoginSuccess(data.user);
        onClose();
      } else {
        showToast(data.error || "Login failed", "danger");
      }
    } catch (err) {
      showToast("Network error during login", "danger");
    } finally {
      setLoading(false);
    }
  };

  const handleLicenseFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLicenseFile(file);
    setOcrScanning(true);
    showToast("Reading your license...", "info");

    const formData = new FormData();
    formData.append('licenseImg', file);

    try {
      const res = await fetch('/api/driver/verify-license-ocr', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setExtractedLicense({
          licenseNumber: data.licenseData.licenseNumber,
          nameOnLicense: data.licenseData.nameOnLicense,
          dob: data.licenseData.dob,
          expiryDate: data.licenseData.expiryDate,
          cov: data.licenseData.cov,
          documentPath: data.documentPath,
          rawOcrText: data.licenseData.rawOcrText
        });
        showToast("✨ License read successfully!", "success");
      } else {
        showToast(data.error || "Could not read license image", "warning");
      }
    } catch (err) {
      showToast("Could not read the license. Try a clearer photo.", "danger");
    } finally {
      setOcrScanning(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName || !regUser || !regEmail || !regPass) {
      showToast("Please fill in all registration fields", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: regName, username: regUser, email: regEmail, password: regPass })
      });
      const data = await res.json();

      if (res.ok || data.isDemo) {
        setOtpEmail(regEmail);
        
        // If driver license was scanned during account creation, save it to DB
        if (extractedLicense && regUser) {
          await fetch('/api/driver/save-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: regUser,
              licenseNumber: extractedLicense.licenseNumber,
              nameOnLicense: extractedLicense.nameOnLicense,
              dob: extractedLicense.dob,
              expiryDate: extractedLicense.expiryDate,
              cov: extractedLicense.cov,
              documentPath: extractedLicense.documentPath,
              rawOcrText: extractedLicense.rawOcrText
            })
          });
        }

        if (data.isDemo && data.otp) {
          showToast(`Demo Mode: Email OTP is ${data.otp}`, "warning");
          setOtpInput(data.otp);
        } else {
          showToast("OTP sent to your email!", "info");
        }
        setActiveTab('otp');
      } else {
        showToast(data.error || "Registration failed", "danger");
      }
    } catch (err) {
      showToast("Network error during registration", "danger");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpInput) {
      showToast("Please enter OTP code", "warning");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, otp: otpInput })
      });
      const data = await res.json();

      if (res.ok) {
        showToast("Account Verified! Please login.", "success");
        setActiveTab('login');
        setLoginUser(regUser || '');
      } else {
        showToast(data.error || "Invalid OTP code", "danger");
      }
    } catch (err) {
      showToast("Verification failed", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg p-3 rounded-4">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              {activeTab === 'login' ? 'Sign In' : activeTab === 'register' ? 'Create Account' : 'Verify Email'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-3">
            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="form-floating mb-3">
                  <input type="text" className="form-control" value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="User" required />
                  <label>Username</label>
                </div>
                <div className="form-floating mb-3">
                  <input type="password" className="form-control" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Pass" required />
                  <label>Password</label>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm">
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                <div className="text-center mt-3">
                  <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('register'); }} className="text-decoration-none text-primary fw-bold">
                    Don't have an account? Create Account
                  </a>
                </div>
              </form>
            )}

            {activeTab === 'register' && (
              <form onSubmit={handleRegister}>
                <input type="text" className="form-control mb-2 p-3" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Full Name" required />
                <input type="text" className="form-control mb-2 p-3" value={regUser} onChange={e => setRegUser(e.target.value)} placeholder="Username" required />
                <input type="email" className="form-control mb-2 p-3" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Email Address" required />
                <input type="password" className="form-control mb-3 p-3" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="Password" required />

                {/* Driver License OCR Upload Checkbox & Card */}
                <div className="form-check mb-3 bg-light p-3 rounded-3 border">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="driverCheck" 
                    checked={isDriverAccount} 
                    onChange={e => setIsDriverAccount(e.target.checked)} 
                  />
                  <label className="form-check-label fw-bold text-dark small" htmlFor="driverCheck">
                    <i className="fas fa-id-card text-primary me-1"></i> Register as a driver (upload your license)
                  </label>

                  {isDriverAccount && (
                    <div className="mt-3 pt-2 border-top">
                      <label className="small fw-bold text-muted mb-1">UPLOAD DRIVING LICENSE IMAGE</label>
                      <input 
                        type="file" 
                        className="form-control form-control-sm" 
                        accept="image/*" 
                        onChange={handleLicenseFileSelect} 
                      />

                      {ocrScanning && (
                        <div className="small text-primary mt-2">
                          <i className="fas fa-spinner fa-spin me-1"></i> Reading your license...
                        </div>
                      )}

                      {extractedLicense && (
                        <div className="alert alert-success py-2 mt-2 mb-0 small">
                          <div><strong>✔ License detected</strong></div>
                          <div>DL No: <span className="font-monospace fw-bold">{extractedLicense.licenseNumber || 'Detected'}</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading} className="btn btn-success w-100 py-3 rounded-pill fw-bold shadow-sm">
                  {loading ? 'Creating Account...' : 'Sign Up & Send OTP'}
                </button>
                <div className="text-center mt-3">
                  <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('login'); }} className="text-decoration-none">
                    Already registered? Back to Login
                  </a>
                </div>
              </form>
            )}

            {activeTab === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="text-center py-2">
                <div className="mb-3"><i className="fas fa-envelope-open-text fa-3x text-primary"></i></div>
                <h5>Verify Email Address</h5>
                <p className="text-muted small">Enter the 6-digit OTP code sent to <strong>{otpEmail}</strong></p>
                <input 
                  type="text" 
                  className="form-control text-center fs-4 letter-spacing-2 mb-3 border-primary" 
                  value={otpInput} 
                  onChange={e => setOtpInput(e.target.value)} 
                  placeholder="000 000" 
                  required 
                />
                <button type="submit" disabled={loading} className="btn btn-dark w-100 py-3 rounded-pill fw-bold">
                  {loading ? 'Verifying...' : 'Verify Email & Complete'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
