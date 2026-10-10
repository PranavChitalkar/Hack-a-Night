import React from 'react';

export default function Navbar({ currentUser, activeView, setActiveView, onOpenAuthModal, onLogout, toggleMobileSidebar, isAdminView, onToggleAdminView }) {
  return (
    <nav className="navbar navbar-expand-lg navbar-glass">
      <div className="container">
        <button className="btn d-lg-none" id="mobile-toggle" style={{ fontSize: '1.5rem', color: 'var(--primary)' }} onClick={toggleMobileSidebar}>
          <i className="fas fa-bars"></i>
        </button>
        
        <a className="navbar-brand fw-bold fs-4" href="#" onClick={(e) => { e.preventDefault(); setActiveView('landing'); }}>
          <i className="fas fa-car-side text-primary me-2"></i> SwiftWheels
        </a>

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-center gap-3">
            {activeView === 'landing' && (
              <>
                <li className="nav-item"><a className="nav-link text-dark" href="#home">Home</a></li>
                <li className="nav-item"><a className="nav-link text-dark" href="#services">Services</a></li>
                <li className="nav-item"><a className="nav-link text-dark" href="#how-it-works">How to Use</a></li>
                <li className="nav-item"><a className="nav-link text-dark" href="#contact-section">Contact</a></li>
              </>
            )}

            {currentUser && (
              <li className="nav-item">
                <button 
                  className={`btn btn-sm ${activeView === 'landing' ? 'btn-outline-primary' : 'btn-primary'} rounded-pill px-3`}
                  onClick={() => setActiveView(activeView === 'landing' ? 'market' : 'landing')}
                >
                  <i className={`fas ${activeView === 'landing' ? 'fa-tachometer-alt' : 'fa-home'} me-2`}></i>
                  {activeView === 'landing' ? 'Go to App' : 'Home Page'}
                </button>
              </li>
            )}

            {!currentUser ? (
              <li className="nav-item d-flex gap-2">
                <button onClick={() => onOpenAuthModal('login')} className="btn btn-outline-primary px-4 rounded-pill">Sign In</button>
                <button onClick={() => onOpenAuthModal('register')} className="btn btn-primary px-4 rounded-pill shadow-sm">Get Started</button>
              </li>
            ) : (
              <li className="nav-item">
                <div className="dropdown">
                  <button className="btn btn-light rounded-pill dropdown-toggle px-3" type="button" data-bs-toggle="dropdown">
                    <i className="fas fa-user-circle me-2 text-primary"></i> 
                    <span>{currentUser.fullName || currentUser.username}</span>
                    {currentUser.isAdmin && <span className="badge bg-danger ms-2" style={{ fontSize: '0.65rem' }}>ADMIN</span>}
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end border-0 shadow-lg p-2">
                    <li><button className="dropdown-item rounded" onClick={() => setActiveView('market')}>Marketplace</button></li>
                    <li><button className="dropdown-item rounded" onClick={() => setActiveView('dispatch')}><i className="fas fa-route me-2 text-success"></i> Route & Fare Planner</button></li>
                    <li><button className="dropdown-item rounded" onClick={() => setActiveView('profile')}>My Profile & Verification</button></li>
                    {currentUser.isAdmin && (
                      <>
                        <li><hr className="dropdown-divider" /></li>
                        <li>
                          <button className="dropdown-item rounded fw-bold text-primary" onClick={() => setActiveView('admin')}>
                            <i className="fas fa-shield-alt me-2"></i> Admin Panel
                          </button>
                        </li>
                      </>
                    )}
                    <li><hr className="dropdown-divider" /></li>
                    <li><button className="dropdown-item rounded text-danger" onClick={onLogout}><i className="fas fa-sign-out-alt me-2"></i> Sign Out</button></li>
                  </ul>
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
