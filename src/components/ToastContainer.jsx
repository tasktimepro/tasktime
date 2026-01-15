import { useState } from 'react';
import Toast from './Toast';
import { ToastContext } from '../contexts/ToastContext';

/**
 * Toast provider component that manages toasts across the application
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Add a new toast
  const addToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  };

  // Remove a toast by ID
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Helper methods for different toast types
  const showSuccess = (message, duration = 3000) => addToast(message, 'success', duration);
  const showError = (message, duration = 3000) => addToast(message, 'error', duration);
  const showInfo = (message, duration = 3000) => addToast(message, 'info', duration);
  const showWarning = (message, duration = 5000) => addToast(message, 'warning', duration);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 w-full max-w-[500px] p-4 flex flex-col-reverse items-end">
        {toasts.map((toast, index) => (
          <div key={toast.id} className={index > 0 ? 'mb-4' : ''}>
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
