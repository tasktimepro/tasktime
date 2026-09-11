import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('billing sandbox development workflow', () => {
    it('uses the complete production-like Docker stack for the default development command', () => {
        const makefile = readFileSync(resolve(process.cwd(), 'Makefile'), 'utf8');
        const compose = readFileSync(
            resolve(process.cwd(), 'docker-compose.billing-sandbox.yml'),
            'utf8',
        );
        const runner = readFileSync(
            resolve(process.cwd(), 'scripts/run-billing-sandbox-stack.sh'),
            'utf8',
        );
        const scheduler = readFileSync(
            resolve(process.cwd(), 'scripts/run-local-worker-scheduler.mjs'),
            'utf8',
        );

        expect(makefile).toContain('dev: dev-billing-sandbox');
        expect(makefile).toContain('dev-core:');
        expect(makefile).toContain(
            '$(MAKE) -C tasktime-infra worker-billing-sandbox-prepare',
        );
        expect(makefile).toContain('TASKTIME_DEV_PROJECT=$(TASKTIME_DEV_PROJECT) sh ./scripts/run-billing-sandbox-stack.sh');
        expect(makefile).toContain('TASKTIME_DEV_PROJECT ?= tasktime\n');
        expect(makefile).toContain('TOOLS_COMPOSE = docker compose --project-name tasktime-tools');
        expect(readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8'))
            .toContain('docker compose --project-name tasktime-tools run --rm app npm ci');
        const siteOverlay = readFileSync(resolve(process.cwd(), 'docker-compose.site.yml'), 'utf8');
        expect(siteOverlay).toContain('include:\n  - ./tasktime-site/docker-compose.yml');
        expect(siteOverlay).toContain('VITE_MARKETING_ORIGIN: http://localhost:${TASKTIME_SITE_PORT:-3102}');
        expect(makefile).toContain('stop:\n\t$(DEV_COMPOSE) stop');
        expect(runner).toContain('exec sh ./scripts/dev-compose.sh up -d --build');
        expect(runner).not.toContain('--abort-on-container-exit');
        expect(runner).not.toContain('down');
        expect(runner).not.toContain('trap');

        expect(compose).toContain('VITE_BILLING_SANDBOX_MODE: "true"');
        expect(compose).toContain('VITE_DROPBOX_CLOUD_UI_ENABLED: "true"');
        expect(compose).toContain('VITE_PUSH_NOTIFICATIONS_ENABLED: "true"');
        expect(compose).toContain('billing-worker:');
        expect(compose).toContain('run-local-billing-worker.sh');
        expect(compose).toContain('.billing-sandbox-runtime');
        expect(compose).toContain('--test-scheduled');
        expect(compose).toContain('billing-scheduler:');
        expect(compose).toContain('run-local-worker-scheduler.mjs');
        expect(scheduler).toContain('http://billing-worker:8787/__scheduled');
        expect(scheduler).toContain('5 * 60 * 1000');
        expect(compose).toContain('billing-webhooks:');
        expect(compose).toContain('http://billing-worker:8787/billing/webhook');
        expect(compose).toContain('.dev.vars.billing-sandbox.local');
        const webhookService = compose.split('\n  billing-webhooks:\n')[1];
        expect(webhookService).toContain('.dev.vars.billing-sandbox-stripe.local');
        expect(webhookService).toContain('run-stripe-billing-listener.sh');
        expect(webhookService).toContain('STRIPE_WEBHOOK_SECRET_FILE');
        expect(webhookService).toContain('healthcheck:');
        const workerService = compose
            .split('\n  billing-worker:\n')[1]
            .split('\n  billing-scheduler:\n')[0];
        expect(workerService).toContain('billing-webhooks:');
        expect(workerService).toContain('condition: service_healthy');
        expect(webhookService).not.toContain(
            './tasktime-infra/cloudflare/.dev.vars.billing-sandbox.local',
        );
        expect(compose).not.toContain('--api-key');
    });

    it.each([
        { infra: false, site: false },
        { infra: true, site: false },
        { infra: false, site: true },
        { infra: true, site: true },
    ])('selects only available local services without coupling core tooling: %j', ({ infra, site }) => {
        const fixture = mkdtempSync(resolve(tmpdir(), 'tasktime-compose-test-'));
        try {
            mkdirSync(resolve(fixture, 'bin'));
            writeFileSync(resolve(fixture, 'bin/docker'), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
            if (infra) {
                mkdirSync(resolve(fixture, 'tasktime-infra'));
                writeFileSync(resolve(fixture, 'tasktime-infra/Makefile'), '');
            }
            if (site) {
                mkdirSync(resolve(fixture, 'tasktime-site'));
                writeFileSync(resolve(fixture, 'tasktime-site/docker-compose.yml'), '');
            }
            const result = spawnSync('sh', [resolve(process.cwd(), 'scripts/dev-compose.sh'), 'up', '-d', '--build'], {
                cwd: fixture,
                env: { ...process.env, PATH: `${fixture}/bin:${process.env.PATH}`, TASKTIME_DEV_PROJECT: '' },
                encoding: 'utf8',
            });
            expect(result.status, result.stderr).toBe(0);
            expect(result.stdout.trim().split('\n')).toEqual([
                'compose', '--project-name', 'tasktime', '-f', 'docker-compose.yml',
                ...(infra ? ['-f', 'docker-compose.billing-sandbox.yml'] : []),
                ...(site ? ['-f', 'docker-compose.site.yml'] : []),
                'up', '-d', '--build',
            ]);
        } finally {
            rmSync(fixture, { recursive: true, force: true });
        }
    });

    it('keeps local sandbox implementation details out of product UI', () => {
        const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
        const emailPreview = readFileSync(
            resolve(process.cwd(), 'src/components/invoice/EmailPreviewModal.jsx'),
            'utf8',
        );
        const emailService = readFileSync(
            resolve(process.cwd(), 'src/utils/emailService.ts'),
            'utf8',
        );

        expect(app).not.toContain('LocalBillingSandboxBanner');
        expect(emailPreview).not.toContain('Hosted Send is disabled in the billing sandbox');
        expect(emailPreview).not.toContain('Billing and entitlement state comes from the local Worker');
        expect(emailPreview).not.toContain('disabled={BILLING_FEATURES.sandbox');
        expect(emailPreview).not.toContain('Hosted Send is temporarily unavailable');
        expect(emailPreview).not.toContain('Delivery status is temporarily unavailable');
        expect(emailService).not.toContain('Hosted Send is temporarily unavailable');
        expect(emailService).not.toContain('Delivery status is temporarily unavailable');
    });

    it('prepares the local push schema before the scheduled recovery sidecar starts', () => {
        const privateInfraMakefile = resolve(
            process.cwd(),
            'tasktime-infra/Makefile',
        );

        if (!existsSync(privateInfraMakefile)) return;

        const makefile = readFileSync(privateInfraMakefile, 'utf8');

        expect(makefile).toContain(
            '_worker-d1-apply-local DB=tasktime-push SQL=cloudflare/sql/004_push_notifications.sql',
        );
    });
});
