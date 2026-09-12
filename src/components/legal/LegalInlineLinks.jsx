import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';
import { TASKTIME_ORIGIN_CONFIG } from '@/config/syncWorker';

function LegalLink({ href, label, linkClassName, openInNewTab }) {
    return (
        <a
            href={href}
            className={cn('font-medium text-foreground underline underline-offset-4 hover:text-primary', linkClassName)}
            target={openInNewTab ? '_blank' : undefined}
            rel={openInNewTab ? 'noreferrer noopener' : undefined}
        >
            {label}
        </a>
    );
}

LegalLink.propTypes = {
    href: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    linkClassName: PropTypes.string,
    openInNewTab: PropTypes.bool.isRequired,
};

/**
 * Inline legal links for shared usage across app surfaces.
 */
const LegalInlineLinks = ({ className, linkClassName, openInNewTab = true, prefix = 'By using this app, you also agree to our ' }) => {
    return (
        <p className={cn('text-sm leading-6 text-muted-foreground', className)}>
            <span>{prefix}</span>
            <LegalLink
                href={`${TASKTIME_ORIGIN_CONFIG.marketingOrigin}/privacy/`}
                label="Privacy"
                linkClassName={linkClassName}
                openInNewTab={openInNewTab}
            />
            <span> and </span>
            <LegalLink
                href={`${TASKTIME_ORIGIN_CONFIG.marketingOrigin}/terms/`}
                label="Terms"
                linkClassName={linkClassName}
                openInNewTab={openInNewTab}
            />
            <span>.</span>
        </p>
    );
};

LegalInlineLinks.propTypes = {
    className: PropTypes.string,
    linkClassName: PropTypes.string,
    openInNewTab: PropTypes.bool,
    prefix: PropTypes.string,
};

export default LegalInlineLinks;
