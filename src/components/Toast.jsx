import { useState, useEffect } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Toast notification component that appears in the bottom right corner
 * @param {Object} props - Component props
 * @param {string} props.message - Message to display in toast
 * @param {string} props.type - Toast type: 'success', 'error', 'info'
 * @param {number} props.duration - Duration to show toast in milliseconds (default: 3000ms)
 * @param {function} props.onClose - Callback function when toast is closed
 */
const Toast = ({ message, type = 'success', duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [animation, setAnimation] = useState('enter');

  // Set up auto-dismiss timer
  useEffect(() => {
    if (!duration) return;
    
    const timer = setTimeout(() => {
      setAnimation('exit');
      setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 300); // Wait for exit animation to complete
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Close toast handler
  const handleClose = () => {
    setAnimation('exit');
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300); // Wait for exit animation to complete
  };
  
  // Different icon based on toast type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-6 w-6 text-white" />;
      case 'error':
        return <ExclamationCircleIcon className="h-6 w-6 text-white" />;
      case 'info':
      default:
        return <InformationCircleIcon className="h-6 w-6 text-white" />;
    }
  };
  
  // Styling based on toast type
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: 'bg-green-600',
          text: 'text-white',
          iconBg: 'bg-green-500',
          closeHover: 'hover:bg-green-700'
        };
      case 'error':
        return {
          background: 'bg-red-600',
          text: 'text-white',
          iconBg: 'bg-red-500',
          closeHover: 'hover:bg-red-700'
        };
      case 'info':
      default:
        return {
          background: 'bg-blue-600',
          text: 'text-white',
          iconBg: 'bg-blue-500',
          closeHover: 'hover:bg-blue-700'
        };
    }
  };

  if (!isVisible) return null;
  
  const styles = getStyles();
  const animationClasses = {
    enter: 'animate-toast-enter',
    exit: 'animate-toast-exit'
  };

  return (
    <div 
      className={`flex items-center p-4 w-72 rounded-lg shadow-lg ${styles.background} ${styles.text} ${animationClasses[animation]}`} 
      role="alert"
    >
      <div className="inline-flex flex-shrink-0 justify-center items-center mr-3">
        {getIcon()}
      </div>
      <div className="ml-2 text-sm font-normal mr-6">{message}</div>
      <button 
        type="button" 
        className={`ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-white/50 p-1.5 inline-flex h-8 w-8 text-white/80 ${styles.closeHover} transition-colors`} 
        onClick={handleClose}
        aria-label="Close"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default Toast;
