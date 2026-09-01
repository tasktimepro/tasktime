import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import type { AgentCommandContext } from '@/agent/types';
import type { EntitlementResolution, EntitlementSnapshotV1 } from '@/domain/entitlements/entitlementTypes';
import { objectToYMap } from '@/stores/yjs/entityUtils';
import {
    AGENT_COMMAND_REGISTRY,
    agentEntitlementError,
} from './registry';
import { getEmailSendStatusCommand } from './invoices';
import { getReportSummaryCommand } from './reports';

const emailMocks = vi.hoisted(() => ({
    checkEmailAttemptStatus: vi.fn(async () => ({
        version: 1,
        attemptId: 'attempt-fixture',
        state: 'accepted',
    })),
}));

vi.mock('@/utils/emailService', () => emailMocks);

function freeResolution(accessStatus: 'free' | 'suspended' = 'free'): EntitlementResolution {
    const snapshot: EntitlementSnapshotV1 = {
        version: 1,
        entitlementRevision: 1,
        planConfigVersion: 'test-catalog-1',
        subject: 'principal-test',
        plan: accessStatus === 'free' ? 'free' : 'pro',
        accessStatus,
        billingStatus: accessStatus === 'free' ? 'none' : 'past_due',
        source: accessStatus === 'free' ? 'free' : 'subscription',
        trialStatus: 'eligible',
        trialStartedAt: null,
        trialEndsAt: null,
        sourceExpiresAt: null,
        entitlements: [],
        limits: {
            invoiceEmailSendsPerMonth: 0,
            cloudSync: true,
            automaticCloudBackups: true,
            webPush: true,
            activeProjects: null,
            activeClients: 1,
            activeTasks: null,
        },
        subscriptionCurrentPeriodStart: accessStatus === 'suspended'
            ? '2026-08-01T00:00:00.000Z'
            : null,
        subscriptionCurrentPeriodEnd: accessStatus === 'suspended'
            ? '2027-08-01T00:00:00.000Z'
            : null,
        cancelAtPeriodEnd: false,
        graceUntil: null,
        sourceUpdatedAt: '2026-08-30T00:00:00.000Z',
        lastReconciledAt: null,
    };
    return { kind: 'canonical', snapshot };
}

const enforced = {
    advancedReportsEnforcement: true,
    emailEntitlementEnforcement: true,
};

describe('agent entitlement registry', () => {
    it('keeps only the exact basic current-month report request Free', () => {
        expect(agentEntitlementError(
            AGENT_COMMAND_REGISTRY.get_report_summary,
            { scope: 'basic-current-month', section: 'overview' },
            freeResolution(),
            enforced,
        )).toBeNull();
        expect(agentEntitlementError(
            AGENT_COMMAND_REGISTRY.get_report_summary,
            { scope: 'basic-current-month', includeRows: false },
            freeResolution(),
            enforced,
        )).toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
        for (const name of ['export_report_csv', 'export_report_pdf', 'export_accountant_pack'] as const) {
            expect(agentEntitlementError(
                AGENT_COMMAND_REGISTRY[name],
                {},
                freeResolution(),
                enforced,
            )).toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
        }
    });

    it('gates hosted Send but leaves preparation, status, and tax bookkeeping outside Pro', () => {
        for (const name of ['send_invoice_email', 'send_project_quote_email'] as const) {
            expect(agentEntitlementError(
                AGENT_COMMAND_REGISTRY[name],
                {},
                freeResolution(),
                enforced,
            )).toMatchObject({ code: 'ENTITLEMENT_REQUIRED' });
        }
        for (const name of [
            'preview_invoice_email',
            'preview_project_quote_email',
            'get_email_send_status',
            'create_tax_return_period',
            'mark_expenses_tax_claimed',
            'mark_expenses_tax_unclaimed',
        ] as const) {
            expect(agentEntitlementError(
                AGENT_COMMAND_REGISTRY[name],
                {},
                freeResolution(),
                enforced,
            )).toBeNull();
        }
    });

    it('returns the dedicated suspended-account error for new Pro actions', () => {
        expect(agentEntitlementError(
            AGENT_COMMAND_REGISTRY.export_report_csv,
            {},
            freeResolution('suspended'),
            enforced,
        )).toMatchObject({ code: 'BILLING_SUSPENDED' });
    });
});

describe('agent Free report and email-status execution boundaries', () => {
    it('builds BasicReportsOverviewV1 from core and entries-active only', async () => {
        const doc = new Y.Doc();
        const invoices = doc.getMap('invoices');
        const expenses = doc.getMap('expenses');
        const activeTimeEntries = doc.getMap('timeEntries');
        const now = Date.parse('2026-08-30T12:00:00.000Z');
        activeTimeEntries.set('entry-1', objectToYMap({
            id: 'entry-1',
            taskId: 'task-1',
            start: Date.parse('2026-08-15T10:00:00.000Z'),
            end: Date.parse('2026-08-15T11:00:00.000Z'),
        }));
        const getAllTimeEntries = vi.fn(() => {
            throw new Error('protected loaded history must not be inspected');
        });
        const context = {
            store: { invoices, expenses, activeTimeEntries, getAllTimeEntries },
            isReady: true,
            permissions: new Set(['read']),
            now: () => now,
        } as unknown as AgentCommandContext;

        await expect(getReportSummaryCommand(context, {
            scope: 'basic-current-month',
            section: 'overview',
        })).resolves.toMatchObject({
            version: 1,
            scope: 'basic-current-month',
            trackedTimeMs: 3_600_000,
        });
        expect(getAllTimeEntries).not.toHaveBeenCalled();
    });

    it('reads one D1 attempt status without provider or send behavior', async () => {
        const context = {
            store: {},
            isReady: true,
            permissions: new Set(['read', 'email']),
            hostedServiceSessionId: 'session-fixture',
            activeStorageProvider: 'dropbox',
            activeStorageGeneration: 2,
            activeStorageSessionId: 'session-fixture',
        } as unknown as AgentCommandContext;

        await expect(getEmailSendStatusCommand(context, {
            attemptId: 'attempt-fixture',
        })).resolves.toMatchObject({ attemptId: 'attempt-fixture', state: 'accepted' });
        expect(emailMocks.checkEmailAttemptStatus).toHaveBeenCalledWith({
            sessionId: 'session-fixture',
            attemptId: 'attempt-fixture',
            billingLifecycle: {
                provider: 'dropbox',
                generation: 2,
                sessionId: 'session-fixture',
            },
        });
    });
});
