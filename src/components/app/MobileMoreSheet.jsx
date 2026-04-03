import PropTypes from 'prop-types';
import { EyeIcon, EyeOffIcon, MoonIcon, SunIcon, UserCircleIcon } from '@/components/ui/icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import CloudSyncStatusPanel from '@/components/sync/CloudSyncStatusPanel';

const MobileMoreSheet = ({
    darkMode,
    isOpen,
    items,
    onClose,
    onOpenAccount,
    onOpenChange,
    onToggleDarkMode,
    onToggleTotals,
    totalsHidden,
}) => {
    const actionTileClassName = 'flex min-h-24 flex-col items-center justify-center rounded-2xl border border-border bg-card px-3 py-4 text-center shadow-sm transition-colors hover:bg-accent cursor-pointer';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                hideCloseButton
                overlayClassName="bottom-safe-nav"
                className="bottom-safe-nav left-0 right-0 top-auto flex min-h-0 w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-[1.75rem] rounded-b-none border-x-0 border-b-0 bg-card p-0 shadow-none max-h-safe-nav"
            >
                <DialogTitle className="sr-only">More navigation</DialogTitle>
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-safe-sheet pt-4">
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

                    <div className="grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={onToggleTotals}
                            className={actionTileClassName}
                            aria-label={totalsHidden ? 'Show totals' : 'Hide totals'}
                            title={totalsHidden ? 'Show totals' : 'Hide totals'}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                {totalsHidden ? (
                                    <EyeIcon className="h-5 w-5" />
                                ) : (
                                    <EyeOffIcon className="h-5 w-5" />
                                )}
                            </div>
                            <span className="mt-2 text-sm font-medium text-foreground">
                                {totalsHidden ? 'Show totals' : 'Hide totals'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={onToggleDarkMode}
                            className={actionTileClassName}
                            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            title={darkMode ? 'Light mode' : 'Dark mode'}
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                {darkMode ? (
                                    <SunIcon className="h-5 w-5" />
                                ) : (
                                    <MoonIcon className="h-5 w-5" />
                                )}
                            </div>
                            <span className="mt-2 text-sm font-medium text-foreground">
                                {darkMode ? 'Light mode' : 'Dark mode'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={onOpenAccount}
                            className={actionTileClassName}
                            aria-label="Account"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                                <UserCircleIcon className="h-5 w-5" />
                            </div>
                            <span className="mt-2 text-sm font-medium text-foreground">Account</span>
                        </button>
                        </div>

                    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
                        <CloudSyncStatusPanel className="space-y-1" onActionComplete={onClose} />
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
    onOpenAccount: PropTypes.func.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    onToggleDarkMode: PropTypes.func.isRequired,
    onToggleTotals: PropTypes.func.isRequired,
    totalsHidden: PropTypes.bool.isRequired,
};

export default MobileMoreSheet;