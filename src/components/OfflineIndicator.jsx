import { useState, useEffect } from 'react';
import { WifiOffIcon } from '@/components/ui/icons';

/**
 * Displays a notification when the user goes offline
 * Automatically appears/disappears based on network status
 */
const OfflineIndicator = () => {

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    
    useEffect(() => {

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {

            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    
    if (!isOffline) return null;
    
    return (
        <div className="fixed bottom-4 left-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
            <WifiOffIcon className="h-5 w-5" />
            <span>You&apos;re offline — changes saved locally</span>
        </div>
    );
};

export default OfflineIndicator;
