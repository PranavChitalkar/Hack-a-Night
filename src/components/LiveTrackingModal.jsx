import React, { useEffect, useRef, useState } from 'react';

const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Draws the ride's real start and end points and the driver's last reported position.
export default function LiveTrackingModal({ isOpen, ride, onClose }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const driverMarker = useRef(null);
  const [driver, setDriver] = useState(null);     // { lat, lon } from the server
  const [checkedAt, setCheckedAt] = useState(null);

  const hasRoute = !!ride && isNum(ride.fromLat) && isNum(ride.fromLon) && isNum(ride.toLat) && isNum(ride.toLon);

  // Build the map once per opened ride
  useEffect(() => {
    if (!isOpen || !ride || !hasRoute || !window.L || !mapEl.current) return;
    const L = window.L;
    const map = L.map(mapEl.current).setView([ride.fromLat, ride.fromLon], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    const a = [ride.fromLat, ride.fromLon];
    const b = [ride.toLat, ride.toLon];
    L.marker(a).addTo(map).bindPopup(`<b>From:</b> ${ride.from}`);
    L.marker(b).addTo(map).bindPopup(`<b>To:</b> ${ride.to}`);
    L.polyline([a, b], { color: '#4f46e5', weight: 3, dashArray: '6, 8' }).addTo(map);
    map.fitBounds([a, b], { padding: [40, 40] });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      driverMarker.current = null;
    };
  }, [isOpen, ride, hasRoute]);

  // Poll the driver's last reported position
  useEffect(() => {
    if (!isOpen || !ride || !ride._id) return;
    let cancelled = false;
    const load = () => fetch(`/api/rides/${ride._id}/location`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setCheckedAt(new Date());
        setDriver(isNum(d.lat) && isNum(d.lon) ? { lat: d.lat, lon: d.lon } : null);
      })
      .catch(() => {});
    load();
    const timer = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isOpen, ride]);

  // Show or move the driver marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    if (!driver) {
      if (driverMarker.current) { driverMarker.current.remove(); driverMarker.current = null; }
      return;
    }
    if (!driverMarker.current) {
      driverMarker.current = window.L.circleMarker([driver.lat, driver.lon], { radius: 9, color: '#fff', weight: 2, fillColor: '#10b981', fillOpacity: 1 })
        .addTo(map).bindPopup('Driver (last reported position)');
    } else {
      driverMarker.current.setLatLng([driver.lat, driver.lon]);
    }
  }, [driver]);

  if (!isOpen || !ride) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 overflow-hidden shadow-lg rounded-4">
          <div className="modal-header bg-primary text-white border-0 py-3">
            <h5 className="modal-title fw-bold">
              <i className="fas fa-satellite-dish me-2"></i> Route Tracking: {ride.from} to {ride.to}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-0">
            {hasRoute ? (
              <div ref={mapEl} style={{ height: 400, width: '100%', backgroundColor: '#e2e8f0' }}></div>
            ) : (
              <div className="p-5 text-center text-muted">
                <i className="fas fa-map-marked-alt fa-2x mb-3 opacity-50"></i>
                <div>This ride was posted before exact locations were recorded, so it cannot be drawn on the map.</div>
              </div>
            )}
          </div>
          <div className="modal-footer bg-light justify-content-between py-3">
            <div className="small text-muted">
              <i className="fas fa-car-side text-primary me-2"></i>
              Driver: {ride.driverUsername || ride.driver}
              {' · '}
              {driver ? 'Live position shown' : 'No live position yet'}
              {checkedAt && <> · checked {checkedAt.toLocaleTimeString()}</>}
            </div>
            <button type="button" className="btn btn-dark btn-sm rounded-pill px-4" onClick={onClose}>Close Map</button>
          </div>
        </div>
      </div>
    </div>
  );
}
