import { useState, useEffect, useRef } from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { INSTALL_PROMPT_DELAY_MS } from '@/constants/app.ts';

/**
 * Shows an install prompt for PWA installation
 * Only appears after the user has used the app for a while
 * and the browser supports PWA installation
 */
const InstallPrompt = () => {

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const promptTimeoutRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const retryDelayMs = 60000;

    useEffect(() => {
        const isInputFocused = () => {
            const activeElement = document.activeElement;
            return !!(activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.isContentEditable
            ));
        };

        const isModalOpen = () => !!document.querySelector('[data-state="open"][role="dialog"]');

        const shouldPostpone = () => isInputFocused() || isModalOpen();

        const attemptShowPrompt = () => {
            if (!deferredPrompt || showPrompt) return;

            if (shouldPostpone()) {
                retryTimeoutRef.current = setTimeout(attemptShowPrompt, retryDelayMs);
                return;
            }

            setShowPrompt(true);
        };

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);

            if (promptTimeoutRef.current) {
                clearTimeout(promptTimeoutRef.current);
            }

            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }

            promptTimeoutRef.current = setTimeout(attemptShowPrompt, INSTALL_PROMPT_DELAY_MS);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            if (promptTimeoutRef.current) {
                clearTimeout(promptTimeoutRef.current);
            }
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [deferredPrompt, showPrompt]);
    
    const handleInstall = async () => {

        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {

            setDeferredPrompt(null);
            setShowPrompt(false);
        }
    };
    
    const handleDismiss = () => {

        setShowPrompt(false);
        // Don't show again for this session
    };
    
    if (!showPrompt || !deferredPrompt) return null;
    
    return (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg shadow-xl p-4 max-w-sm z-50">
            <Button
                onClick={handleDismiss}
                variant="ghost"
                size="icon-sm"
                iconOnly
                leadingIcon={XMarkIcon}
                iconClassName="h-5 w-5"
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss install prompt"
            />
            <h3 className="font-semibold text-foreground mb-2">Install TaskTime</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Install TaskTime for quick access and offline use.
            </p>
            <Button
                onClick={handleInstall}
                leadingIcon={ArrowDownTrayIcon}
                fullWidth
            >
                Install App
            </Button>
        </div>
    );
};

export default InstallPrompt;
