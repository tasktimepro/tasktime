import {
    parseEntitlementSnapshot,
} from '@/domain/entitlements/entitlementPolicy';
import type { EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';
import { SYNC_WORKER_CONFIG } from '@/config/syncWorker';
import {
    parseBillingJwks,
    type BillingPublicJwk,
} from '@/utils/billingLicense';
import type { BillingOfferPrice } from '@/utils/billingOfferFormatter';

const CATALOG_MAX_BYTES = 65_536;
const JWKS_MAX_BYTES = 32_768;
const PRIVATE_MAX_BYTES = 131_072;

type FetchLike = typeof fetch;

export type BillingCatalogOfferV1 = BillingOfferPrice & {
    offerId: string;
    offerKind: 'founding' | 'standard';
    founding: {
        memberLimit: 1000;
        availability: 'available' | 'temporarily_reserved' | 'exhausted';
        priceRetention: 'while_same_subscription_continues_or_is_recoverable';
    } | null;
};

export type BillingCatalogV1 = {
    version: 1;
    planConfigVersion: string;
    purchaseEnabled: boolean;
    trial: { durationHours: 720; paymentMethodRequired: false; autoCharges: false };
    plans: [
        {
            plan: 'free';
            displayName: string;
            features: ['oneActiveClient', 'basicReportsOverview'];
            activeClients: 1;
            invoiceEmailSendsPerUtcMonth: 0;
            offers: [];
        },
        {
            plan: 'pro';
            displayName: string;
            features: ['unlimitedActiveClients', 'advancedReports', 'hostedEmail'];
            activeClients: null;
            invoiceEmailSendsPerUtcMonth: number | null;
            offers: BillingCatalogOfferV1[];
        },
    ];
    legal: { termsVersion: string; privacyVersion: string; refundPolicyVersion: string };
};

type ProjectedPrice = BillingOfferPrice & {
    priceRetention: 'while_same_subscription_continues_or_is_recoverable';
};

export type BillingStatusResponseV1 = {
    version: 1;
    authenticated: true;
    serverTime: number;
    entitlementRevision: number;
    account: {
        provider: 'google-drive' | 'dropbox';
        displayLabel: string;
        accountReference: string;
    };
    planConfigVersion: string;
    subscription: {
        offerId: string | null;
        offerKind: 'founding' | 'standard' | null;
        price: ProjectedPrice | null;
        billingStatus: EntitlementSnapshotV1['billingStatus'];
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
        graceUntil: string | null;
        repairRequired: boolean;
    };
    actions: {
        trialActivationEnabled: boolean;
        checkoutEnabled: boolean;
        checkoutOffer: { offerId: string; offerKind: 'founding' | 'standard'; price: ProjectedPrice } | null;
        checkoutOfferReason: 'founding_available' | 'founding_exhausted'
            | 'founding_eligibility_used' | 'approved_canary' | 'checkout_disabled'
            | 'active_subscription' | 'temporarily_reserved' | 'unavailable';
        portalAvailable: boolean;
    };
    usage: {
        invoiceEmail: {
            available: boolean;
            entitled: boolean;
            effectiveLimit: number | null;
            effectiveRemaining: number | null;
            window: {
                limit: number;
                committed: number;
                reserved: number;
                remaining: number;
                periodStart: string;
                periodEnd: string;
                quotaConfigVersion: string;
                quotaRevision: number;
            } | null;
        };
    };
    entitlement: EntitlementSnapshotV1;
    license: string;
};

export class BillingClientError extends Error {
    constructor(
        readonly code: string,
        readonly status: number | null,
        readonly retryable: boolean,
        readonly details?: Record<string, unknown>,
    ) {
        super(code);
        this.name = 'BillingClientError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
}

function additive(value: Record<string, unknown>, required: string[], maximumAdditional = 16): boolean {
    const keys = Object.keys(value);
    return keys.length <= required.length + maximumAdditional
        && required.every(key => Object.prototype.hasOwnProperty.call(value, key))
        && keys.every(key => /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key));
}

function ascii(value: unknown, maximum = 64): value is string {
    return typeof value === 'string'
        && value.length >= 1
        && value.length <= maximum
        && /^[\x20-\x7E]+$/.test(value);
}

function displayText(value: unknown, maximum = 255): value is string {
    return typeof value === 'string'
        && value.length >= 1
        && value.length <= maximum
        && !/[\u0000-\u001F\u007F]/.test(value);
}

function instantOrNull(value: unknown): value is string | null {
    return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function safeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
    return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function parseOffer(value: unknown, index: number): BillingCatalogOfferV1 {
    if (!isRecord(value) || !exact(value, [
        'offerId', 'interval', 'currency', 'unitAmountMinor', 'taxPresentation',
        'renewal', 'offerKind', 'founding',
    ]) || !ascii(value.offerId)
        || value.interval !== 'year'
        || value.currency !== 'EUR'
        || !safeInteger(value.unitAmountMinor, 1, 100_000_000)
        || !['inclusive', 'exclusive', 'calculated_at_checkout'].includes(String(value.taxPresentation))
        || value.renewal !== 'automatic') throw new BillingClientError('INVALID_CATALOG', null, false);
    if (index === 0) {
        if (value.offerKind !== 'founding'
            || value.unitAmountMinor !== 3900
            || !isRecord(value.founding)
            || !exact(value.founding, ['memberLimit', 'availability', 'priceRetention'])
            || value.founding.memberLimit !== 1000
            || !['available', 'temporarily_reserved', 'exhausted'].includes(String(value.founding.availability))
            || value.founding.priceRetention !== 'while_same_subscription_continues_or_is_recoverable') {
            throw new BillingClientError('INVALID_CATALOG', null, false);
        }
    } else if (index !== 1
        || value.offerKind !== 'standard'
        || value.unitAmountMinor !== 5900
        || value.founding !== null) throw new BillingClientError('INVALID_CATALOG', null, false);
    return value as BillingCatalogOfferV1;
}

export function parseBillingCatalog(value: unknown): BillingCatalogV1 {
    if (!isRecord(value)
        || !exact(value, ['version', 'planConfigVersion', 'purchaseEnabled', 'trial', 'plans', 'legal'])
        || value.version !== 1
        || !ascii(value.planConfigVersion)
        || typeof value.purchaseEnabled !== 'boolean'
        || !isRecord(value.trial)
        || !exact(value.trial, ['durationHours', 'paymentMethodRequired', 'autoCharges'])
        || value.trial.durationHours !== 720
        || value.trial.paymentMethodRequired !== false
        || value.trial.autoCharges !== false
        || !Array.isArray(value.plans)
        || value.plans.length !== 2
        || !isRecord(value.legal)
        || !exact(value.legal, ['termsVersion', 'privacyVersion', 'refundPolicyVersion'])
        || !Object.values(value.legal).every(item => ascii(item))) {
        throw new BillingClientError('INVALID_CATALOG', null, false);
    }
    const [free, pro] = value.plans;
    if (!isRecord(free)
        || !isRecord(pro)
        || !exact(free, ['plan', 'displayName', 'features', 'activeClients', 'invoiceEmailSendsPerUtcMonth', 'offers'])
        || !exact(pro, ['plan', 'displayName', 'features', 'activeClients', 'invoiceEmailSendsPerUtcMonth', 'offers'])
        || free.plan !== 'free'
        || typeof free.displayName !== 'string'
        || free.displayName.length < 1
        || free.displayName.length > 80
        || JSON.stringify(free.features) !== JSON.stringify(['oneActiveClient', 'basicReportsOverview'])
        || free.activeClients !== 1
        || free.invoiceEmailSendsPerUtcMonth !== 0
        || !Array.isArray(free.offers)
        || free.offers.length !== 0
        || pro.plan !== 'pro'
        || typeof pro.displayName !== 'string'
        || pro.displayName.length < 1
        || pro.displayName.length > 80
        || JSON.stringify(pro.features) !== JSON.stringify(['unlimitedActiveClients', 'advancedReports', 'hostedEmail'])
        || pro.activeClients !== null
        || !Array.isArray(pro.offers)
        || (pro.invoiceEmailSendsPerUtcMonth !== null
            && !safeInteger(pro.invoiceEmailSendsPerUtcMonth, 1, 1_000_000))) {
        throw new BillingClientError('INVALID_CATALOG', null, false);
    }
    if (value.purchaseEnabled) {
        if (!safeInteger(pro.invoiceEmailSendsPerUtcMonth, 1, 1_000_000)
            || pro.offers.length !== 2) throw new BillingClientError('INVALID_CATALOG', null, false);
        pro.offers = pro.offers.map(parseOffer);
        if (pro.offers[0].offerId === pro.offers[1].offerId) {
            throw new BillingClientError('INVALID_CATALOG', null, false);
        }
    } else if (pro.invoiceEmailSendsPerUtcMonth !== null || pro.offers.length !== 0) {
        throw new BillingClientError('INVALID_CATALOG', null, false);
    }
    return value as unknown as BillingCatalogV1;
}

function parsePrice(value: unknown): ProjectedPrice | null {
    if (value === null) return null;
    if (!isRecord(value) || !additive(value, [
        'currency', 'unitAmountMinor', 'interval', 'taxPresentation', 'renewal', 'priceRetention',
    ]) || value.currency !== 'EUR'
        || !safeInteger(value.unitAmountMinor, 1, 100_000_000)
        || value.interval !== 'year'
        || !['inclusive', 'exclusive', 'calculated_at_checkout'].includes(String(value.taxPresentation))
        || value.renewal !== 'automatic'
        || value.priceRetention !== 'while_same_subscription_continues_or_is_recoverable') {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    return {
        currency: 'EUR',
        unitAmountMinor: value.unitAmountMinor as number,
        interval: 'year',
        taxPresentation: value.taxPresentation as ProjectedPrice['taxPresentation'],
        renewal: 'automatic',
        priceRetention: 'while_same_subscription_continues_or_is_recoverable',
    };
}

function parseCheckoutOffer(value: unknown): BillingStatusResponseV1['actions']['checkoutOffer'] {
    if (value === null) return null;
    if (!isRecord(value) || !additive(value, ['offerId', 'offerKind', 'price'])
        || !ascii(value.offerId)
        || !['founding', 'standard'].includes(String(value.offerKind))) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    const price = parsePrice(value.price);
    if (!price
        || (value.offerKind === 'founding' && price.unitAmountMinor !== 3900)
        || (value.offerKind === 'standard' && price.unitAmountMinor !== 5900)) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    return { offerId: value.offerId as string, offerKind: value.offerKind as 'founding' | 'standard', price };
}

function parseEmailUsage(
    value: Record<string, unknown>,
    entitled: boolean,
): BillingStatusResponseV1['usage']['invoiceEmail'] {
    if (typeof value.available !== 'boolean'
        || typeof value.entitled !== 'boolean'
        || value.entitled !== entitled) throw new BillingClientError('INVALID_STATUS', null, false);
    if (!value.available) {
        if (value.effectiveLimit !== null || value.effectiveRemaining !== null || value.window !== null) {
            throw new BillingClientError('INVALID_STATUS', null, false);
        }
        return {
            available: false,
            entitled,
            effectiveLimit: null,
            effectiveRemaining: null,
            window: null,
        };
    }
    if (!safeInteger(value.effectiveLimit, entitled ? 1 : 0, 1_000_000)
        || !safeInteger(value.effectiveRemaining, 0, 1_000_000)
        || (!entitled && (value.effectiveLimit !== 0 || value.effectiveRemaining !== 0))) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    if (value.window === null) {
        return {
            available: true,
            entitled,
            effectiveLimit: value.effectiveLimit as number,
            effectiveRemaining: value.effectiveRemaining as number,
            window: null,
        };
    }
    if (!isRecord(value.window) || !additive(value.window, [
        'limit', 'committed', 'reserved', 'remaining', 'periodStart', 'periodEnd',
        'quotaConfigVersion', 'quotaRevision',
    ]) || !safeInteger(value.window.limit, 1, 1_000_000)
        || !safeInteger(value.window.committed, 0, 1_000_000)
        || !safeInteger(value.window.reserved, 0, 1_000_000)
        || !safeInteger(value.window.remaining, 0, 1_000_000)
        || value.window.remaining !== Math.max(
            0,
            Number(value.window.limit) - Number(value.window.committed) - Number(value.window.reserved),
        )
        || !instantOrNull(value.window.periodStart)
        || value.window.periodStart === null
        || !instantOrNull(value.window.periodEnd)
        || value.window.periodEnd === null
        || Date.parse(value.window.periodEnd) <= Date.parse(value.window.periodStart)
        || !ascii(value.window.quotaConfigVersion)
        || !safeInteger(value.window.quotaRevision, 1)
        || (entitled && (value.effectiveLimit !== value.window.limit
            || value.effectiveRemaining !== value.window.remaining))) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    return {
        available: true,
        entitled,
        effectiveLimit: value.effectiveLimit as number,
        effectiveRemaining: value.effectiveRemaining as number,
        window: {
            limit: value.window.limit as number,
            committed: value.window.committed as number,
            reserved: value.window.reserved as number,
            remaining: value.window.remaining as number,
            periodStart: value.window.periodStart as string,
            periodEnd: value.window.periodEnd as string,
            quotaConfigVersion: value.window.quotaConfigVersion as string,
            quotaRevision: value.window.quotaRevision as number,
        },
    };
}

export function parseBillingStatus(value: unknown): BillingStatusResponseV1 {
    if (!isRecord(value) || !additive(value, [
        'version', 'authenticated', 'serverTime', 'entitlementRevision', 'account',
        'planConfigVersion', 'subscription', 'actions', 'usage', 'entitlement', 'license',
    ]) || value.version !== 1
        || value.authenticated !== true
        || !safeInteger(value.serverTime)
        || !safeInteger(value.entitlementRevision, 1)
        || !ascii(value.planConfigVersion)
        || typeof value.license !== 'string'
        || value.license.length < 1
        || value.license.length > PRIVATE_MAX_BYTES
        || !isRecord(value.account)
        || !additive(value.account, ['provider', 'displayLabel', 'accountReference'])
        || !['google-drive', 'dropbox'].includes(String(value.account.provider))
        || !displayText(value.account.displayLabel)
        || !ascii(value.account.accountReference, 32)
        || !isRecord(value.subscription)
        || !additive(value.subscription, [
            'offerId', 'offerKind', 'price', 'billingStatus', 'currentPeriodEnd',
            'cancelAtPeriodEnd', 'graceUntil', 'repairRequired',
        ])
        || (value.subscription.offerId !== null && !ascii(value.subscription.offerId))
        || ![null, 'founding', 'standard'].includes(value.subscription.offerKind as null | string)
        || !instantOrNull(value.subscription.currentPeriodEnd)
        || typeof value.subscription.cancelAtPeriodEnd !== 'boolean'
        || !instantOrNull(value.subscription.graceUntil)
        || typeof value.subscription.repairRequired !== 'boolean'
        || !isRecord(value.actions)
        || !additive(value.actions, [
            'trialActivationEnabled', 'checkoutEnabled', 'checkoutOffer',
            'checkoutOfferReason', 'portalAvailable',
        ])
        || typeof value.actions.trialActivationEnabled !== 'boolean'
        || typeof value.actions.checkoutEnabled !== 'boolean'
        || !['founding_available', 'founding_exhausted', 'founding_eligibility_used',
            'approved_canary', 'checkout_disabled', 'active_subscription',
            'temporarily_reserved', 'unavailable'].includes(String(value.actions.checkoutOfferReason))
        || typeof value.actions.portalAvailable !== 'boolean'
        || !isRecord(value.usage)
        || !additive(value.usage, ['invoiceEmail'])
        || !isRecord(value.usage.invoiceEmail)
        || !additive(value.usage.invoiceEmail, [
            'available', 'entitled', 'effectiveLimit', 'effectiveRemaining', 'window',
        ])) throw new BillingClientError('INVALID_STATUS', null, false);
    const entitlement = parseEntitlementSnapshot(value.entitlement);
    if (entitlement.entitlementRevision !== value.entitlementRevision
        || entitlement.planConfigVersion !== value.planConfigVersion) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    const subscriptionPrice = parsePrice(value.subscription.price);
    if (value.subscription.billingStatus !== entitlement.billingStatus
        || value.subscription.currentPeriodEnd !== entitlement.subscriptionCurrentPeriodEnd
        || value.subscription.cancelAtPeriodEnd !== entitlement.cancelAtPeriodEnd
        || value.subscription.graceUntil !== entitlement.graceUntil
        || (value.subscription.offerId === null) !== (value.subscription.offerKind === null)
        || (value.subscription.offerKind === null) !== (subscriptionPrice === null)
        || (value.subscription.offerKind === 'founding' && subscriptionPrice?.unitAmountMinor !== 3900)
        || (value.subscription.offerKind === 'standard' && subscriptionPrice?.unitAmountMinor !== 5900)) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    const checkoutOffer = parseCheckoutOffer(value.actions.checkoutOffer);
    if (value.actions.checkoutEnabled !== (checkoutOffer !== null)) {
        throw new BillingClientError('INVALID_STATUS', null, false);
    }
    const entitled = ['trial', 'active', 'grace'].includes(entitlement.accessStatus);
    const invoiceEmail = parseEmailUsage(value.usage.invoiceEmail, entitled);
    return {
        version: 1,
        authenticated: true,
        serverTime: value.serverTime as number,
        entitlementRevision: value.entitlementRevision as number,
        account: {
            provider: value.account.provider as BillingStatusResponseV1['account']['provider'],
            displayLabel: value.account.displayLabel as string,
            accountReference: value.account.accountReference as string,
        },
        planConfigVersion: value.planConfigVersion as string,
        subscription: {
            offerId: value.subscription.offerId as string | null,
            offerKind: value.subscription.offerKind as 'founding' | 'standard' | null,
            price: subscriptionPrice,
            billingStatus: entitlement.billingStatus,
            currentPeriodEnd: entitlement.subscriptionCurrentPeriodEnd,
            cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
            graceUntil: entitlement.graceUntil,
            repairRequired: value.subscription.repairRequired as boolean,
        },
        actions: {
            trialActivationEnabled: value.actions.trialActivationEnabled as boolean,
            checkoutEnabled: value.actions.checkoutEnabled as boolean,
            checkoutOffer,
            checkoutOfferReason: value.actions.checkoutOfferReason as BillingStatusResponseV1['actions']['checkoutOfferReason'],
            portalAvailable: value.actions.portalAvailable as boolean,
        },
        usage: { invoiceEmail },
        entitlement,
        license: value.license as string,
    };
}

function parseCheckoutResponse(value: unknown): { version: 1; url: string; attemptId: string } {
    if (!isRecord(value) || !exact(value, ['version', 'url', 'attemptId'])
        || value.version !== 1 || typeof value.url !== 'string'
        || typeof value.attemptId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.attemptId)) {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    let url: URL;
    try {
        url = new URL(value.url);
    } catch {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com'
        || url.username || url.password || url.hash) {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    return { version: 1, url: url.toString(), attemptId: value.attemptId };
}

function parseAbandonResponse(value: unknown): { version: 1; abandoned: true; attemptId: string } {
    if (!isRecord(value) || !exact(value, ['version', 'abandoned', 'attemptId'])
        || value.version !== 1 || value.abandoned !== true
        || typeof value.attemptId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.attemptId)) {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    return value as { version: 1; abandoned: true; attemptId: string };
}

function parsePortalResponse(value: unknown): { version: 1; url: string } {
    if (!isRecord(value) || !exact(value, ['version', 'url'])
        || value.version !== 1 || typeof value.url !== 'string') {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    let url: URL;
    try {
        url = new URL(value.url);
    } catch {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com'
        || url.username || url.password || url.hash) {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    return { version: 1, url: url.toString() };
}

function parseBillingDeletionResponse(value: unknown): { version: 1; state: 'anonymized' } {
    if (!isRecord(value) || !exact(value, ['version', 'state'])
        || value.version !== 1 || value.state !== 'anonymized') {
        throw new BillingClientError('INVALID_RESPONSE', null, false);
    }
    return { version: 1, state: 'anonymized' };
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
    const declared = response.headers.get('Content-Length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)) {
        throw new BillingClientError('RESPONSE_TOO_LARGE', response.status, false);
    }
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximumBytes) {
            await reader.cancel();
            throw new BillingClientError('RESPONSE_TOO_LARGE', response.status, false);
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
        throw new BillingClientError('INVALID_RESPONSE', response.status, false);
    }
}

function parseErrorBody(value: unknown, status: number): BillingClientError {
    if (!isRecord(value) || value.version !== 1 || typeof value.code !== 'string') {
        return new BillingClientError('INVALID_RESPONSE', status, false);
    }
    const recovery = isRecord(value.recovery) ? value.recovery : null;
    return new BillingClientError(
        value.code,
        status,
        recovery?.retryable === true || status === 429 || status >= 500,
        isRecord(value.details) ? value.details : undefined,
    );
}

function idempotencyKey(): string {
    return crypto.randomUUID();
}

export function createBillingClient(options: {
    baseUrl?: string;
    fetchImpl?: FetchLike;
} = {}) {
    const baseUrl = options.baseUrl ?? SYNC_WORKER_CONFIG.workerUrl ?? '';
    const fetchImpl = options.fetchImpl ?? fetch;

    async function request<T>(input: {
        path: string;
        method?: 'GET' | 'POST' | 'DELETE';
        sessionId?: string;
        body?: Record<string, unknown>;
        timeoutMs: number;
        maximumBytes: number;
        parser: (value: unknown) => T;
        operationId?: string;
        signal?: AbortSignal;
    }): Promise<T> {
        if (!baseUrl) throw new BillingClientError('BILLING_UNAVAILABLE', null, true);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
        const abort = () => controller.abort();
        input.signal?.addEventListener('abort', abort, { once: true });
        try {
            const response = await fetchImpl(`${baseUrl}${input.path}`, {
                method: input.method ?? 'GET',
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'error',
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    ...(input.sessionId ? { 'X-Session-Id': input.sessionId } : {}),
                    ...(input.operationId ? { 'X-TaskTime-Operation-Id': input.operationId } : {}),
                    ...(input.body ? { 'Content-Type': 'application/json' } : {}),
                },
                ...(input.body ? { body: JSON.stringify(input.body) } : {}),
            });
            const value = await readBoundedJson(response, input.maximumBytes);
            if (!response.ok) throw parseErrorBody(value, response.status);
            return input.parser(value);
        } catch (error) {
            if (error instanceof BillingClientError) throw error;
            if (controller.signal.aborted) throw new BillingClientError('REQUEST_TIMEOUT', null, true);
            throw new BillingClientError('NETWORK_ERROR', null, true);
        } finally {
            clearTimeout(timeout);
            input.signal?.removeEventListener('abort', abort);
        }
    }

    const privateRequest = <T>(input: Omit<Parameters<typeof request<T>>[0], 'maximumBytes'>) => request({
        ...input,
        maximumBytes: PRIVATE_MAX_BYTES,
    });

    return {
        getCatalog: (signal?: AbortSignal) => request({
            path: '/billing/catalog', timeoutMs: 5_000, maximumBytes: CATALOG_MAX_BYTES,
            parser: parseBillingCatalog, signal,
        }),
        getJwks: (signal?: AbortSignal): Promise<BillingPublicJwk[]> => request({
            path: '/.well-known/tasktime-license-jwks.json', timeoutMs: 5_000,
            maximumBytes: JWKS_MAX_BYTES, parser: parseBillingJwks, signal,
        }),
        getStatus: (sessionId: string, signal?: AbortSignal) => privateRequest({
            path: '/billing/status', sessionId, timeoutMs: 10_000, parser: parseBillingStatus, signal,
        }),
        startTrial: (sessionId: string, key = idempotencyKey()) => privateRequest({
            path: '/billing/trial/start', method: 'POST', sessionId, timeoutMs: 10_000,
            body: { version: 1, idempotencyKey: key }, parser: parseBillingStatus,
        }),
        createCheckout: (sessionId: string, offerId: string, planConfigVersion: string, key = idempotencyKey()) => privateRequest({
            path: '/billing/checkout', method: 'POST', sessionId, timeoutMs: 15_000,
            body: { version: 1, offerId, planConfigVersion, idempotencyKey: key },
            parser: parseCheckoutResponse,
        }),
        abandonCheckout: (sessionId: string, attemptId: string, key = idempotencyKey()) => privateRequest({
            path: '/billing/checkout/abandon', method: 'POST', sessionId, timeoutMs: 15_000,
            body: { version: 1, attemptId, idempotencyKey: key }, parser: parseAbandonResponse,
        }),
        createPortal: (sessionId: string, key = idempotencyKey()) => privateRequest({
            path: '/billing/portal', method: 'POST', sessionId, timeoutMs: 15_000,
            body: { version: 1, idempotencyKey: key }, parser: parsePortalResponse,
        }),
        refresh: (sessionId: string, reason: 'checkout_return' | 'user_retry' | 'support_recovery', key = idempotencyKey()) => privateRequest({
            path: '/billing/refresh', method: 'POST', sessionId, timeoutMs: 15_000,
            body: { version: 1, reason, idempotencyKey: key }, parser: parseBillingStatus,
        }),
        deleteBillingProfile: (sessionId: string, operationId = idempotencyKey()) => privateRequest({
            path: '/billing/account', method: 'DELETE', sessionId, timeoutMs: 15_000,
            operationId, parser: parseBillingDeletionResponse,
        }),
    };
}

export const billingClient = createBillingClient();
