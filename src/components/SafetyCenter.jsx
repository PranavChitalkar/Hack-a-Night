import React, { useState, useEffect } from 'react';

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say (explicit)' }
];

const emptyContact = { name: '', phone: '', email: '' };

export default function SafetyCenter({ currentUser, showToast }) {
  const [gender, setGender] = useState('');
  const [contacts, setContacts] = useState([{ ...emptyContact }]);
  const [saving, setSaving] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    fetch(`/api/safety/${currentUser.username}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setGender(data.gender || '');
          setContacts(data.emergencyContacts && data.emergencyContacts.length
            ? data.emergencyContacts.map(c => ({ name: c.name, phone: c.phone, email: c.email || '' }))
            : [{ ...emptyContact }]);
        }
      })
      .catch(() => {});

    // Find an accepted, upcoming booking for the SOS and trip-share features
    fetch(`/api/requests/passenger/${currentUser.username}`)
      .then(r => r.json())
      .then(data => {
        const accepted = (data.requests || []).find(r => r.status === 'accepted');
        setActiveBooking(accepted || null);
      })
      .catch(() => {});
  }, [currentUser]);

  const updateContact = (i, field, value) => {
    setContacts(prev => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/safety/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, gender, emergencyContacts: contacts.filter(c => c.name || c.phone || c.email) })
      });
      const data = await res.json();
      if (res.ok && data.success) showToast('Safety settings saved', 'success');
      else showToast(data.error || 'Could not save safety settings', 'danger');
    } catch (err) {
      showToast('Network error saving safety settings', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const sendSos = () => {
    if (!confirm('Send an SOS alert now? Admin and your emergency contacts with email will be notified with your location if you allow it.')) return;
    setSosBusy(true);
    const send = (coords) => {
      fetch('/api/safety/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          requestId: activeBooking ? activeBooking._id : undefined,
          lat: coords ? coords.lat : undefined,
          lon: coords ? coords.lon : undefined
        })
      })
        .then(r => r.json())
        .then(data => {
          setSosResult(data);
          showToast(data.success ? 'SOS sent. Call 112 if you are in danger.' : (data.error || 'SOS failed'), data.success ? 'warning' : 'danger');
        })
        .catch(() => showToast('Could not send SOS. Call 112 directly.', 'danger'))
        .finally(() => setSosBusy(false));
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => send({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => send(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      send(null);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="pro-card p-4 bg-white border-0 shadow-sm h-100">
          <h5 className="fw-bold mb-1"><i className="fas fa-user-shield text-primary me-2"></i>Your Safety Profile</h5>
          <p className="small text-muted mb-4">Used for women-only rides and for alerts you send.</p>

          <form onSubmit={saveSettings}>
            <label className="small fw-bold text-muted">GENDER</label>
            <select className="form-select mb-4" value={gender} onChange={e => setGender(e.target.value)}>
              {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <label className="small fw-bold text-muted mb-2">EMERGENCY CONTACTS (UP TO 3)</label>
            {contacts.map((c, i) => (
              <div key={i} className="border rounded-3 p-3 mb-3 bg-light">
                <div className="row g-2">
                  <div className="col-md-6">
                    <input className="form-control form-control-sm" placeholder="Name" value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <input className="form-control form-control-sm" placeholder="Phone (10 digits)" value={c.phone} onChange={e => updateContact(i, 'phone', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <input className="form-control form-control-sm" type="email" placeholder="Email (optional, receives SOS alerts)" value={c.email} onChange={e => updateContact(i, 'email', e.target.value)} />
                  </div>
                </div>
                {contacts.length > 1 && (
                  <button type="button" className="btn btn-link btn-sm text-danger p-0 mt-2" onClick={() => setContacts(prev => prev.filter((_, idx) => idx !== i))}>Remove</button>
                )}
              </div>
            ))}
            {contacts.length < 3 && (
              <button type="button" className="btn btn-outline-primary btn-sm rounded-pill mb-4" onClick={() => setContacts(prev => [...prev, { ...emptyContact }])}>
                + Add contact
              </button>
            )}

            <button type="submit" disabled={saving} className="btn btn-primary w-100 rounded-pill py-2 fw-bold">
              {saving ? 'Saving...' : 'Save Safety Settings'}
            </button>
          </form>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="pro-card p-4 bg-white border-0 shadow-sm mb-4">
          <h5 className="fw-bold mb-1 text-danger"><i className="fas fa-exclamation-triangle me-2"></i>Emergency SOS</h5>
          <p className="small text-muted mb-3">
            Sends an alert to the SwiftWheels admin team and to contacts who have an email address, with your location if you allow it.
            Contacts without email are not notified automatically, so call them yourself.
          </p>
          <button onClick={sendSos} disabled={sosBusy} className="btn btn-danger w-100 rounded-pill py-3 fw-bold shadow-sm mb-3">
            <i className="fas fa-bell me-2"></i> {sosBusy ? 'Sending alert...' : 'Send SOS Alert'}
          </button>
          <div className="row g-2 text-center">
            <div className="col-6">
              <div className="p-3 rounded-3 bg-light border">
                <div className="small text-muted fw-bold">EMERGENCY (INDIA)</div>
                <div className="fs-4 fw-bold text-danger">112</div>
              </div>
            </div>
            <div className="col-6">
              <div className="p-3 rounded-3 bg-light border">
                <div className="small text-muted fw-bold">WOMEN'S HELPLINE</div>
                <div className="fs-4 fw-bold text-danger">1091</div>
              </div>
            </div>
          </div>
          {sosResult && sosResult.success && (
            <div className="alert alert-warning mt-3 mb-0 small">
              {sosResult.message} {sosResult.notified > 0 ? `${sosResult.notified} email alert(s) sent.` : ''}
              {sosResult.contactsWithoutEmail > 0 ? ` ${sosResult.contactsWithoutEmail} contact(s) have no email, so call them directly.` : ''}
            </div>
          )}
        </div>

        <div className="pro-card p-4 bg-white border-0 shadow-sm">
          <h6 className="fw-bold mb-2"><i className="fas fa-lightbulb text-warning me-2"></i>Safety tips</h6>
          <ul className="small text-muted mb-0 ps-3">
            <li>Check the driver's name, vehicle model and plate before getting in.</li>
            <li>Share your trip link with someone you trust (from My Trips) before you travel.</li>
            <li>Stay in public, well-lit pickup points, and tell someone when you arrive.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
