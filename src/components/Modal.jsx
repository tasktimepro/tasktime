import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Reusable Modal component with ESC key handling and background scroll prevention
 * 
 * IMPORTANT: For consistency, always use the 'footer' prop to add action buttons (Cancel, Save, Delete, etc.)
 * instead of including buttons directly in the modal content. This ensures consistent styling and layout
 * across the entire application.
 * 
 * Example usage:
 * ```jsx
 * const modalFooter = (
 *   <div className="flex justify-end space-x-3">
 *     <button onClick={onCancel} className="...">Cancel</button>
 *     <button onClick={onSave} className="...">Save</button>
 *   </div>
 * );
 * 
 * <Modal isOpen={true} onClose={onClose} footer={modalFooter}>
 *   Content goes here
 * </Modal>
 * ```
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.title - Modal title (optional)
 * @param {string} props.size - Modal size (sm, md, lg, xl, full)
 * @param {boolean} props.showCloseButton - Whether to show the close button
 * @param {string} props.className - Additional class names for the modal content wrapper
 * @param {React.ReactNode} props.footer - Footer content (optional) - USE THIS FOR ACTION BUTTONS
 */
const Modal = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  showCloseButton = true,
  className = '',
  footer,
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
      
      // Clean up function runs when modal is closed or component unmounts
      return () => {
        document.documentElement.classList.remove('modal-open');
        document.removeEventListener('keydown', handleEscKeyPress);
      };
    }
  }, [isOpen, handleEscKeyPress]);

  if (!isOpen) return null;

  // Always use the scrollable modal layout with header and footer
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0">
      <div className={`bg-white rounded-lg w-full mx-auto flex flex-col ${sizeClasses[size]} ${className}`} 
           style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Fixed Header */}
        {(title || showCloseButton) && (
          <div className="flex justify-between items-center p-3 border-b border-gray-200 flex-shrink-0">
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
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="border-t border-gray-200 p-3 flex-shrink-0">
            {footer}
          </div>
        )}
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
  footer: PropTypes.node,
};

export default Modal;
