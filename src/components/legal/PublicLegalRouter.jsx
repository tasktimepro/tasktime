import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';
import { getNormalizedPublicLegalPath } from './legalRoutes';

/**
 * Render the public legal page that matches the current path.
 */
const PublicLegalRouter = () => {
    const pathname = getNormalizedPublicLegalPath(window.location.pathname);

    if (pathname === '/privacy' || pathname === '/privacy-policy') {
        return <PrivacyPage />;
    }

    return <TermsPage />;
};

export default PublicLegalRouter;