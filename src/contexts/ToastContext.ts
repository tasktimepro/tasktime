import { createContext } from 'react';

export type ToastContextValue = {
    showSuccess: (message: string, duration?: number) => void;
    showError: (message: string, duration?: number) => void;
    showInfo: (message: string, duration?: number) => void;
    showWarning: (message: string, duration?: number) => void;
};

// Create context for toast management
export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
