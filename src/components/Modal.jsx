import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Reusable Modal component with ESC key handling and background scroll prevention
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.title - Modal title (optional)
 * @param {string} props.size - Modal size (sm, md, lg, xl, full)
 * @param {boolean} props.showCloseButton - Whether to show the close button
 * @param {string} props.className - Additional class names for the modal content wrapper
 */
const Modal = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  showCloseButton = true,
  className = '',
}) => {
  // Map size prop to class names
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  // ESC key handler
  const handleEscKeyPress = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Control body scroll and add event listeners when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Prevent scrolling on the html element when modal is open
      document.documentElement.classList.add('modal-open');
      // Add ESC key event listener
      document.addEventListener('keydown', handleEscKeyPress);
    }
    
    // Clean up function
    return () => {
      // Re-enable scrolling when modal closes
      document.documentElement.classList.remove('modal-open');
      // Remove ESC key event listener
      document.removeEventListener('keydown', handleEscKeyPress);
    };
  }, [isOpen, handleEscKeyPress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 !mt-0">
      <div className={`bg-white rounded-lg p-6 w-full mx-4 ${sizeClasses[size]} ${className}`}>
        {(title || showCloseButton) && (
          <div className="flex justify-between items-center mb-4">
            {title && (
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            )}

            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full']),
  showCloseButton: PropTypes.bool,
  className: PropTypes.string,
};

export default Modal;
