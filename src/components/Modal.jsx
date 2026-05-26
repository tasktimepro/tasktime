import PropTypes from 'prop-types';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { XMarkIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils.ts';

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
 * @param {boolean} props.hideHeader - Whether to visually hide the modal header while preserving accessible title/description
 * @param {React.ReactNode} props.headerActions - Header content rendered beside the close button (optional)
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
    hideHeader = false,
    headerActions,
    className = '',
    footer,
    contentRef,
    onOpenAutoFocus,
}) => {

    // Map size prop to max-width classes
    const sizeClasses = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
        '3xl': 'sm:max-w-3xl',
        '4xl': 'sm:max-w-4xl',
        '5xl': 'sm:max-w-5xl',
        '6xl': 'sm:max-w-6xl',
        '7xl': 'sm:max-w-7xl',
        full: 'sm:max-w-full',
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={cn(
                    sizeClasses[size],
                    'flex w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden gap-0 p-0 max-h-[calc(100svh-var(--safe-area-top)-var(--safe-area-bottom)-1rem)] sm:w-full sm:max-h-[calc(100svh-2rem)]',
                    className
                )}
                // Hide default close button if showCloseButton is false
                onPointerDownOutside={(e) => e.preventDefault()}
                onOpenAutoFocus={onOpenAutoFocus}
                hideCloseButton
            >
                {/* Header */}
                {hideHeader ? (
                    (title || description) ? (
                        <DialogHeader className="sr-only">
                            {title && <DialogTitle>{title}</DialogTitle>}
                            {description && <DialogDescription>{description}</DialogDescription>}
                        </DialogHeader>
                    ) : null
                ) : (
                    (title || description || headerActions || showCloseButton) && (
                        <div className={cn('flex flex-shrink-0 flex-wrap items-center gap-3 px-4 pb-2 pt-[max(0.75rem,var(--safe-area-top))] md:px-6 md:py-4', !(title || description || headerActions) && 'justify-end')}>
                            {(title || description) && (
                                <DialogHeader className="min-w-0 flex-1 py-0">
                                    {title && <DialogTitle>{title}</DialogTitle>}
                                    {description && <DialogDescription>{description}</DialogDescription>}
                                </DialogHeader>
                            )}

                            {(headerActions || showCloseButton) && (
                                <div className={cn('ml-auto flex max-w-full items-center gap-2', !(title || description) && 'w-full justify-end')}>
                                    {headerActions && <div className="max-w-full shrink-0">{headerActions}</div>}

                                    {showCloseButton && (
                                        <DialogClose asChild>
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                className="rounded-full"
                                                aria-label="Close dialog"
                                            >
                                                <XMarkIcon className="h-5 w-5" />
                                                <span className="sr-only">Close</span>
                                            </Button>
                                        </DialogClose>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                )}
                
                {/* Scrollable Content */}
                <div ref={contentRef} className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3.5 sm:px-6 sm:py-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <DialogFooter className="flex-shrink-0 border-t border-border px-4 pb-[max(0.75rem,var(--safe-area-bottom))] pt-3 sm:px-6 sm:py-4">
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
    hideHeader: PropTypes.bool,
    headerActions: PropTypes.node,
    className: PropTypes.string,
    footer: PropTypes.node,
    contentRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({ current: PropTypes.any }),
    ]),
    onOpenAutoFocus: PropTypes.func,
};

export default Modal;
