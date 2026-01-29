import { useState, useEffect } from 'react';
import { WifiOffIcon } from '@/components/ui/icons';

/**
 * Displays a notification when the user goes offline
 * Automatically appears/disappears based on network status
 */
const OfflineIndicator = ({ className = '' }) => {

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    
    useEffect(() => {

        const updateOfflineState = () => {
            setIsOffline(!navigator.onLine);
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                updateOfflineState();
            }
        };

        updateOfflineState();
        
        window.addEventListener('online', updateOfflineState);
        window.addEventListener('offline', updateOfflineState);
        window.addEventListener('focus', updateOfflineState);
        document.addEventListener('visibilitychange', handleVisibility);

        const interval = setInterval(updateOfflineState, 5000);
        
        return () => {

            window.removeEventListener('online', updateOfflineState);
            window.removeEventListener('offline', updateOfflineState);
            window.removeEventListener('focus', updateOfflineState);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, []);
    
    if (!isOffline) return null;
    
    return (
        <div
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md bg-yellow-50 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 ${className}`}
        >
            <WifiOffIcon className="h-5 w-5 mr-3 flex-shrink-0" />
            <span>You&apos;re offline</span>
        </div>
    );
};

export default OfflineIndicator;
