import PropTypes from 'prop-types';
import { MoreHorizontalIcon } from '@/components/ui/icons';

const MobileBottomNav = ({ items, isMoreActive, moreButton, moreButtonBadge, onOpenMore }) => {
    const MoreButtonIcon = moreButton?.Icon || MoreHorizontalIcon;
    const moreButtonLabel = moreButton?.label || 'More';
    const moreButtonAriaLabel = moreButton?.ariaLabel || moreButtonLabel;
    const moreButtonToneClassName = moreButton?.toneClassName || (isMoreActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground');
    const moreButtonOpacityClassName = moreButton?.isFadingOut ? 'opacity-0' : 'opacity-100';
    const moreButtonDescriptionId = moreButtonBadge ? 'mobile-more-button-status' : undefined;

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-safe-bottom md:hidden"
            aria-label="Mobile navigation"
        >
            <div className="grid grid-cols-5 gap-1 px-2 py-2">
                {items.map((item) => {
                    const ItemIcon = item.Icon;

                    return (
                    <button
                        key={item.key}
                        type="button"
                        onClick={item.onClick}
                        className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors cursor-pointer ${item.isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                        aria-label={item.label}
                    >
                        <ItemIcon className="mb-1 h-5 w-5" />
                        <span>{item.label}</span>
                    </button>
                    );
                })}
                <button
                    type="button"
                    onClick={moreButton?.onClick || onOpenMore}
                    className={`relative flex min-h-14 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-[opacity,color,background-color] duration-200 cursor-pointer ${moreButtonToneClassName} ${moreButtonOpacityClassName}`}
                    aria-label={moreButtonAriaLabel}
                    aria-describedby={moreButtonDescriptionId}
                >
                    <span className="relative mb-1 flex h-5 w-5 items-center justify-center">
                        <MoreButtonIcon className="h-5 w-5" />
                        {moreButtonBadge && (
                            <span
                                aria-hidden="true"
                                data-testid="mobile-more-status-dot"
                                className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${moreButtonBadge.toneClassName}`}
                            />
                        )}
                    </span>
                    <span>{moreButtonLabel}</span>
                    {moreButtonBadge && (
                        <span id={moreButtonDescriptionId} className="sr-only">
                            {moreButtonBadge.description}
                        </span>
                    )}
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
    moreButton: PropTypes.shape({
        ariaLabel: PropTypes.string,
        Icon: PropTypes.elementType,
        isFadingOut: PropTypes.bool,
        label: PropTypes.string,
        onClick: PropTypes.func,
        toneClassName: PropTypes.string,
    }),
    moreButtonBadge: PropTypes.shape({
        description: PropTypes.string.isRequired,
        toneClassName: PropTypes.string.isRequired,
    }),
    onOpenMore: PropTypes.func.isRequired,
};

export default MobileBottomNav;