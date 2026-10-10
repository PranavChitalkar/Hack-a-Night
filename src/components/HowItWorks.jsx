import React from 'react';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-5 bg-light">
      <div className="container py-5 my-5">
        <div className="text-center mb-5">
          <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill fw-bold small text-uppercase mb-3">Simple Process</span>
          <h2 className="fw-bold text-dark display-6">Ride in 3 Easy Steps</h2>
          <p className="text-muted">Join the eco-friendly revolution today.</p>
        </div>

        <div className="row g-4 steps-container position-relative">
          <div className="col-lg-4 text-center">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">
                <i className="fas fa-search"></i>
              </div>
              <h4 className="fw-bold mb-3">Search</h4>
              <p className="text-muted small">Enter your pickup and drop location to find drivers going your way instantly.</p>
            </div>
          </div>

          <div className="col-lg-4 text-center">
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">
                <i className="fas fa-mouse-pointer"></i>
              </div>
              <h4 className="fw-bold mb-3">Book</h4>
              <p className="text-muted small">Select a ride based on rating, car type, and price. Request a seat in one click.</p>
            </div>
          </div>

          <div className="col-lg-4 text-center">
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">
                <i className="fas fa-route"></i>
              </div>
              <h4 className="fw-bold mb-3">Travel</h4>
              <p className="text-muted small">Meet your driver, enjoy the affordable ride, and pay securely via UPI.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
