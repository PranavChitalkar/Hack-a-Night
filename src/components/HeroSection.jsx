import React from 'react';

export default function HeroSection({ currentUser, onOpenAuthModal, onGoToApp }) {
  return (
    <section id="home" className="hero-section">
      <div className="hero-blob"></div>
      <div className="container position-relative z-1">
        <div className="row align-items-center">
          <div className="col-lg-6">
            <span className="badge bg-white text-primary shadow-sm px-3 py-2 rounded-pill mb-3">🚀 The #1 Carpooling App</span>
            <h1 className="display-3 fw-bold lh-sm mb-4">Travel Together.<br/><span className="text-gradient" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Save the Planet.</span></h1>
            <p className="lead text-secondary mb-5">Connect with verified drivers and passengers. Save money on fuel, reduce traffic, and make your commute eco-friendly.</p>
            <div className="d-flex gap-3">
              {currentUser ? (
                <button onClick={onGoToApp} className="btn btn-primary btn-lg rounded-pill px-5 py-3 shadow">Launch App 🚀</button>
              ) : (
                <button onClick={() => onOpenAuthModal('register')} className="btn btn-primary btn-lg rounded-pill px-5 py-3 shadow">Join Now</button>
              )}
              <a href="#how-it-works" className="btn btn-outline-dark btn-lg rounded-pill px-5 py-3">Learn More</a>
            </div>
          </div>
          <div className="col-lg-6 mt-5 mt-lg-0 text-center">
            <img src="https://cdni.iconscout.com/illustration/premium/thumb/car-pooling-illustration-download-in-svg-png-gif-file-formats--sharing-ride-share-service-transportation-urban-mobility-pack-vehicle-illustrations-4609653.png" alt="Carpool" className="img-fluid" style={{ maxWidth: '90%' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
