import { parseExactWebOrigin, PRODUCTION_MARKETING_ORIGIN } from './origins';
import { publicPageRedirect, publicPageRedirectRules } from './publicRoutes';

/** Keep Vite dev/preview and Pages public-route handling consistent. */
export function publicSitePlugin(configuredOrigin) {
    const origin = parseExactWebOrigin(configuredOrigin || PRODUCTION_MARKETING_ORIGIN, 'marketing');
    const configure = server => {
        server.middlewares.use((request, response, next) => {
            const target = publicPageRedirect(request.url || '/', origin);
            if (!target) return next();
            response.writeHead(302, { Location: target });
            response.end();
        });
    };
    return {
        name: 'tasktime-public-site-boundary',
        configureServer: configure,
        configurePreviewServer: configure,
        generateBundle() {
            this.emitFile({ type: 'asset', fileName: '_redirects', source: publicPageRedirectRules(origin) });
        },
    };
}
