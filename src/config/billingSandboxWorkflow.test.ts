import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('billing sandbox development workflow', () => {
    it('prepares and starts the complete Docker-backed stack from one root command', () => {
        const makefile = readFileSync(resolve(process.cwd(), 'Makefile'), 'utf8');
        const compose = readFileSync(
            resolve(process.cwd(), 'docker-compose.billing-sandbox.yml'),
            'utf8',
        );
        const runner = readFileSync(
            resolve(process.cwd(), 'scripts/run-billing-sandbox-stack.sh'),
            'utf8',
        );

        expect(makefile).toContain(
            '$(MAKE) -C tasktime-infra worker-billing-sandbox-prepare',
        );
        expect(makefile).toContain('sh ./scripts/run-billing-sandbox-stack.sh');
        expect(runner).toContain('docker compose -f docker-compose.yml -f docker-compose.billing-sandbox.yml up --abort-on-container-exit --remove-orphans');
        expect(runner).toContain('docker compose -f docker-compose.yml -f docker-compose.billing-sandbox.yml down --remove-orphans');
        expect(runner).toContain('trap');

        expect(compose).toContain('VITE_BILLING_SANDBOX_MODE: "true"');
        expect(compose).toContain('billing-worker:');
        expect(compose).toContain('billing-webhooks:');
        expect(compose).toContain('http://billing-worker:8787/billing/webhook');
        expect(compose).toContain('.dev.vars.billing-sandbox.local');
        const webhookService = compose.split('\n  billing-webhooks:\n')[1];
        expect(webhookService).toContain('.dev.vars.billing-sandbox-stripe.local');
        expect(webhookService).toContain('run-stripe-billing-listener.sh');
        expect(webhookService).not.toContain(
            './tasktime-infra/cloudflare/.dev.vars.billing-sandbox.local',
        );
        expect(compose).not.toContain('--api-key');
    });
});
