import { toast } from 'sonner';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ToastContext } from '../contexts/ToastContext.ts';
import { APP_VERSION, TOAST_DURATION_DEFAULT_MS, TOAST_DURATION_WARNING_MS } from '../constants/app.ts';
import { consumePostReloadToast, rememberAppVersion } from '../utils/postReloadToast.ts';

/**
 * Toast provider component that manages toasts across the application
 * Uses shadcn/ui Sonner component under the hood
 */
export const ToastProvider = ({ children }) => {

    useEffect(() => {
        rememberAppVersion(APP_VERSION);

        const showPendingPostReloadToast = () => {
            const pendingToast = consumePostReloadToast();

            if (!pendingToast) {
                return;
            }

            const options = pendingToast.duration ? { duration: pendingToast.duration } : undefined;

            switch (pendingToast.level) {
                case 'success':
                    toast.success(pendingToast.message, options);
                    break;
                case 'error':
                    toast.error(pendingToast.message, options);
                    break;
                case 'info':
                    toast.info(pendingToast.message, options);
                    break;
                case 'warning':
                    toast.warning(pendingToast.message, options);
                    break;
                default:
                    break;
            }
        };

        if (typeof document !== 'undefined' && document.hidden) {
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    return;
                }

                document.removeEventListener('visibilitychange', handleVisibilityChange);
                showPendingPostReloadToast();
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }

        showPendingPostReloadToast();
    }, []);

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

    return (
        <ToastContext.Provider value={{ showSuccess, showError, showInfo, showWarning }}>
            {children}
            <Toaster
                position="bottom-right"
                offset={{ bottom: '1rem', right: '1rem' }}
                mobileOffset={{
                    bottom: 'calc(env(safe-area-inset-bottom) + 5.75rem)',
                    left: '1rem',
                    right: '1rem'
                }}
            />
        </ToastContext.Provider>
    );
};
