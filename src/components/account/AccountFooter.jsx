import LegalInlineLinks from '@/components/legal/LegalInlineLinks';
import { cn } from '@/lib/utils';

/**
 * Shared footer shown under every Account tab.
 */
const AccountFooter = ({ className }) => {
    return (
        <footer className={cn('flex justify-end', className)}>
            <LegalInlineLinks className="sm:text-right" />
        </footer>
    );
};

export default AccountFooter;