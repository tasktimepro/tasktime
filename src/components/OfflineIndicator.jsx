import { useState, useEffect } from 'react';
import { WifiOffIcon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Displays a notification when the user goes offline
 * Automatically appears/disappears based on network status
 */
const OfflineIndicator = ({ className = '', isCompact = false }) => {

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
    
    const content = (
        <div
            className={`${isCompact ? 'w-10 mx-auto justify-center px-2 py-2' : 'w-full px-3 py-2'} flex items-center text-sm font-medium rounded-md bg-yellow-50 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 ${className}`}
            title={isCompact ? undefined : 'You\'re offline'}
            aria-label={isCompact ? 'You\'re offline' : undefined}
        >
            <WifiOffIcon className={`h-5 w-5 ${isCompact ? '' : 'mr-3'} flex-shrink-0`} />
            {!isCompact && <span>You&apos;re offline</span>}
        </div>
    );

    if (!isCompact) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {content}
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
                You&apos;re offline
            </TooltipContent>
        </Tooltip>
    );
};

export default OfflineIndicator;
