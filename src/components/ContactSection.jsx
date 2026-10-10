import React, { useState } from 'react';

export default function ContactSection({ showToast }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Feedback sent successfully!', 'success');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        showToast(data.error || 'Failed to send feedback', 'danger');
      }
    } catch (err) {
      showToast('Network error while sending feedback', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact-section" className="py-5 bg-white">
      <div className="container py-4">
        <div className="row align-items-center g-5">
          <div className="col-md-6">
            <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill fw-bold small text-uppercase mb-3">Help & Support</span>
            <h2 className="fw-bold display-6 mb-3 text-dark">Get in Touch</h2>
            <p className="text-muted mb-4">Have a question or feedback? We'd love to hear from you. Fill out the form and we'll get back to you within 24 hours.</p>
            
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="step-icon mb-0" style={{ width: '50px', height: '50px', fontSize: '1.2rem' }}>
                <i className="fas fa-envelope"></i>
              </div>
              <div>
                <h6 className="fw-bold m-0">Email Us</h6>
                <small className="text-muted">support@swiftwheels.com</small>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="step-card p-4 border-0 shadow-lg bg-light" style={{ background: '#f0fdf4' }}>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-uppercase text-muted">Your Name</label>
                  <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-uppercase text-muted">Email Address</label>
                  <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold text-uppercase text-muted">Message</label>
                  <textarea className="form-control" rows="4" value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help?" required></textarea>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm">
                  {loading ? (
                    <span><i className="fas fa-spinner fa-spin me-2"></i> Sending...</span>
                  ) : (
                    <span><i className="fas fa-paper-plane me-2"></i> Send Message</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
