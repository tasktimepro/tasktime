import PropTypes from 'prop-types';
import { ArrowLeftIcon, ClockIcon, MoreHorizontalIcon, PlusIcon } from '@/components/ui/icons';

const MobileTopBar = ({
    canGoBack,
    headerContext,
    headerTitle,
    isMoreViewActive,
    onBack,
    onCreateTask,
    onOpenMore,
    onOpenDashboard,
    showCreateAction,
}) => {

    return (
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                {canGoBack ? (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        aria-label="Back"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onOpenDashboard}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm cursor-pointer"
                        aria-label="Go to Dashboard"
                    >
                        <ClockIcon className="h-5 w-5" />
                    </button>
                )}

                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {headerContext}
                    </p>
                    <h1 className="truncate text-lg font-semibold text-foreground">
                        {headerTitle}
                    </h1>
                </div>

                {showCreateAction && (
                    <button
                        type="button"
                        onClick={onCreateTask}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent cursor-pointer"
                        aria-label="Create new task"
                    >
                        <PlusIcon className="h-5 w-5" />
                    </button>
                )}

                <button
                    type="button"
                    onClick={onOpenMore}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors cursor-pointer ${isMoreViewActive ? 'text-foreground bg-accent' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                    aria-label="Open more actions"
                >
                    <MoreHorizontalIcon className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

MobileTopBar.propTypes = {
    canGoBack: PropTypes.bool.isRequired,
    headerContext: PropTypes.string.isRequired,
    headerTitle: PropTypes.string.isRequired,
    isMoreViewActive: PropTypes.bool.isRequired,
    onBack: PropTypes.func.isRequired,
    onCreateTask: PropTypes.func.isRequired,
    onOpenMore: PropTypes.func.isRequired,
    onOpenDashboard: PropTypes.func.isRequired,
    showCreateAction: PropTypes.bool.isRequired,
};

export default MobileTopBar;