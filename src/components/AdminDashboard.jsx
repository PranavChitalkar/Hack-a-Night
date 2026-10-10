import React, { useState, useEffect } from 'react';
import { getDriverStatus } from '../utils/driverStatus';

export default function AdminDashboard({ currentUser, showToast }) {
  const [stats, setStats] = useState({ userCount: 0, rideCount: 0, reqCount: 0 });
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const adminHeaders = {
    'Content-Type': 'application/json',
    'x-admin-username': currentUser?.username || 'admin'
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/stats', { headers: adminHeaders });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch users
      const usersRes = await fetch('/api/admin/users', { headers: adminHeaders });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      }

      // Fetch safety alerts
      const alertsRes = await fetch('/api/admin/safety-alerts', { headers: adminHeaders });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }

      // Fetch driver licenses
      const driversRes = await fetch('/api/admin/drivers', { headers: adminHeaders });
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setDrivers(driversData.drivers || []);
      }
    } catch (err) {
      if (showToast) showToast("Error loading admin dashboard: " + err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // One approval covers both the license and the vehicle
  const handleApproveVehicle = async (username) => {
    if (!username) return;
    if (!confirm(`Approve @${username}? This verifies both the driving license and the vehicle.`)) return;
    try {
      const res = await fetch('/api/admin/approve-driver', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ username })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (showToast) showToast(`@${username} approved as a driver`, 'success');
        loadData();
      } else {
        if (showToast) showToast(data.error || "Approval failed", "danger");
      }
    } catch (err) {
      if (showToast) showToast("Approval error", "danger");
    }
  };

  const handleRejectVehicle = async (username) => {
    if (!username) return;
    const reason = prompt(`Reason for rejecting @${username} (the driver will see this):`, 'Document unclear or details do not match.');
    if (reason === null) return;
    try {
      const res = await fetch('/api/admin/reject-driver', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ username, reason, scope: 'both' })
      });
      if (res.ok) {
        if (showToast) showToast(`Application rejected for @${username}`, 'warning');
        loadData();
      } else {
        if (showToast) showToast("Action failed", "danger");
      }
    } catch (err) {
      if (showToast) showToast("Action failed", "danger");
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await fetch(`/api/admin/safety-alerts/${id}/resolve`, { method: 'POST', headers: adminHeaders });
      loadData();
    } catch (err) {
      if (showToast) showToast("Could not update alert", "danger");
    }
  };

  const handleBanUser = async (id, username) => {
    if (!id) return;
    if (!confirm(`⛔ Permanently ban and delete user @${username || 'user'}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: adminHeaders
      });
      if (res.ok) {
        if (showToast) showToast(`User @${username || 'user'} deleted`, 'dark');
        loadData();
      }
    } catch (err) {
      if (showToast) showToast("Could not ban user", "danger");
    }
  };

  // Safe helper to extract user display name
  const getDisplayName = (u) => {
    if (!u) return 'User';
    return u.fullName || u.username || 'User';
  };

  const getInitial = (u) => {
    const name = getDisplayName(u);
    return (name && name.length > 0) ? name.charAt(0).toUpperCase() : 'U';
  };

  const pendingVehicles = users.filter(u => u && u.username && u.username !== 'admin' && getDriverStatus(u) === 'pending_review');
  const verifiedDriverCount = users.filter(u => u && getDriverStatus(u) === 'verified').length;

  return (
    <div id="view-admin" className="py-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold m-0"><i className="fas fa-shield-alt text-primary me-2"></i>Admin Control Center</h3>
          <p className="text-muted small m-0">Live stats, driver approvals and license records</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn btn-light shadow-sm text-primary fw-bold rounded-pill px-4">
          <i className={`fas fa-sync-alt me-2 ${loading ? 'fa-spin' : ''}`}></i> Refresh Data
        </button>
      </div>

      {/* Stats row */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="pro-card p-4 d-flex align-items-center gap-4 bg-white">
            <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-3 fs-3">
              <i className="fas fa-users"></i>
            </div>
            <div>
              <h2 className="fw-bold m-0">{stats.userCount}</h2>
              <div className="text-muted small fw-bold text-uppercase">Total Registered Users</div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="pro-card p-4 d-flex align-items-center gap-4 bg-white">
            <div className="bg-success bg-opacity-10 text-success rounded-3 p-3 fs-3">
              <i className="fas fa-route"></i>
            </div>
            <div>
              <h2 className="fw-bold m-0">{stats.rideCount}</h2>
              <div className="text-muted small fw-bold text-uppercase">Active Rides</div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="pro-card p-4 d-flex align-items-center gap-4 bg-white">
            <div className="bg-warning bg-opacity-10 text-warning rounded-3 p-3 fs-3">
              <i className="fas fa-id-card"></i>
            </div>
            <div>
              <h2 className="fw-bold m-0">{verifiedDriverCount}</h2>
              <div className="text-muted small fw-bold text-uppercase">Verified Drivers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Vehicle Approvals Table */}
      <div className="pro-card mb-4 bg-white">
        <div className="d-flex justify-content-between align-items-center p-4 border-bottom">
          <h5 className="m-0 fw-bold text-dark"><i className="fas fa-car me-2 text-warning"></i>Pending Driver Approvals</h5>
          <span className="badge bg-warning text-dark rounded-pill px-3 py-2">{pendingVehicles.length} Pending</span>
        </div>

        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Applicant</th>
                <th>Vehicle Type</th>
                <th>Model</th>
                <th>License Plate</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingVehicles.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-muted">
                    <i className="fas fa-check-circle fa-2x text-success opacity-25 mb-2 d-block"></i>
                    All caught up! No pending approvals at the moment.
                  </td>
                </tr>
              ) : (
                pendingVehicles.map(u => (
                  <tr key={u._id || u.username}>
                    <td className="ps-4 fw-bold">
                      {getDisplayName(u)}
                      <div className="small text-muted fw-normal">@{u.username || 'user'}</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        <i className={`fas ${u.vehicle?.type === 'Bike' ? 'fa-motorcycle' : 'fa-car'} me-1`}></i>
                        {u.vehicle?.type || 'Car'}
                      </span>
                    </td>
                    <td className="fw-bold text-primary">{u.vehicle?.model || '-'}</td>
                    <td className="font-monospace bg-light p-2 rounded text-center" style={{ width: 'fit-content' }}>{u.vehicle?.plateNumber || '-'}</td>
                    <td className="text-center">
                      <button onClick={() => handleApproveVehicle(u.username)} className="btn btn-success btn-sm me-2 rounded-pill px-3">
                        <i className="fas fa-check me-1"></i> Approve
                      </button>
                      <button onClick={() => handleRejectVehicle(u.username)} className="btn btn-danger btn-sm rounded-pill px-3">
                        <i className="fas fa-times me-1"></i> Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚨 SOS alerts from passengers */}
      <div className="pro-card mb-4 bg-white">
        <div className="d-flex justify-content-between align-items-center p-4 border-bottom">
          <h5 className="m-0 fw-bold text-dark"><i className="fas fa-shield-alt me-2 text-danger"></i>Safety Alerts (SOS)</h5>
          <span className="badge bg-danger rounded-pill px-3 py-2">{alerts.filter(a => a.status === 'open').length} Open</span>
        </div>
        <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Passenger</th>
                <th>Time</th>
                <th>Location</th>
                <th>Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-4 text-muted">No SOS alerts.</td></tr>
              ) : alerts.map(a => (
                <tr key={a._id}>
                  <td className="ps-4 fw-bold">@{a.username}</td>
                  <td className="small">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="small">
                    {a.location ? <a href={`https://maps.google.com/?q=${a.location.lat},${a.location.lon}`} target="_blank" rel="noopener noreferrer">View map</a> : 'Not shared'}
                  </td>
                  <td><span className={`badge ${a.status === 'open' ? 'bg-danger' : 'bg-secondary'}`}>{a.status}</span></td>
                  <td className="text-center">
                    {a.status === 'open' && (
                      <button onClick={() => handleResolveAlert(a._id)} className="btn btn-outline-success btn-sm rounded-pill px-3">Mark resolved</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🪪 PaddleOCR Verified Drivers Database */}
      <div className="pro-card mb-4 bg-white">
        <div className="p-4 border-bottom bg-light">
          <h5 className="m-0 fw-bold text-dark"><i className="fas fa-id-card me-2 text-primary"></i>Driver License Records</h5>
        </div>

        <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Driver Name</th>
                <th>License Number</th>
                <th>Name on License</th>
                <th>Expiry / DOB</th>
                <th>Vehicle Class</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-4 text-muted">No verified driver license records found.</td></tr>
              ) : (
                drivers.map(d => {
                  const lic = d.driverLicense || {};
                  return (
                    <tr key={d._id || d.username}>
                      <td className="ps-4 fw-bold">
                        {getDisplayName(d)}
                        <div className="small text-muted fw-normal">@{d.username || 'user'}</div>
                      </td>
                      <td className="font-monospace fw-bold text-primary">{lic.licenseNumber || 'N/A'}</td>
                      <td>{lic.nameOnLicense || 'N/A'}</td>
                      <td className="small text-muted">{lic.expiryDate || lic.dob || 'N/A'}</td>
                      <td><span className="badge bg-success bg-opacity-10 text-success">{lic.cov || 'LMV'}</span></td>
                      <td>
                        {lic.documentPath ? (
                          <a href={lic.documentPath} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm rounded-pill">
                            <i className="fas fa-image me-1"></i> View Doc
                          </a>
                        ) : (
                          <span className="text-muted small">No Image</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Database Table */}
      <div className="pro-card bg-white">
        <div className="p-4 border-bottom bg-light">
          <h5 className="m-0 fw-bold text-dark"><i className="fas fa-users-cog me-2 text-primary"></i>User Accounts</h5>
        </div>

        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="ps-4">User</th>
                <th>Contact</th>
                <th>Email Status</th>
                <th>Vehicle Approval</th>
                <th className="text-end pe-4">Controls</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u && u.username && u.username !== 'admin').map(u => (
                <tr key={u._id || u.username}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px', fontWeight: 'bold' }}>
                        {getInitial(u)}
                      </div>
                      <div>
                        <div className="fw-bold text-dark">{getDisplayName(u)}</div>
                        <div className="small text-muted">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="small">{u.email || '-'}</div>
                    <div className="small text-muted">{u.phone || 'No Phone'}</div>
                  </td>
                  <td>
                    {u.isVerified ? (
                      <span className="badge bg-success bg-opacity-10 text-success"><i className="fas fa-check-circle me-1"></i> Verified</span>
                    ) : (
                      <span className="badge bg-warning text-dark">Unverified</span>
                    )}
                  </td>
                  <td>
                    {u.vehicle?.isVerified ? (
                      <span className="badge bg-info bg-opacity-10 text-info"><i className="fas fa-car me-1"></i> Approved</span>
                    ) : u.vehicle?.model ? (
                      <span className="badge bg-warning text-dark">Pending</span>
                    ) : (
                      <span className="text-muted small">-</span>
                    )}
                  </td>
                  <td className="text-end pe-4">
                    <button onClick={() => handleBanUser(u._id, u.username)} className="btn btn-outline-danger btn-sm rounded-pill px-3" title="Delete User">
                      <i className="fas fa-ban me-1"></i> Ban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
