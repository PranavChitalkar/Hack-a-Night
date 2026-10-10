import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import ServicesSection from './components/ServicesSection';
import HowItWorks from './components/HowItWorks';
import ContactSection from './components/ContactSection';
import Marketplace from './components/Marketplace';
import PostRide from './components/PostRide';
import DriverDashboard from './components/DriverDashboard';
import MyTrips from './components/MyTrips';
import Profile from './components/Profile';
import DriverLicenseModal from './components/DriverLicenseModal';
import AdminDashboard from './components/AdminDashboard';
import DispatchEngine from './components/DispatchEngine';
import AuthModal from './components/AuthModal';
import BookingModal from './components/BookingModal';
import PaymentModal from './components/PaymentModal';
import LiveTrackingModal from './components/LiveTrackingModal';
import Toast from './components/Toast';
import SafetyCenter from './components/SafetyCenter';
import PoolBoard from './components/PoolBoard';
import TripShare from './components/TripShare';

import './style.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user') || localStorage.getItem('carpoolUser');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [activeView, setActiveView] = useState('landing');
  const [rides, setRides] = useState([]);
  
  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedRideForBooking, setSelectedRideForBooking] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedReqForPayment, setSelectedReqForPayment] = useState(null);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedRideForTracking, setSelectedRideForTracking] = useState(null);

  const [mobileSidebarActive, setMobileSidebarActive] = useState(false);
  const [toastInfo, setToastInfo] = useState(null);

  const showToast = (message, type = 'primary') => {
    setToastInfo({ message, type });
  };

  // Fetch all rides
  const loadRides = async () => {
    try {
      const res = await fetch('/api/rides');
      const data = await res.json();
      if (Array.isArray(data)) setRides(data);
      else if (data.success && Array.isArray(data.rides)) setRides(data.rides);
    } catch (err) {
      console.error("Load rides error:", err);
    }
  };

  // Refresh current user profile from database
  const refreshCurrentUser = async () => {
    if (!currentUser?.username) return;
    try {
      const res = await fetch(`/api/user/me/${currentUser.username}`);
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  useEffect(() => {
    loadRides();
    if (currentUser?.username) {
      refreshCurrentUser();
    }
  }, []);

  useEffect(() => {
    if (currentUser?.username && activeView !== 'landing') {
      refreshCurrentUser();
    }
  }, [activeView]);

  // Update user profile
  const handleUserUpdated = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('user', JSON.stringify(user));
    if (user.isAdmin) {
      setActiveView('admin');
    } else {
      setActiveView('market');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('carpoolUser');
    setActiveView('landing');
    showToast("Signed out successfully", "info");
  };

  const handleSearchRides = async (query) => {
    if (!query) {
      loadRides();
      return;
    }
    try {
      const res = await fetch(`/api/rides/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      const found = Array.isArray(data) ? data : (data.rides || []);
      setRides(found);
      showToast(`Found ${found.length} ride${found.length === 1 ? '' : 's'} matching "${query}"`, "info");
    } catch (err) {
      showToast("Search failed", "danger");
    }
  };

  const handlePublishRide = async (ridePayload) => {
    try {
      const res = await fetch('/api/rides/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ridePayload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("🚀 Ride published successfully!", "success");
        loadRides();
        setActiveView('market');
      } else {
        showToast(data.error || "Failed to publish ride", "danger");
      }
    } catch (err) {
      showToast("Error creating ride", "danger");
    }
  };

  const handleConfirmBooking = async (ride, pickupSpot, coords) => {
    if (!currentUser) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: ride._id,
          passengerUsername: currentUser.username,
          pickupSpot,
          pickupLat: coords ? coords.lat : undefined,
          pickupLon: coords ? coords.lon : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("✔ Booking request sent to driver!", "success");
        setActiveView('trips');
      } else {
        showToast(data.error || "Booking request failed", "danger");
      }
    } catch (err) {
      showToast("Network error submitting booking", "danger");
    }
  };

  // Public trip-share page: /share/<token>
  const shareMatch = window.location.pathname.match(/^\/share\/([a-f0-9]{32})$/);
  if (shareMatch) {
    return <div className="py-4 bg-light min-vh-100"><TripShare token={shareMatch[1]} /></div>;
  }

  return (
    <div>
      <Navbar 
        currentUser={currentUser}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAuthModal={(m) => { setAuthModalMode(m); setAuthModalOpen(true); }}
        onLogout={handleLogout}
        toggleMobileSidebar={() => setMobileSidebarActive(!mobileSidebarActive)}
      />

      {/* Landing Page View */}
      {activeView === 'landing' && (
        <div id="landing-page">
          <HeroSection 
            currentUser={currentUser}
            onOpenAuthModal={(m) => { setAuthModalMode(m); setAuthModalOpen(true); }}
            onGoToApp={() => setActiveView('market')}
          />
          <ServicesSection />
          <HowItWorks />
          <ContactSection showToast={showToast} />
          
          <footer className="bg-dark text-white py-4 text-center">
            <div className="container">
              <p className="m-0">&copy; 2026 SwiftWheels Inc. All Rights Reserved.</p>
            </div>
          </footer>
        </div>
      )}

      {/* Main App Dashboard (When activeView !== 'landing') */}
      {activeView !== 'landing' && (
        <div className="dashboard-container">
          {/* Sidebar */}
          <div className={`sidebar ${mobileSidebarActive ? 'active' : ''}`}>
            <h6 className="text-uppercase text-muted fw-bold small mb-3 ps-3">Menu</h6>
            <div className="nav flex-column">
              <a className={`nav-link ${activeView === 'market' ? 'active' : ''}`} onClick={() => { setActiveView('market'); setMobileSidebarActive(false); }}>
                <i className="fas fa-globe me-2"></i> Marketplace
              </a>
              <a className={`nav-link ${activeView === 'dispatch' ? 'active' : ''}`} onClick={() => { setActiveView('dispatch'); setMobileSidebarActive(false); }}>
                <i className="fas fa-route me-2 text-success"></i> Route & Fare Planner
              </a>
              <a className={`nav-link ${activeView === 'post' ? 'active' : ''}`} onClick={() => { setActiveView('post'); setMobileSidebarActive(false); }}>
                <i className="fas fa-plus-circle me-2"></i> Post Ride
              </a>
              <a className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveView('dashboard'); setMobileSidebarActive(false); }}>
                <i className="fas fa-tachometer-alt me-2"></i> Driver Dashboard
              </a>
              <a className={`nav-link ${activeView === 'trips' ? 'active' : ''}`} onClick={() => { setActiveView('trips'); setMobileSidebarActive(false); }}>
                <i className="fas fa-ticket-alt me-2"></i> My Trips
              </a>
              <a className={`nav-link ${activeView === 'pool' ? 'active' : ''}`} onClick={() => { setActiveView('pool'); setMobileSidebarActive(false); }}>
                <i className="fas fa-users me-2 text-primary"></i> Shared Rides
              </a>
              <a className={`nav-link ${activeView === 'safety' ? 'active' : ''}`} onClick={() => { setActiveView('safety'); setMobileSidebarActive(false); }}>
                <i className="fas fa-user-shield me-2 text-danger"></i> Safety Center
              </a>
              <a className={`nav-link ${activeView === 'profile' ? 'active' : ''}`} onClick={() => { setActiveView('profile'); setMobileSidebarActive(false); }}>
                <i className="fas fa-user-cog me-2"></i> Profile & Verification
              </a>
              {currentUser?.isAdmin && (
                <a className={`nav-link ${activeView === 'admin' ? 'active' : ''}`} onClick={() => { setActiveView('admin'); setMobileSidebarActive(false); }}>
                  <i className="fas fa-shield-alt me-2"></i> Admin Panel
                </a>
              )}
            </div>
            
            <div className="mt-auto p-3 border-top">
              <button onClick={handleLogout} className="btn btn-outline-danger w-100 btn-sm rounded-pill">Sign Out</button>
            </div>
          </div>

          {/* Main Content Pane */}
          <div className="main-content">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3 className="fw-bold m-0 text-capitalize">{activeView === 'market' ? 'Marketplace' : activeView === 'dispatch' ? 'Route & Fare Planner' : activeView === 'post' ? 'Offer a Ride' : activeView === 'dashboard' ? 'Driver Dashboard' : activeView === 'trips' ? 'My Trips' : activeView === 'profile' ? 'User Profile & Verification' : activeView === 'safety' ? 'Safety Center' : activeView === 'pool' ? 'Shared Rides' : 'Admin Control Center'}</h3>
              <span className="badge bg-white text-dark border px-3 py-2 rounded-pill">
                <i className="fas fa-user me-1 text-primary"></i> {currentUser?.fullName || currentUser?.username}
              </span>
            </div>

            {activeView === 'market' && (
              <Marketplace 
                currentUser={currentUser}
                rides={rides}
                onSearch={handleSearchRides}
                onLoadRides={loadRides}
                onBookRide={(ride) => { setSelectedRideForBooking(ride); setBookingModalOpen(true); }}
                onOpenTracking={(ride) => { setSelectedRideForTracking(ride); setTrackingModalOpen(true); }}
              />
            )}

            {activeView === 'dispatch' && (
              <DispatchEngine showToast={showToast} />
            )}

            {activeView === 'post' && (
              <PostRide 
                currentUser={currentUser}
                onPublishRide={handlePublishRide}
                onRefreshProfile={refreshCurrentUser}
                showToast={showToast}
              />
            )}

            {activeView === 'dashboard' && (
              <DriverDashboard 
                currentUser={currentUser}
                showToast={showToast}
              />
            )}

            {activeView === 'trips' && (
              <MyTrips 
                currentUser={currentUser}
                onOpenPayment={(req) => { setSelectedReqForPayment(req); setPaymentModalOpen(true); }}
                showToast={showToast}
              />
            )}

            {activeView === 'pool' && (
              <PoolBoard currentUser={currentUser} showToast={showToast} />
            )}

            {activeView === 'safety' && (
              <SafetyCenter currentUser={currentUser} showToast={showToast} />
            )}

            {activeView === 'profile' && (
              <Profile 
                currentUser={currentUser}
                onUserUpdated={handleUserUpdated}
                onRefreshProfile={refreshCurrentUser}
                onOpenLicenseModal={() => setLicenseModalOpen(true)}
                showToast={showToast}
              />
            )}

            {activeView === 'admin' && currentUser?.isAdmin && (
              <AdminDashboard 
                currentUser={currentUser}
                onRefreshProfile={refreshCurrentUser}
                showToast={showToast}
              />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal 
        isOpen={authModalOpen}
        mode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        showToast={showToast}
      />

      <DriverLicenseModal 
        isOpen={licenseModalOpen}
        onClose={() => setLicenseModalOpen(false)}
        currentUser={currentUser}
        onLicenseVerified={handleUserUpdated}
        showToast={showToast}
      />

      <BookingModal 
        isOpen={bookingModalOpen}
        ride={selectedRideForBooking}
        currentUser={currentUser}
        onClose={() => setBookingModalOpen(false)}
        onConfirmBooking={handleConfirmBooking}
        showToast={showToast}
      />

      <PaymentModal 
        isOpen={paymentModalOpen}
        req={selectedReqForPayment}
        onClose={() => setPaymentModalOpen(false)}
        showToast={showToast}
      />

      <LiveTrackingModal 
        isOpen={trackingModalOpen}
        ride={selectedRideForTracking}
        onClose={() => setTrackingModalOpen(false)}
      />

      <Toast toastInfo={toastInfo} onClose={() => setToastInfo(null)} />
    </div>
  );
}
