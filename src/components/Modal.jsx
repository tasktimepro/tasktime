import PropTypes from 'prop-types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Reusable Modal component using shadcn/ui Dialog
 * 
 * IMPORTANT: For consistency, always use the 'footer' prop to add action buttons (Cancel, Save, Delete, etc.)
 * instead of including buttons directly in the modal content. This ensures consistent styling and layout
 * across the entire application.
 * 
 * Example usage:
 * ```jsx
 * const modalFooter = (
 *   <div className="flex justify-end space-x-3">
 *     <Button variant="outline" onClick={onCancel}>Cancel</Button>
 *     <Button onClick={onSave}>Save</Button>
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
 * @param {string} props.description - Modal description for accessibility (optional)
 * @param {string} props.size - Modal size (sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, 7xl, full)
 * @param {boolean} props.showCloseButton - Whether to show the close button (default: true)
 * @param {string} props.className - Additional class names for the modal content wrapper
 * @param {React.ReactNode} props.footer - Footer content (optional) - USE THIS FOR ACTION BUTTONS
 */
const Modal = ({
    isOpen,
    onClose,
    children,
    title,
    description,
    size = 'md',
    showCloseButton = true,
    className = '',
    footer,
}) => {

    // Map size prop to max-width classes
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={cn(
                    sizeClasses[size],
                    'flex flex-col max-h-[calc(100vh-2rem)] p-0',
                    className
                )}
                // Hide default close button if showCloseButton is false
                onPointerDownOutside={(e) => e.preventDefault()}
                hideCloseButton={!showCloseButton}
            >
                {/* Header */}
                {(title || description) && (
                    <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
                        {title && <DialogTitle>{title}</DialogTitle>}
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                )}
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full']),
    showCloseButton: PropTypes.bool,
    className: PropTypes.string,
    footer: PropTypes.node,
};

export default Modal;
