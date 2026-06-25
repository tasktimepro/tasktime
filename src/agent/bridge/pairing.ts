import { randomInt, randomUUID } from 'node:crypto';
import type { AgentPermissionScope } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';

const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
const DEFAULT_PAIRING_CODE_LENGTH = 6;

export interface BridgePairingChallenge {
    id: string;
    code: string;
    endpoint: string;
    scopes: AgentPermissionScope[];
    createdAt: number;
    expiresAt: number;
}

export interface CreateBridgePairingChallengeOptions {
    endpoint: string;
    scopes: AgentPermissionScope[];
    now?: () => number;
    ttlMs?: number;
    codeLength?: number;
    idFactory?: () => string;
    codeFactory?: (length: number) => string;
}

function createPairingCode(length: number): string {
    let code = '';

    for (let index = 0; index < length; index += 1) {
        code += String(randomInt(0, 10));
    }

    return code;
}

export function createBridgePairingChallenge(options: CreateBridgePairingChallengeOptions): BridgePairingChallenge {
    const now = options.now ? options.now() : Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_PAIRING_TTL_MS;
    const codeLength = options.codeLength ?? DEFAULT_PAIRING_CODE_LENGTH;

    return {
        id: options.idFactory ? options.idFactory() : randomUUID(),
        code: options.codeFactory ? options.codeFactory(codeLength) : createPairingCode(codeLength),
        endpoint: options.endpoint,
        scopes: [...options.scopes],
        createdAt: now,
        expiresAt: now + ttlMs,
    };
}

export function isBridgePairingChallengeExpired(challenge: BridgePairingChallenge, now: number = Date.now()): boolean {
    return now >= challenge.expiresAt;
}

export class BridgePairingStore {

    private readonly challenges = new Map<string, BridgePairingChallenge>();

    create(options: CreateBridgePairingChallengeOptions): BridgePairingChallenge {
        const challenge = createBridgePairingChallenge(options);
        this.challenges.set(challenge.id, challenge);
        return challenge;
    }

    get(id: string): BridgePairingChallenge | null {
        return this.challenges.get(id) || null;
    }

    consume(id: string, code: string, now: number = Date.now()): BridgePairingChallenge {
        const challenge = this.challenges.get(id);

        if (!challenge) {
            throw new AgentCommandError('NOT_FOUND', 'Pairing challenge not found.', { id });
        }

        if (isBridgePairingChallengeExpired(challenge, now)) {
            this.challenges.delete(id);
            throw new AgentCommandError('PERMISSION_DENIED', 'Pairing challenge expired.', { id });
        }

        if (challenge.code !== code) {
            throw new AgentCommandError('PERMISSION_DENIED', 'Pairing code is invalid.', { id });
        }

        this.challenges.delete(id);
        return challenge;
    }

    delete(id: string): void {
        this.challenges.delete(id);
    }
}
