import PropTypes from 'prop-types';
import { CloudIcon, EyeIcon, EyeOffIcon, MoonIcon, SunIcon, XMarkIcon } from '@/components/ui/icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OfflineIndicator from '@/components/OfflineIndicator';
import YjsSyncStatus from '@/components/sync/YjsSyncStatus';

const MobileMoreSheet = ({
    darkMode,
    isOpen,
    items,
    onClose,
    onOpenChange,
    onToggleDarkMode,
    onToggleTotals,
    totalsHidden,
}) => {
    const syncItem = items.find((item) => item.key === 'sync');

    const handleSyncRowClick = (event) => {
        if (!syncItem?.onClick) {
            return;
        }

        if (event.target instanceof Element && event.target.closest('button')) {
            return;
        }

        syncItem.onClick();
    };

    const handleSyncRowKeyDown = (event) => {
        if (!syncItem?.onClick) {
            return;
        }

        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        if (event.target instanceof Element && event.target.closest('button')) {
            return;
        }

        event.preventDefault();
        syncItem.onClick();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                hideCloseButton
                className="left-0 right-0 top-auto bottom-0 grid max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-t-[1.75rem] rounded-b-none border-x-0 border-b-0 p-0"
            >
                <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
                    <div className="mb-4 flex justify-center">
                        <div className="h-1.5 w-14 rounded-full bg-border" aria-hidden="true" />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle className="text-xl">More</DialogTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Secondary navigation, sync, and display controls.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            aria-label="Close more navigation"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                </DialogHeader>

                <div className="space-y-6 overflow-y-auto px-5 pb-safe-sheet pt-5">
                    <div className="grid gap-3">
                        {items.map(({ key, label, description, Icon, onClick }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={onClick}
                                className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-sm transition-colors hover:bg-accent cursor-pointer"
                            >
                                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground">{label}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-foreground">Sync & appearance</h2>
                        <div className="mt-3 space-y-3">
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={handleSyncRowClick}
                                onKeyDown={handleSyncRowKeyDown}
                                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-accent cursor-pointer"
                                aria-label="Open sync settings"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                    <CloudIcon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">Cloud sync</p>
                                    <div className="mt-1">
                                        <YjsSyncStatus />
                                        <OfflineIndicator />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onToggleTotals}
                                className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-accent cursor-pointer"
                            >
                                <div>
                                    <p className="text-sm font-medium text-foreground">{totalsHidden ? 'Show totals' : 'Hide totals'}</p>
                                    <p className="text-sm text-muted-foreground">Control sensitive values across the app.</p>
                                </div>
                                {totalsHidden ? (
                                    <EyeIcon className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                    <EyeOffIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={onToggleDarkMode}
                                className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-accent cursor-pointer"
                            >
                                <div>
                                    <p className="text-sm font-medium text-foreground">{darkMode ? 'Light mode' : 'Dark mode'}</p>
                                    <p className="text-sm text-muted-foreground">Switch the app appearance for your environment.</p>
                                </div>
                                {darkMode ? (
                                    <SunIcon className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                    <MoonIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

MobileMoreSheet.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    isOpen: PropTypes.bool.isRequired,
    items: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
        Icon: PropTypes.elementType.isRequired,
        onClick: PropTypes.func.isRequired,
    })).isRequired,
    onClose: PropTypes.func.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    onToggleDarkMode: PropTypes.func.isRequired,
    onToggleTotals: PropTypes.func.isRequired,
    totalsHidden: PropTypes.bool.isRequired,
};

export default MobileMoreSheet;