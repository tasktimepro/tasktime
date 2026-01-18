import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

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
