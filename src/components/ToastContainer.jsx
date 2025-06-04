import { useState, createContext, useContext } from 'react';
import Toast from './Toast';

// Create context for toast management
const ToastContext = createContext();

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

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showInfo }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 p-4 space-y-4 flex flex-col-reverse items-end">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast functionality
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
