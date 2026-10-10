import React, { useEffect, useState, useCallback } from 'react';
import { searchPlaces } from '../utils/geo';
import { isDriverApproved } from '../utils/driverStatus';

const WINDOWS = [5, 10, 15, 20, 30];

const STATUS_LABEL = {
  waiting: { text: 'Waiting for a co-passenger', cls: 'bg-warning text-dark' },
  pooled: { text: 'Pooled: waiting for a driver', cls: 'bg-info text-dark' },
  matched: { text: 'Confirmed: ride booked', cls: 'bg-success' },
  cancelled: { text: 'Cancelled', cls: 'bg-secondary' },
  expired: { text: 'Expired: no match in time', cls: 'bg-secondary' }
};

// Places are confirmed through the search, so the coordinates are real
function PlaceField({ label, value, onText, place, onPlace, showToast }) {
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const find = async () => {
    setBusy(true);
    try {
      const r = await searchPlaces(value, 5);
      setResults(r);
      if (r.length === 0) showToast(`No places found for "${value}". Add the city name.`, 'warning');
    } catch (e) { showToast(e.message, 'danger'); }
    finally { setBusy(false); }
  };
  return (
    <div className="mb-3">
      <label className="small fw-bold text-muted">{label}</label>
      <div className="input-group">
        <input className="form-control" value={value}
          onChange={e => { onText(e.target.value); onPlace(null); setResults([]); }}
          placeholder="e.g. Nashik Road station" />
        <button type="button" className="btn btn-outline-primary" onClick={find} disabled={busy || value.trim().length < 2}>
          {busy ? '...' : 'Find'}
        </button>
      </div>
      {results.length > 0 && !place && (
        <div className="list-group mt-1 small">
          {results.map((r, i) => (
            <button type="button" key={i} className="list-group-item list-group-item-action py-2"
              onClick={() => { onPlace({ label: r.label, lat: r.lat, lon: r.lon }); onText(r.label.split(',')[0]); setResults([]); }}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {place && <div className="small text-success mt-1"><i className="fas fa-check-circle me-1"></i>{place.label}</div>}
    </div>
  );
}

export default function PoolBoard({ currentUser, showToast }) {
  const username = currentUser?.username;
  const [from, setFrom] = useState('');
  const [fromPlace, setFromPlace] = useState(null);
  const [to, setTo] = useState('');
  const [toPlace, setToPlace] = useState(null);
  const [within, setWithin] = useState(15);
  const [womenOnly, setWomenOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState([]);
  const [pools, setPools] = useState([]);
  const [seatsAvailable, setSeatsAvailable] = useState(0);
  const [driverNote, setDriverNote] = useState('');
  const [accepting, setAccepting] = useState(null);

  const isDriver = isDriverApproved(currentUser);
  const isFemale = currentUser?.gender === 'female';

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const r = await fetch(`/api/pool-requests/mine/${username}`).then(x => x.json());
      if (r.success) setMine(r.requests);
      if (isDriver) {
        const p = await fetch(`/api/pools/open?username=${username}`).then(x => x.json());
        if (p.success) { setPools(p.pools); setSeatsAvailable(p.seatsAvailable); setDriverNote(''); }
        else setDriverNote(p.error || '');
      }
    } catch (e) { /* keep last values on network blips */ }
  }, [username, isDriver]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const activeRequest = mine.find(r => r.status === 'waiting' || r.status === 'pooled');

  const submit = async (e) => {
    e.preventDefault();
    if (!fromPlace || !toPlace) { showToast('Find and select both places first', 'warning'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/pool-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pickup: fromPlace, dropoff: toPlace, pickupWithinMinutes: within, womenOnly })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Request posted. We will look for co-passengers on your route.', 'success');
        setFrom(''); setTo(''); setFromPlace(null); setToPlace(null);
        load();
      } else showToast(data.error || 'Could not post request', 'danger');
    } catch (err) { showToast('Network error', 'danger'); }
    finally { setSubmitting(false); }
  };

  const cancelRequest = async (id) => {
    if (!confirm('Cancel this shared-ride request?')) return;
    const res = await fetch(`/api/pool-requests/${id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
    });
    const data = await res.json();
    showToast(data.success ? 'Request cancelled' : (data.error || 'Could not cancel'), data.success ? 'info' : 'danger');
    load();
  };

  const acceptPool = async (pool) => {
    if (!confirm(`Accept this pool of ${pool.seatsNeeded} passengers for ₹${pool.fareTotal} total?`)) return;
    setAccepting(pool._id);
    try {
      const res = await fetch(`/api/pools/${pool._id}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
      });
      const data = await res.json();
      showToast(data.success ? data.message : (data.error || 'Could not accept'), data.success ? 'success' : 'danger');
      load();
    } finally { setAccepting(null); }
  };

  const runNow = async () => {
    const res = await fetch('/api/pools/tick', { method: 'POST' });
    const data = await res.json();
    showToast(data.success ? `Dispatch run: ${data.proposed} new pool(s) from ${data.waiting} waiting request(s)` : 'Dispatch run failed', data.success ? 'info' : 'danger');
    load();
  };

  return (
    <div className="row g-4">
      {/* Commuter side */}
      <div className="col-lg-5">
        <div className="pro-card bg-white border-0 shadow-sm p-4 h-100">
          <h5 className="fw-bold mb-1"><i className="fas fa-users text-primary me-2"></i>Request a shared ride</h5>
          <p className="small text-muted mb-3">We pool commuters on overlapping routes. Each rider's detour stays within 15%, and the fare is split fairly by each person's share of the trip.</p>

          {activeRequest ? (
            <div className="border rounded-3 p-3 bg-light">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className={`badge ${STATUS_LABEL[activeRequest.status].cls} rounded-pill px-3 py-2`}>{STATUS_LABEL[activeRequest.status].text}</span>
                <span className="small text-muted">{activeRequest.womenOnly ? 'Women-only' : 'Mixed'}</span>
              </div>
              <div className="small"><strong>From:</strong> {activeRequest.pickup.label}</div>
              <div className="small"><strong>To:</strong> {activeRequest.dropoff.label}</div>
              <div className="small text-muted mb-3">Pickup within {activeRequest.pickupWithinMinutes} min of departure</div>
              {activeRequest.status === 'pooled' && <div className="alert alert-info small py-2">A co-passenger matched. A driver will confirm soon.</div>}
              {activeRequest.status === 'matched' && <div className="alert alert-success small py-2">Booked. See My Trips for your share and trip link.</div>}
              {(activeRequest.status === 'waiting' || activeRequest.status === 'pooled') && (
                <button onClick={() => cancelRequest(activeRequest._id)} className="btn btn-outline-danger btn-sm rounded-pill w-100">Cancel request</button>
              )}
            </div>
          ) : (
            <form onSubmit={submit}>
              <PlaceField label="PICKUP" value={from} onText={setFrom} place={fromPlace} onPlace={setFromPlace} showToast={showToast} />
              <PlaceField label="DROP-OFF" value={to} onText={setTo} place={toPlace} onPlace={setToPlace} showToast={showToast} />

              <label className="small fw-bold text-muted">PICKUP WITHIN</label>
              <select className="form-select mb-3" value={within} onChange={e => setWithin(Number(e.target.value))}>
                {WINDOWS.map(w => <option key={w} value={w}>{w} minutes of departure</option>)}
              </select>

              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" id="poolWomen" checked={womenOnly}
                  onChange={e => setWomenOnly(e.target.checked)} disabled={!isFemale} />
                <label className="form-check-label small fw-bold" htmlFor="poolWomen">Women-only pool</label>
                {!isFemale && <div className="small text-muted">Set your gender to female in Safety settings to use this.</div>}
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary w-100 rounded-pill py-2 fw-bold">
                {submitting ? 'Posting...' : 'Find me a shared ride'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Driver side */}
      <div className="col-lg-7">
        <div className="pro-card bg-white border-0 shadow-sm p-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold m-0"><i className="fas fa-route text-success me-2"></i>Open pools</h5>
            <button onClick={runNow} className="btn btn-outline-secondary btn-sm rounded-pill px-3">
              <i className="fas fa-bolt me-1"></i> Run matching now
            </button>
          </div>

          {!isDriver ? (
            <div className="alert alert-light border small mb-0">Drivers with an approved license and vehicle see pools here and can accept them.</div>
          ) : pools.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="fas fa-hourglass-half fa-2x mb-2 opacity-50"></i>
              <div>No open pools right now. Pools appear when commuters on overlapping routes are matched.</div>
              {driverNote && <div className="small mt-2">{driverNote}</div>}
            </div>
          ) : (
            pools.map(pool => (
              <div key={pool._id} className="border rounded-3 p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold">{pool.seatsNeeded} passengers · {pool.totalDistance} km (straight-line)</span>
                  <span className="fw-bold text-success">₹{pool.fareTotal} total</span>
                </div>
                <ol className="small mb-2 ps-3">
                  {pool.stops.map((s, i) => (
                    <li key={i}>{s.type === 'pickup' ? 'Pick up' : 'Drop off'} {s.passengerName}: {s.label}</li>
                  ))}
                </ol>
                <div className="small text-muted mb-2">Your vehicle has {seatsAvailable} seat(s).</div>
                <button onClick={() => acceptPool(pool)} disabled={accepting === pool._id} className="btn btn-success btn-sm rounded-pill px-4 fw-bold">
                  {accepting === pool._id ? 'Accepting...' : 'Accept pool'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
