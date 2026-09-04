import { existsSync, readFileSync } from 'node:fs';
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
        expect(makefile).toContain('DEV_COMPOSE = docker compose --project-name $(TASKTIME_DEV_PROJECT)');
        expect(runner).toContain('project_name="${TASKTIME_DEV_PROJECT:-tasktime-dev}"');
        expect(runner).toContain('docker compose --project-name "$project_name"');
        expect(runner).toContain('up --abort-on-container-exit --remove-orphans');
        expect(runner).toContain('down --remove-orphans');
        expect(runner).toContain('trap');

        expect(compose).toContain('VITE_BILLING_SANDBOX_MODE: "true"');
        expect(compose).toContain('VITE_DROPBOX_CLOUD_UI_ENABLED: "true"');
        expect(compose).toContain('VITE_PUSH_NOTIFICATIONS_ENABLED: "true"');
        expect(compose).toContain('billing-worker:');
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
        expect(webhookService).not.toContain(
            './tasktime-infra/cloudflare/.dev.vars.billing-sandbox.local',
        );
        expect(compose).not.toContain('--api-key');
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
