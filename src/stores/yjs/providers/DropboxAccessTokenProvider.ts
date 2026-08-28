import { SYNC_WORKER_CONFIG } from '@/config/google';
import { APP_VERSION } from '@/constants/app';

const REQUIRED_SCOPES = [
    'files.content.read',
    'files.content.write',
    'files.metadata.read',
    'files.metadata.write',
] as const;
const EARLY_EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const MAX_LOCAL_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_RETRY_AFTER_SECONDS = 60 * 60;
const WORKER_ERROR_CODES = new Set([
    'INTERNAL_ERROR',
    'INVALID_REQUEST',
    'MISSING_REQUIRED_SCOPE',
    'NEW_CONNECTIONS_DISABLED',
    'ORIGIN_NOT_ALLOWED',
    'PROVIDER_DISABLED',
    'RATE_LIMITED',
    'REFRESH_FAILED',
    'SESSION_NOT_FOUND',
    'SESSION_PROVIDER_MISMATCH',
    'TOKEN_SERVICE_UNAVAILABLE',
]);

interface DropboxAccessTokenProviderOptions {
    endpoint: string;
    now?: () => number;
}

interface GetTokenOptions {
    forceRefresh?: boolean;
}

interface AccessTokenResponse {
    accessToken: string;
    tokenType: 'Bearer';
    expiresAt: number;
    serverTime: number;
    scope: string;
}

interface CachedToken {
    value: string;
    validUntil: number;
}

interface InFlightTokenRequest {
    forceRefresh: boolean;
    promise: Promise<string>;
}

function withAppVersion(endpoint: string): string {
    const url = new URL(endpoint);
    url.searchParams.set('appVersion', APP_VERSION);
    return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTokenResponse(value: unknown): AccessTokenResponse {
    if (!isRecord(value)
        || typeof value.accessToken !== 'string'
        || !value.accessToken.trim()
        || value.tokenType !== 'Bearer'
        || typeof value.expiresAt !== 'number'
        || !Number.isFinite(value.expiresAt)
        || typeof value.serverTime !== 'number'
        || !Number.isFinite(value.serverTime)
        || typeof value.scope !== 'string') {
        throw new DropboxAccessTokenError(
            'INVALID_TOKEN_RESPONSE',
            'The Dropbox token service returned an invalid response.',
        );
    }
    const scopes = new Set(value.scope.split(/\s+/).filter(Boolean));
    if (!REQUIRED_SCOPES.every(scope => scopes.has(scope))) {
        throw new DropboxAccessTokenError(
            'MISSING_REQUIRED_SCOPE',
            'The Dropbox session is missing a required file permission.',
        );
    }
    if (value.expiresAt - value.serverTime <= EARLY_EXPIRY_BUFFER_MS) {
        throw new DropboxAccessTokenError(
            'INVALID_TOKEN_RESPONSE',
            'The Dropbox token service returned unusable access.',
        );
    }
    return value as unknown as AccessTokenResponse;
}

function parseRetryAfter(response: Response): number | undefined {
    const seconds = Number.parseInt(response.headers.get('Retry-After') || '', 10);
    return Number.isFinite(seconds) && seconds > 0
        ? Math.min(seconds, MAX_RETRY_AFTER_SECONDS)
        : undefined;
}

async function readWorkerErrorCode(response: Response): Promise<string> {
    try {
        const value: unknown = await response.json();
        if (isRecord(value)
            && typeof value.code === 'string'
            && WORKER_ERROR_CODES.has(value.code)) {
            return value.code;
        }
    } catch {
        // Worker response bodies are untrusted and intentionally discarded.
    }
    if (response.status === 401) return 'SESSION_NOT_FOUND';
    if (response.status === 404) return 'PROVIDER_DISABLED';
    if (response.status === 429) return 'RATE_LIMITED';
    if (response.status >= 500) return 'TOKEN_SERVICE_UNAVAILABLE';
    return 'TOKEN_REQUEST_FAILED';
}

function messageForWorkerError(code: string): string {
    switch (code) {
        case 'SESSION_NOT_FOUND':
        case 'REFRESH_FAILED':
        case 'SESSION_PROVIDER_MISMATCH':
            return 'The Dropbox session is no longer available.';
        case 'PROVIDER_DISABLED':
            return 'Dropbox access is currently disabled.';
        case 'MISSING_REQUIRED_SCOPE':
            return 'The Dropbox session is missing a required file permission.';
        case 'RATE_LIMITED':
            return 'Dropbox token requests are temporarily rate limited.';
        case 'TOKEN_SERVICE_UNAVAILABLE':
        case 'INTERNAL_ERROR':
            return 'The Dropbox token service is temporarily unavailable.';
        default:
            return 'The Dropbox token request was rejected.';
    }
}

export class DropboxAccessTokenError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly retryAfterSeconds?: number;

    constructor(
        code: string,
        message: string,
        options: { status?: number; retryAfterSeconds?: number } = {},
    ) {
        super(message);
        this.name = 'DropboxAccessTokenError';
        this.code = code;
        this.status = options.status;
        this.retryAfterSeconds = options.retryAfterSeconds;
    }
}

/** Owns a short-lived Dropbox access token in this module instance only. */
export class DropboxAccessTokenProvider {
    private readonly endpoint: string;
    private readonly now: () => number;
    private sessionId: string | null = null;
    private generation = 0;
    private cachedToken: CachedToken | null = null;
    private inFlight: InFlightTokenRequest | null = null;
    private expiryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor({ endpoint, now = Date.now }: DropboxAccessTokenProviderOptions) {
        this.endpoint = endpoint;
        this.now = now;
    }

    setSession(sessionId: string | null): void {
        if (this.sessionId === sessionId) return;
        this.sessionId = sessionId;
        this.clearToken();
    }

    clearToken(): void {
        this.generation += 1;
        this.cachedToken = null;
        this.inFlight = null;
        if (this.expiryTimer !== null) {
            clearTimeout(this.expiryTimer);
            this.expiryTimer = null;
        }
    }

    hasCachedToken(): boolean {
        return Boolean(this.cachedToken && this.now() < this.cachedToken.validUntil);
    }

    getToken({ forceRefresh = false }: GetTokenOptions = {}): Promise<string> {
        if (!this.sessionId) {
            return Promise.reject(new DropboxAccessTokenError(
                'SESSION_NOT_FOUND',
                'Connect Dropbox before requesting an access token.',
            ));
        }
        if (!forceRefresh && this.cachedToken && this.now() < this.cachedToken.validUntil) {
            return Promise.resolve(this.cachedToken.value);
        }
        if (this.inFlight && (!forceRefresh || this.inFlight.forceRefresh)) {
            return this.inFlight.promise;
        }
        if (forceRefresh) {
            this.generation += 1;
            this.cachedToken = null;
        }

        const generation = this.generation;
        const sessionId = this.sessionId;
        const promise = this.requestToken(sessionId, generation, forceRefresh);
        const request = { forceRefresh, promise };
        this.inFlight = request;
        void promise.finally(() => {
            if (this.inFlight === request) this.inFlight = null;
        }).catch(() => {
            // The caller owns the original promise rejection.
        });
        return promise;
    }

    private async requestToken(
        sessionId: string,
        generation: number,
        forceRefresh: boolean,
    ): Promise<string> {
        let response: Response;
        try {
            response = await fetch(withAppVersion(this.endpoint), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId,
                    'X-TaskTime-App-Version': APP_VERSION,
                },
                body: JSON.stringify({ forceRefresh }),
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
        } catch {
            throw new DropboxAccessTokenError(
                'TOKEN_SERVICE_UNAVAILABLE',
                'The Dropbox token service is temporarily unavailable.',
            );
        }
        if (!response.ok) {
            const code = await readWorkerErrorCode(response);
            throw new DropboxAccessTokenError(code, messageForWorkerError(code), {
                status: response.status,
                retryAfterSeconds: parseRetryAfter(response),
            });
        }

        let value: unknown;
        try {
            value = await response.json();
        } catch {
            throw new DropboxAccessTokenError(
                'INVALID_TOKEN_RESPONSE',
                'The Dropbox token service returned an invalid response.',
            );
        }
        const token = parseTokenResponse(value);
        if (generation !== this.generation || sessionId !== this.sessionId) {
            throw new DropboxAccessTokenError(
                'STALE_TOKEN_RESPONSE',
                'A superseded Dropbox token response was discarded.',
            );
        }

        const lifetimeMs = Math.min(token.expiresAt - token.serverTime, MAX_LOCAL_TOKEN_TTL_MS);
        const cachedToken = {
            value: token.accessToken,
            validUntil: this.now() + lifetimeMs - EARLY_EXPIRY_BUFFER_MS,
        };
        this.cachedToken = cachedToken;
        this.expiryTimer = setTimeout(() => {
            if (this.cachedToken === cachedToken) {
                this.cachedToken = null;
                this.expiryTimer = null;
            }
        }, cachedToken.validUntil - this.now());
        return token.accessToken;
    }
}

export const dropboxAccessTokenProvider = new DropboxAccessTokenProvider({
    endpoint: SYNC_WORKER_CONFIG.endpoints.dropboxAccessToken,
});
