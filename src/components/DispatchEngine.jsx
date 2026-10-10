import React, { useState, useEffect } from 'react';

export default function DispatchEngine({ showToast }) {
  const [ratePerKm, setRatePerKm] = useState(10);
  const [maxDetour, setMaxDetour] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchData, setBatchData] = useState(null);

  // Preset commuter pool for demonstration
  const samplePassengers = [
    {
      id: 'p1',
      name: 'Aarav Sharma',
      pickup: { lat: 19.9975, lon: 73.7898, label: 'Nashik Main Station' },
      dropoff: { lat: 19.9204, lon: 73.8567, label: 'Ozar IT Park' }
    },
    {
      id: 'p2',
      name: 'Ananya Verma',
      pickup: { lat: 19.9850, lon: 73.7950, label: 'College Road' },
      dropoff: { lat: 19.9300, lon: 73.8400, label: 'HAL Aerospace' }
    },
    {
      id: 'p3',
      name: 'Rohan Mehta',
      pickup: { lat: 19.9700, lon: 73.8050, label: 'Dwarka Circle' },
      dropoff: { lat: 19.9100, lon: 73.8600, label: 'Airport Gateway' }
    }
  ];

  const [passengers, setPassengers] = useState(samplePassengers);

  // Recalculate the route and fares
  const runDispatch = async (candidatePassengers = passengers) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/batch/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passengers: candidatePassengers,
          ratePerKm: parseFloat(ratePerKm) || 10,
          maxDetourRatio: 1 + (parseFloat(maxDetour) || 15) / 100
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBatchData(data);
        if (showToast) showToast("✨ Route updated!", "success");
      } else {
        if (showToast) showToast(data.error || "Could not calculate the route", "danger");
      }
    } catch (err) {
      if (showToast) showToast("Network error. Please try again.", "danger");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    runDispatch(samplePassengers);
  }, []);

  // Draw the route map
  useEffect(() => {
    if (!batchData || !batchData.vrptw || !batchData.vrptw.sequence) return;

    const timer = setTimeout(() => {
      const mapDiv = document.getElementById('dispatchMap');
      if (mapDiv && window.L) {
        mapDiv.innerHTML = `<div id="mapLeafletDispatch" style="height: 380px; width: 100%;"></div>`;

        try {
          const map = window.L.map('mapLeafletDispatch').setView([19.95, 73.82], 12);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(map);

          const seq = batchData.vrptw.sequence;
          const latLngs = [];

          seq.forEach((stop, idx) => {
            latLngs.push([stop.lat, stop.lon]);
            const isPickup = stop.type === 'pickup';
            const color = isPickup ? '#10b981' : '#ef4444';
            const iconHtml = `<div style="background:${color}; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${idx + 1}</div>`;
            const customIcon = window.L.divIcon({ html: iconHtml, className: '' });

            window.L.marker([stop.lat, stop.lon], { icon: customIcon })
              .addTo(map)
              .bindPopup(`<b>Stop #${idx + 1}: ${isPickup ? 'Pickup' : 'Dropoff'}</b><br/>${stop.passengerName}<br/>${stop.label}`);
          });

          if (latLngs.length > 1) {
            window.L.polyline(latLngs, { color: '#10b981', weight: 4, dashArray: '5, 10' }).addTo(map);
            map.fitBounds(window.L.polyline(latLngs).getBounds(), { padding: [30, 30] });
          }
        } catch (e) {
          console.error("Map error:", e);
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [batchData]);

  const vrp = batchData?.vrptw;
  const shapley = batchData?.shapley;

  return (
    <div id="dispatch-engine-view" className="py-2">
      {/* Action Bar */}
      <div className="d-flex justify-content-end mb-4">
        <button onClick={() => runDispatch(passengers)} disabled={isProcessing} className="btn btn-primary rounded-pill px-4 py-2 fw-bold shadow-sm">
          <i className={`fas fa-sync-alt me-2 ${isProcessing ? 'fa-spin' : ''}`}></i> Recalculate
        </button>
      </div>

      {/* Control Panel */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="pro-card p-3 bg-white">
            <label className="small fw-bold text-muted mb-1">FARE RATE (₹ / KM)</label>
            <input type="number" className="form-control" value={ratePerKm} onChange={e => setRatePerKm(e.target.value)} min="1" max="50" />
          </div>
        </div>
        <div className="col-md-4">
          <div className="pro-card p-3 bg-white">
            <label className="small fw-bold text-muted mb-1">MAX DETOUR (%)</label>
            <input type="number" className="form-control" value={maxDetour} onChange={e => setMaxDetour(e.target.value)} min="5" max="15" />
          </div>
        </div>
        <div className="col-md-4">
          <div className="pro-card p-3 bg-white d-flex align-items-center justify-content-between h-100">
            <div>
              <div className="small text-muted fw-bold">COMMUTERS</div>
              <div className="fs-5 fw-bold text-dark">{passengers.length} Commuters</div>
            </div>
            <button
              onClick={() => {
                if (passengers.length === 3) {
                  setPassengers([...samplePassengers, {
                    id: 'p4',
                    name: 'Kavya Nair',
                    pickup: { lat: 19.9800, lon: 73.8000, label: 'Indira Nagar' },
                    dropoff: { lat: 19.9150, lon: 73.8500, label: 'Tech Park' }
                  }]);
                } else {
                  setPassengers(samplePassengers);
                }
              }}
              className="btn btn-outline-primary btn-sm rounded-pill"
            >
              {passengers.length === 3 ? '+ Add 4th Commuter' : 'Reset to 3 Commuters'}
            </button>
          </div>
        </div>
      </div>

      {/* Map and Stop List */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div className="pro-card bg-white border-0 shadow-sm overflow-hidden h-100">
            <div className="p-3 bg-light border-bottom">
              <h6 className="fw-bold m-0 text-dark"><i className="fas fa-map-marked-alt text-primary me-2"></i>Route Map</h6>
            </div>
            <div className="p-0">
              <div id="dispatchMap" style={{ minHeight: '380px' }}></div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="pro-card bg-white border-0 shadow-sm h-100 p-4">
            <h6 className="fw-bold text-dark mb-3"><i className="fas fa-route text-primary me-2"></i>Stops in Order</h6>

            {vrp?.sequence ? (
              <div>
                <div className="mb-3 p-2 bg-light rounded-3 d-flex justify-content-between align-items-center">
                  <span className="small text-muted">Total distance (straight-line):</span>
                  <strong className="fs-5 text-primary">{vrp.totalDistance} km</strong>
                </div>

                <div className="location-timeline" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {vrp.sequence.map((stop, idx) => (
                    <div key={idx} className="mb-3 position-relative ps-3">
                      <div className={`timeline-dot ${stop.type === 'pickup' ? 'top' : 'bottom'}`}></div>
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className={`badge ${stop.type === 'pickup' ? 'bg-success' : 'bg-danger'} me-2`}>
                            #{idx + 1} {stop.type === 'pickup' ? 'PICKUP' : 'DROPOFF'}
                          </span>
                          <strong className="small text-dark">{stop.passengerName}</strong>
                        </div>
                      </div>
                      <div className="small text-muted mt-1">{stop.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-5 text-muted">Click Recalculate to see the stops</div>
            )}
          </div>
        </div>
      </div>

      {/* Detour Check */}
      <div className="pro-card bg-white border-0 shadow-sm mb-4">
        <div className="p-4 border-bottom bg-light d-flex justify-content-between align-items-center">
          <h6 className="fw-bold m-0 text-dark"><i className="fas fa-percentage text-warning me-2"></i>Detour Check</h6>
        </div>

        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Commuter</th>
                <th>Direct Distance (straight-line km)</th>
                <th>Shared Route Distance (km)</th>
                <th>Detour %</th>
                <th className="text-end pe-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {vrp?.passengerStats?.map(stat => (
                <tr key={stat.passengerId}>
                  <td className="ps-4 fw-bold">{stat.passengerName}</td>
                  <td>{stat.soloDistance} km</td>
                  <td className="fw-bold text-primary">{stat.pooledDistance} km</td>
                  <td>
                    <span className={`fw-bold ${stat.detourPercentage <= maxDetour ? 'text-success' : 'text-danger'}`}>
                      +{stat.detourPercentage}%
                    </span>
                  </td>
                  <td className="text-end pe-4">
                    {stat.detourPercentage <= maxDetour ? (
                      <span className="badge bg-success bg-opacity-10 text-success"><i className="fas fa-check-circle me-1"></i> Within limit</span>
                    ) : (
                      <span className="badge bg-danger bg-opacity-10 text-danger">Over limit</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fare Breakdown */}
      <div className="pro-card bg-white border-0 shadow-sm">
        <div className="p-4 border-bottom bg-light d-flex justify-content-between align-items-center">
          <h5 className="fw-bold m-0 text-dark"><i className="fas fa-calculator text-success me-2"></i>Fare Breakdown</h5>
          <div className="text-end">
            <div className="small text-muted fw-bold">TOTAL SAVINGS</div>
            <div className="fs-4 fw-bold text-success">₹{shapley?.totalSavings || 0} ({shapley?.savingsPercentage || 0}%)</div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Commuter</th>
                <th>Solo Fare</th>
                <th>Extra for Sharing</th>
                <th>Your Fare</th>
                <th>You Save</th>
                <th className="text-end pe-4">Savings %</th>
              </tr>
            </thead>
            <tbody>
              {shapley?.allocations?.map(alloc => (
                <tr key={alloc.passengerId}>
                  <td className="ps-4 fw-bold">{alloc.passengerName}</td>
                  <td className="text-muted">₹{alloc.soloFare}</td>
                  <td className="small font-monospace">+₹{alloc.marginalContribution}</td>
                  <td className="fs-5 fw-bold text-success font-monospace">₹{alloc.shapleyFare}</td>
                  <td className="fw-bold text-primary">₹{alloc.savingsAmount}</td>
                  <td className="text-end pe-4">
                    <span className="badge bg-success rounded-pill px-3 py-2">
                      <i className="fas fa-arrow-down me-1"></i> {alloc.savingsPct}% OFF
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="table-light fw-bold">
              <tr>
                <td className="ps-4">Total</td>
                <td>₹{shapley?.totalSoloFare || 0}</td>
                <td>-</td>
                <td className="text-success fs-5">₹{shapley?.totalPooledFare || 0}</td>
                <td className="text-primary">₹{shapley?.totalSavings || 0}</td>
                <td className="text-end pe-4 text-success">{shapley?.savingsPercentage || 0}% Total Saved</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
