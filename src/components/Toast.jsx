import React, { useEffect } from 'react';

export default function Toast({ toastInfo, onClose }) {
  useEffect(() => {
    if (toastInfo) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastInfo, onClose]);

  if (!toastInfo) return null;

  const bgClass = toastInfo.type === 'success' ? 'bg-success text-white' :
                  toastInfo.type === 'danger' ? 'bg-danger text-white' :
                  toastInfo.type === 'warning' ? 'bg-warning text-dark' : 'bg-primary text-white';

  const iconClass = toastInfo.type === 'success' ? 'fa-check-circle' :
                    toastInfo.type === 'danger' ? 'fa-exclamation-circle' :
                    toastInfo.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';

  return (
    <div className="toast-container position-fixed top-0 start-50 translate-middle-x p-3" style={{ zIndex: 1085 }}>
      <div className={`toast show align-items-center border-0 shadow-lg ${bgClass}`}>
        <div className="d-flex">
          <div className="toast-body d-flex align-items-center gap-3">
            <i className={`fas ${iconClass} fa-lg`}></i>
            <div>
              <strong className="d-block" style={{ fontSize: '0.9rem' }}>SwiftWheels Notification</strong>
              <span className="small">{toastInfo.message}</span>
            </div>
          </div>
          <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={onClose}></button>
        </div>
      </div>
    </div>
  );
}
