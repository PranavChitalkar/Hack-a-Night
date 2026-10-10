import React from 'react';

export default function ServicesSection() {
  return (
    <section id="services" className="py-5 bg-white">
      <div className="container py-5">
        <div className="text-center mb-5">
          <h2 className="fw-bold">Why Choose Us?</h2>
          <p className="text-muted">We make your journey smoother and smarter.</p>
        </div>
        <div className="row g-4">
          <div className="col-md-4">
            <div className="step-card h-100 p-4">
              <i className="fas fa-wallet fa-3x text-primary mb-4"></i>
              <h4>Save Money</h4>
              <p className="text-muted">Cut your travel costs by up to 50% by sharing fuel expenses with co-passengers.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="step-card h-100 p-4">
              <i className="fas fa-leaf fa-3x text-success mb-4"></i>
              <h4>Eco Friendly</h4>
              <p className="text-muted">Fewer cars on the road means less CO2. Do your part for the environment.</p>
            </div>
          </div>
          <div className="col-md-4">
            <div className="step-card h-100 p-4">
              <i className="fas fa-id-card fa-3x text-info mb-4"></i>
              <h4>Automatic License Check</h4>
              <p className="text-muted">Safety first. Drivers upload a photo of their license, and an admin approves it along with their vehicle. Email and phone OTP confirm accounts.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
