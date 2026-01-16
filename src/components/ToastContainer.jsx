import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { ToastContext } from '../contexts/ToastContext';
import { TOAST_DURATION_DEFAULT_MS, TOAST_DURATION_WARNING_MS } from '../constants/app';

/**
 * Toast provider component that manages toasts across the application
 * Uses shadcn/ui Sonner component under the hood
 */
export const ToastProvider = ({ children }) => {

    // Helper methods for different toast types - wraps sonner's toast API
    const showSuccess = (message, duration = TOAST_DURATION_DEFAULT_MS) => {
        toast.success(message, { duration });
    };

    const showError = (message, duration = TOAST_DURATION_DEFAULT_MS) => {
        toast.error(message, { duration });
    };

    const showInfo = (message, duration = TOAST_DURATION_DEFAULT_MS) => {
        toast.info(message, { duration });
    };

    const showWarning = (message, duration = TOAST_DURATION_WARNING_MS) => {
        toast.warning(message, { duration });
    };

    // Legacy addToast for backwards compatibility
    const addToast = (message, type = 'success', duration = TOAST_DURATION_DEFAULT_MS) => {
        const toastFn = {
            success: toast.success,
            error: toast.error,
            info: toast.info,
            warning: toast.warning,
        }[type] || toast;
        
        toastFn(message, { duration });
    };

    // removeToast is no longer needed with sonner (it handles dismissal automatically)
    const removeToast = () => {};

    return (
        <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showInfo, showWarning }}>
            {children}
            <Toaster position="bottom-right" />
        </ToastContext.Provider>
    );
};
