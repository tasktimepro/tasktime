import { AgentCommandError } from '@/agent/types';

export const DEFAULT_ALLOWED_TASKTIME_ORIGINS = [
    'https://tasktime.pro',
    'https://www.tasktime.pro',
    'http://localhost:3101',
    'http://127.0.0.1:3101',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

const LOOPBACK_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
]);

export function normalizeHost(host: string): string {
    return host.trim().toLowerCase();
}

export function isLoopbackHost(host: string): boolean {
    const normalized = normalizeHost(host);

    if (LOOPBACK_HOSTS.has(normalized)) {
        return true;
    }

    const parts = normalized.split('.');

    if (parts.length !== 4 || parts[0] !== '127') {
        return false;
    }

    return parts.every((part) => {
        if (!/^\d+$/.test(part)) {
            return false;
        }

        const value = Number(part);
        return value >= 0 && value <= 255;
    });
}

export function assertLoopbackHost(host: string): void {
    if (!isLoopbackHost(host)) {
        throw new AgentCommandError('INVALID_INPUT', 'Agent bridge server must bind to a loopback host.', { host });
    }
}

export function normalizeOrigin(origin: string): string | null {
    try {
        const parsed = new URL(origin);
        return parsed.origin;
    } catch {
        return null;
    }
}

export function isAllowedTaskTimeOrigin(origin: string | undefined | null, allowedOrigins: Iterable<string> = DEFAULT_ALLOWED_TASKTIME_ORIGINS): boolean {
    if (!origin) {
        return false;
    }

    const normalized = normalizeOrigin(origin);

    if (!normalized) {
        return false;
    }

    return new Set(Array.from(allowedOrigins).map((item) => normalizeOrigin(item)).filter(Boolean)).has(normalized);
}

export function assertAllowedTaskTimeOrigin(origin: string | undefined | null, allowedOrigins?: Iterable<string>): void {
    if (!isAllowedTaskTimeOrigin(origin, allowedOrigins)) {
        throw new AgentCommandError('PERMISSION_DENIED', 'Origin is not allowed to connect to the TaskTime Pro agent bridge.', {
            origin: origin || null,
        });
    }
}
