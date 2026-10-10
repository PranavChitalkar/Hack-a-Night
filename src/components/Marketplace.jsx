import React, { useState, useEffect } from 'react';

export default function Marketplace({ currentUser, rides, onSearch, onLoadRides, onBookRide, onOpenTracking }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <div id="view-market">
      <form onSubmit={handleSearch} className="input-group mb-4 shadow-sm bg-white rounded-pill overflow-hidden border">
        <span className="input-group-text border-0 bg-white ps-4"><i className="fas fa-search text-muted"></i></span>
        <input 
          type="text" 
          className="form-control border-0 py-3" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Where do you want to go? (e.g. Pune, Mumbai, Ozar)" 
        />
        <button type="submit" className="btn btn-primary px-4">Search</button>
        <button type="button" onClick={() => { setSearchTerm(''); onLoadRides(); }} className="btn btn-light border-start" title="Refresh">
          <i className="fas fa-sync"></i>
        </button>
      </form>

      <div className="row g-4">
        {rides.length === 0 ? (
          <div className="col-12 text-center py-5">
            <i className="fas fa-car-side fa-3x text-muted mb-3 opacity-50"></i>
            <h5 className="text-muted fw-bold">No rides found matching your query</h5>
            <p className="small text-secondary">Try searching for a different destination or refresh available rides.</p>
          </div>
        ) : (
          rides.filter(r => !['cancelled', 'completed'].includes(r.status)).map((ride) => {
            const isOwner = currentUser && (currentUser.username === ride.driverUsername || currentUser.username === ride.driver);
            return (
              <div key={ride._id || ride.id} className="col-md-6 col-lg-4">
                <div className="pro-card p-4 h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">
                        <i className={`fas ${ride.vehicleType === 'Bike' ? 'fa-motorcycle' : 'fa-car'} me-2 text-primary`}></i>
                        {ride.vehicleType || 'Car'}
                      </span>
                      <span className="ride-price-badge">₹{ride.price}</span>
                    </div>

                    <div className="location-timeline">
                      <div className="timeline-dot top"></div>
                      <div className="fw-bold fs-5 text-dark mb-1">{ride.from}</div>
                      
                      {ride.stops && ride.stops.length > 0 && (
                        <div className="small text-muted mb-1 ps-1">
                          <i className="fas fa-map-marker-alt text-warning me-1"></i>
                          Via: {Array.isArray(ride.stops) ? ride.stops.join(', ') : ride.stops}
                        </div>
                      )}

                      <div className="timeline-dot bottom"></div>
                      <div className="fw-bold fs-5 text-dark mt-3">{ride.to}</div>
                    </div>

                    <div className="d-flex align-items-center gap-3 my-3 pt-2 border-top">
                      <div className="avatar-circle bg-primary text-white">
                        {(ride.driver || ride.driverUsername || 'D').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-bold small">{ride.driver || ride.driverUsername}</div>
                        <div className="text-muted style-sm" style={{ fontSize: '0.8rem' }}>
                          <i className="fas fa-star text-warning me-1"></i> {ride.driverRating || 5.0} Rating
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center small text-muted bg-light p-2 rounded-3 mb-3">
                      <span><i className="far fa-calendar-alt me-1 text-primary"></i> {ride.travelDate || ride.date || 'Today'}</span>
                      <span><i className="far fa-clock me-1 text-primary"></i> {ride.travelTime || ride.time || 'Flexible'}</span>
                      <span><i className="fas fa-couch me-1 text-primary"></i> {ride.seats} Seats</span>
                    </div>

                    {ride.womenOnly && (
                      <span className="badge bg-danger bg-opacity-10 text-danger me-2 mb-3">
                        <i className="fas fa-venus me-1"></i> Women-only
                      </span>
                    )}

                    {ride.vibe && (
                      <span className="badge bg-secondary bg-opacity-10 text-dark me-2 mb-3">
                        {ride.vibe}
                      </span>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-2">
                    <button 
                      onClick={() => onOpenTracking(ride)} 
                      className="btn btn-outline-secondary btn-sm rounded-pill px-3" 
                      title="Live Route Tracking"
                    >
                      <i className="fas fa-map-marked-alt me-1"></i> Track
                    </button>

                    {isOwner ? (
                      <span className="btn btn-light btn-sm rounded-pill w-100 border text-muted">Your Ride</span>
                    ) : (
                      <button 
                        onClick={() => onBookRide(ride)} 
                        disabled={ride.seats <= 0} 
                        className="btn btn-primary btn-sm rounded-pill w-100 fw-bold"
                      >
                        {ride.seats > 0 ? 'Book Ride 🚗' : 'Full'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
