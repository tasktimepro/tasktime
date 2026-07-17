const CSP_META_PATTERN = /(<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=")([^"]*)("[^>]*>)/i;
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Resolve the configured sync Worker URL to a CSP-safe origin.
 *
 * @param {string} workerUrl Configured sync Worker base URL.
 * @returns {string} Validated origin for the connect-src directive.
 */
function getSyncWorkerOrigin(workerUrl) {

    let parsedUrl;

    try {

        parsedUrl = new URL(workerUrl);
    } catch {

        throw new Error('VITE_SYNC_WORKER_URL must be a valid HTTPS or loopback HTTP URL.');
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const isLoopbackHttp = parsedUrl.protocol === 'http:'
        && LOOPBACK_HOSTNAMES.has(parsedUrl.hostname);

    if ((!isHttps && !isLoopbackHttp) || parsedUrl.username || parsedUrl.password) {

        throw new Error('VITE_SYNC_WORKER_URL must be an HTTPS URL without credentials, or an explicit loopback HTTP URL.');
    }

    return parsedUrl.origin;
}

/**
 * Add the configured sync Worker origin to the HTML CSP connect-src directive.
 * The origin is injected at dev/build time so non-production deployments do not
 * require production HTML to permanently trust their Worker hostnames.
 *
 * @param {string} html Vite index HTML.
 * @param {string | undefined} workerUrl Configured sync Worker base URL.
 * @returns {string} HTML with the configured Worker origin allowed.
 */
export function injectSyncWorkerCspOrigin(html, workerUrl) {

    if (!workerUrl) {

        return html;
    }

    const origin = getSyncWorkerOrigin(workerUrl);
    const cspMatch = html.match(CSP_META_PATTERN);

    if (!cspMatch) {

        throw new Error('Content Security Policy meta tag is required before adding VITE_SYNC_WORKER_URL.');
    }

    const directives = cspMatch[2].split(';');
    const connectSrcIndex = directives.findIndex((directive) => (
        directive.trim().split(/\s+/, 1)[0] === 'connect-src'
    ));

    if (connectSrcIndex === -1) {

        throw new Error('Content Security Policy connect-src directive is required for VITE_SYNC_WORKER_URL.');
    }

    const connectSrc = directives[connectSrcIndex];
    const leadingWhitespace = connectSrc.match(/^\s*/)?.[0] ?? '';
    const sources = connectSrc.trim().split(/\s+/);

    if (sources.includes(origin)) {

        return html;
    }

    directives[connectSrcIndex] = `${leadingWhitespace}${sources.join(' ')} ${origin}`;

    const updatedPolicy = directives.join(';');

    return html.replace(
        CSP_META_PATTERN,
        `${cspMatch[1]}${updatedPolicy}${cspMatch[3]}`,
    );
}

/**
 * Create the Vite HTML transform that binds CSP to the selected sync Worker.
 *
 * @param {string | undefined} workerUrl Configured sync Worker base URL.
 * @returns {import('vite').Plugin} Vite plugin.
 */
export function syncWorkerCspPlugin(workerUrl) {

    return {
        name: 'tasktime-sync-worker-csp',
        enforce: 'pre',
        transformIndexHtml(html) {

            return injectSyncWorkerCspOrigin(html, workerUrl);
        },
    };
}
