import PropTypes from 'prop-types';
import { MoreHorizontalIcon } from '@/components/ui/icons';

const MobileBottomNav = ({ items, isMoreActive, onOpenMore }) => {

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe-bottom backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
            aria-label="Mobile navigation"
        >
            <div className="grid grid-cols-5 gap-1 px-2 py-2">
                {items.map(({ key, label, Icon, isActive, onClick }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={onClick}
                        className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors cursor-pointer ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                        aria-label={label}
                    >
                        <Icon className="mb-1 h-5 w-5" />
                        <span>{label}</span>
                    </button>
                ))}
                <button
                    type="button"
                    onClick={onOpenMore}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors cursor-pointer ${isMoreActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                    aria-label="More"
                >
                    <MoreHorizontalIcon className="mb-1 h-5 w-5" />
                    <span>More</span>
                </button>
            </div>
        </nav>
    );
};

MobileBottomNav.propTypes = {
    isMoreActive: PropTypes.bool.isRequired,
    items: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        Icon: PropTypes.elementType.isRequired,
        isActive: PropTypes.bool.isRequired,
        onClick: PropTypes.func.isRequired,
    })).isRequired,
    onOpenMore: PropTypes.func.isRequired,
};

export default MobileBottomNav;