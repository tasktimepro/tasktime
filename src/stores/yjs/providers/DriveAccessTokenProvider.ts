import { SYNC_WORKER_CONFIG } from '@/config/google';
import { APP_VERSION } from '@/constants/app';

const DRIVE_APP_DATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const EARLY_EXPIRY_BUFFER_MS = 2 * 60 * 1000;
const MAX_LOCAL_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_RETRY_AFTER_SECONDS = 60 * 60;

const WORKER_ERROR_CODES = new Set([
    'DIRECT_TRANSPORT_DISABLED',
    'DRIVE_NOT_ENTITLED',
    'INTERNAL_ERROR',
    'INVALID_REQUEST',
    'ORIGIN_NOT_ALLOWED',
    'RATE_LIMITED',
    'REFRESH_FAILED',
    'SESSION_NOT_FOUND',
    'TOKEN_SERVICE_UNAVAILABLE',
]);

export class DriveAccessTokenError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly retryAfterSeconds?: number;

    constructor(
        code: string,
        message: string,
        options: { status?: number; retryAfterSeconds?: number } = {},
    ) {
        super(message);
        this.name = 'DriveAccessTokenError';
        this.code = code;
        this.status = options.status;
        this.retryAfterSeconds = options.retryAfterSeconds;
    }
}

interface TokenProviderOptions {
    endpoint: string;
    now?: () => number;
}

interface GetTokenOptions {
    forceRefresh?: boolean;
}

interface CachedToken {
    value: string;
    validUntil: number;
}

interface InFlightTokenRequest {
    forceRefresh: boolean;
    promise: Promise<string>;
}

interface AccessTokenResponse {
    accessToken: string;
    tokenType: 'Bearer';
    expiresAt: number;
    serverTime: number;
    scope?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTokenResponse(value: unknown): AccessTokenResponse {
    if (!isRecord(value)
        || typeof value.accessToken !== 'string'
        || value.accessToken.trim().length === 0
        || value.tokenType !== 'Bearer'
        || typeof value.expiresAt !== 'number'
        || !Number.isFinite(value.expiresAt)
        || typeof value.serverTime !== 'number'
        || !Number.isFinite(value.serverTime)
        || (value.scope !== undefined && typeof value.scope !== 'string')) {
        throw new DriveAccessTokenError(
            'INVALID_TOKEN_RESPONSE',
            'The Google Drive token service returned an invalid response.',
        );
    }

    const lifetimeMs = value.expiresAt - value.serverTime;
    if (lifetimeMs <= EARLY_EXPIRY_BUFFER_MS) {
        throw new DriveAccessTokenError(
            'INVALID_TOKEN_RESPONSE',
            'The Google Drive token service returned an unusable expiry.',
        );
    }

    const scope = value.scope as string | undefined;
    if (scope !== undefined) {
        const scopes = scope.split(/\s+/).filter(Boolean);
        if (!scopes.includes(DRIVE_APP_DATA_SCOPE)) {
            throw new DriveAccessTokenError(
                'INVALID_TOKEN_RESPONSE',
                'The Google Drive token does not include app-data access.',
            );
        }
    }

    return value as unknown as AccessTokenResponse;
}

function parseRetryAfter(response: Response): number | undefined {
    const parsed = Number.parseInt(response.headers.get('Retry-After') || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.min(parsed, MAX_RETRY_AFTER_SECONDS);
}

async function readWorkerErrorCode(response: Response): Promise<string> {
    try {
        const value: unknown = await response.json();
        if (isRecord(value) && typeof value.code === 'string' && WORKER_ERROR_CODES.has(value.code)) {
            return value.code;
        }
    } catch {
        // The response body is untrusted and intentionally omitted from errors.
    }

    if (response.status === 401) return 'SESSION_NOT_FOUND';
    if (response.status === 409) return 'DIRECT_TRANSPORT_DISABLED';
    if (response.status === 429) return 'RATE_LIMITED';
    if (response.status >= 500) return 'TOKEN_SERVICE_UNAVAILABLE';
    return 'TOKEN_REQUEST_FAILED';
}

function messageForWorkerError(code: string): string {
    switch (code) {
        case 'SESSION_NOT_FOUND':
        case 'REFRESH_FAILED':
            return 'The Google Drive session is no longer available.';
        case 'DIRECT_TRANSPORT_DISABLED':
            return 'Direct Google Drive access is currently disabled.';
        case 'DRIVE_NOT_ENTITLED':
            return 'Google Drive sync is not available for this account.';
        case 'RATE_LIMITED':
            return 'Google Drive token requests are temporarily rate limited.';
        case 'TOKEN_SERVICE_UNAVAILABLE':
        case 'INTERNAL_ERROR':
            return 'The Google Drive token service is temporarily unavailable.';
        default:
            return 'The Google Drive token request was rejected.';
    }
}

/**
 * Owns a short-lived Google access token in this module instance only.
 * It never writes credentials to React state, browser storage, cache, logs,
 * diagnostics, backups, or exports.
 */
export class DriveAccessTokenProvider {
    private readonly endpoint: string;
    private readonly now: () => number;
    private sessionId: string | null = null;
    private generation = 0;
    private cachedToken: CachedToken | null = null;
    private inFlight: InFlightTokenRequest | null = null;
    private expiryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor({ endpoint, now = Date.now }: TokenProviderOptions) {
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
            return Promise.reject(new DriveAccessTokenError(
                'SESSION_NOT_FOUND',
                'Connect Google Drive before requesting an access token.',
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
        const request: InFlightTokenRequest = { forceRefresh, promise };
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
            response = await fetch(this.endpoint, {
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
            throw new DriveAccessTokenError(
                'TOKEN_SERVICE_UNAVAILABLE',
                'The Google Drive token service is temporarily unavailable.',
            );
        }

        if (!response.ok) {
            const code = await readWorkerErrorCode(response);
            throw new DriveAccessTokenError(code, messageForWorkerError(code), {
                status: response.status,
                retryAfterSeconds: parseRetryAfter(response),
            });
        }

        let value: unknown;
        try {
            value = await response.json();
        } catch {
            throw new DriveAccessTokenError(
                'INVALID_TOKEN_RESPONSE',
                'The Google Drive token service returned an invalid response.',
            );
        }

        const token = parseTokenResponse(value);
        if (generation !== this.generation || sessionId !== this.sessionId) {
            throw new DriveAccessTokenError(
                'STALE_TOKEN_RESPONSE',
                'A superseded Google Drive token response was discarded.',
            );
        }

        const lifetimeMs = Math.min(
            token.expiresAt - token.serverTime,
            MAX_LOCAL_TOKEN_TTL_MS,
        );
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

// One credential owner per browser tab. Consumers receive tokens only by
// calling getToken(); the token itself never enters React state/context.
export const driveAccessTokenProvider = new DriveAccessTokenProvider({
    endpoint: SYNC_WORKER_CONFIG.endpoints.authAccessToken,
});
