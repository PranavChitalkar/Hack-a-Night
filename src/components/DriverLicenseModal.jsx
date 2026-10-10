import React, { useState } from 'react';

export default function DriverLicenseModal({ isOpen, onClose, currentUser, onLicenseVerified, showToast }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [documentPath, setDocumentPath] = useState('');
  
  // Editable fields for extracted data confirmation
  const [licenseNumber, setLicenseNumber] = useState('');
  const [nameOnLicense, setNameOnLicense] = useState('');
  const [dob, setDob] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cov, setCov] = useState('LMV');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.type.startsWith('image/')) {
        showToast("Please upload an image file (PNG, JPG, JPEG)", "warning");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setOcrData(null);
    }
  };

  const handleRunOcr = async () => {
    if (!file) {
      showToast("Please select a Driving License image first", "warning");
      return;
    }

    setIsProcessing(true);
    showToast("Reading your driving license...", "info");

    const formData = new FormData();
    formData.append('licenseImg', file);

    try {
      const res = await fetch('/api/driver/verify-license-ocr', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOcrData(data.licenseData);
        setDocumentPath(data.documentPath);

        // Pre-fill extracted fields
        setLicenseNumber(data.licenseData.licenseNumber || '');
        setNameOnLicense(data.licenseData.nameOnLicense || currentUser.fullName || '');
        setDob(data.licenseData.dob || '');
        setExpiryDate(data.licenseData.expiryDate || '');
        setCov(data.licenseData.cov || 'LMV');

        showToast("✨ License read successfully!", "success");
      } else {
        showToast(data.error || "Could not read the license. You can still enter the details manually.", "danger");
        if (data.documentPath) setDocumentPath(data.documentPath);
        // Default to manual entry mode if OCR couldn't detect text
        setOcrData({ rawOcrText: [] });
      }
    } catch (err) {
      showToast("Could not read the license. Please try again.", "danger");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveLicense = async (e) => {
    e.preventDefault();
    if (!licenseNumber || !nameOnLicense) {
      showToast("Please enter License Number and Name on License", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/driver/save-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          licenseNumber,
          nameOnLicense,
          dob,
          expiryDate,
          cov,
          documentPath,
          rawOcrText: ocrData?.rawOcrText || []
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("License submitted. An admin will review it.", "success");
        onLicenseVerified(data.user);
        onClose();
      } else {
        showToast(data.error || "Failed to save driver license to database", "danger");
      }
    } catch (err) {
      showToast("Network error saving driver license", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-header bg-primary text-white border-0 py-3">
            <h5 className="modal-title fw-bold">
              <i className="fas fa-id-card me-2"></i> Driver License Verification
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            <div className="alert alert-info border-0 rounded-3 mb-4 d-flex align-items-center gap-3" style={{ background: '#ecfdf5', color: '#047857' }}>
              <i className="fas fa-id-card fa-2x"></i>
              <div className="small">
                <strong>License Check:</strong> Upload your driving license image. The details will be read automatically, including your Driving License number, Name, Date of Birth, and Expiry date for database verification.
              </div>
            </div>

            <div className="row g-4">
              <div className="col-md-5">
                <label className="form-label small fw-bold text-muted text-uppercase">1. Select License Document</label>
                
                <div 
                  className="license-dropzone" 
                  onClick={() => document.getElementById('license-file-input').click()}
                >
                  <i className="fas fa-cloud-upload-alt fa-3x text-primary mb-2"></i>
                  <h6 className="fw-bold text-dark m-0">Click to Upload Image</h6>
                  <small className="text-muted">Supports JPG, PNG, WEBP (Max 10MB)</small>
                  <input 
                    type="file" 
                    id="license-file-input" 
                    className="d-none" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                </div>

                {previewUrl && (
                  <div className="mt-3 text-center">
                    <img src={previewUrl} alt="License Preview" className="img-fluid rounded-3 border shadow-sm" style={{ maxHeight: '180px', objectFit: 'contain' }} />
                    <div className="small text-muted mt-1">{file?.name}</div>
                  </div>
                )}

                <button 
                  onClick={handleRunOcr} 
                  disabled={!file || isProcessing} 
                  className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm mt-3"
                >
                  {isProcessing ? (
                    <span><i className="fas fa-spinner fa-spin me-2"></i> Scanning License...</span>
                  ) : (
                    <span><i className="fas fa-magic me-2"></i> Extract License Details</span>
                  )}
                </button>
              </div>

              <div className="col-md-7">
                <label className="form-label small fw-bold text-muted text-uppercase">2. Extracted License Details (Confirm & Save)</label>
                
                <form onSubmit={handleSaveLicense}>
                  <div className="ocr-result-card mb-3">
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-muted">LICENSE NUMBER (DL NO)</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light"><i className="fas fa-hashtag text-primary"></i></span>
                        <input 
                          type="text" 
                          className="form-control fw-bold" 
                          value={licenseNumber} 
                          onChange={e => setLicenseNumber(e.target.value.toUpperCase())} 
                          placeholder="e.g. MH1220210012345" 
                          required 
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold text-muted">FULL NAME ON LICENSE</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light"><i className="fas fa-user text-primary"></i></span>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={nameOnLicense} 
                          onChange={e => setNameOnLicense(e.target.value)} 
                          placeholder="Holder Name" 
                          required 
                        />
                      </div>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <label className="form-label small fw-bold text-muted">DATE OF BIRTH</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={dob} 
                          onChange={e => setDob(e.target.value)} 
                          placeholder="DD/MM/YYYY" 
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-bold text-muted">VALID TILL / EXPIRY</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={expiryDate} 
                          onChange={e => setExpiryDate(e.target.value)} 
                          placeholder="DD/MM/YYYY" 
                        />
                      </div>
                    </div>

                    <div className="mb-2">
                      <label className="form-label small fw-bold text-muted">CLASS OF VEHICLE (COV)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={cov} 
                        onChange={e => setCov(e.target.value)} 
                        placeholder="LMV / MCWG" 
                      />
                    </div>
                  </div>

                  {ocrData?.rawOcrText?.length > 0 && (
                    <div className="mb-3">
                      <label className="small fw-bold text-muted text-uppercase mb-1">Extracted Document Text:</label>
                      <div className="bg-light p-2 rounded-3 small font-monospace" style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem' }}>
                        {ocrData.rawOcrText.join(' | ')}
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>Cancel</button>
                    <button type="submit" disabled={isSaving || !licenseNumber} className="btn btn-success rounded-pill px-4 fw-bold shadow-sm">
                      {isSaving ? 'Submitting...' : 'Submit for Admin Review 🔒'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
