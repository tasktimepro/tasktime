import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import type { Client, Invoice, Project, MultiTimerState } from '@/stores/yjs/types';
import { readRequiredEntity, requireString, assertPermission, assertReady } from './shared';

function openRoute(context: AgentCommandContext, path: string): { route: string } {
    if (!context.navigation) {
        throw new AgentCommandError('UNAVAILABLE', 'Navigation adapter is not available.');
    }

    context.navigation.openRoute(path);
    return { route: path };
}

export function openProjectViewCommand(context: AgentCommandContext, input: { projectId: string }): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    const projectId = requireString(input.projectId, 'projectId');
    readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
    return openRoute(context, `/projects/${encodeURIComponent(projectId)}`);
}

export function openDashboardViewCommand(context: AgentCommandContext): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    return openRoute(context, '/');
}

export function openClientViewCommand(context: AgentCommandContext, input: { clientId: string }): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    const clientId = requireString(input.clientId, 'clientId');
    readRequiredEntity<Client>(context.store.clients as any, clientId, 'Client');
    return openRoute(context, `/clients/${encodeURIComponent(clientId)}`);
}

export function openInvoiceViewCommand(context: AgentCommandContext, input: { invoiceId?: string }): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    if (input.invoiceId) {
        readRequiredEntity<Invoice>(context.store.invoices as any, input.invoiceId, 'Invoice');
    }

    return openRoute(context, '/invoices');
}

export function openExpensesViewCommand(context: AgentCommandContext, input: { clientId?: string; projectId?: string } = {}): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    const params = new URLSearchParams();

    if (input.clientId) {
        readRequiredEntity<Client>(context.store.clients as any, input.clientId, 'Client');
        params.set('clientId', input.clientId);
    }

    if (input.projectId) {
        readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
        params.set('projectId', input.projectId);
    }

    const query = params.toString();
    return openRoute(context, query ? `/expenses?${query}` : '/expenses');
}

export function openReportsViewCommand(context: AgentCommandContext): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    return openRoute(context, '/reports');
}

export function openPlannerViewCommand(context: AgentCommandContext, input: { year?: number; week?: number } = {}): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    const hasYear = input.year !== undefined;
    const hasWeek = input.week !== undefined;

    if (hasYear !== hasWeek) {
        throw new AgentCommandError('INVALID_INPUT', 'year and week must be provided together for planner navigation.');
    }

    if (!hasYear && !hasWeek) {
        return openRoute(context, '/planner');
    }

    if (!Number.isInteger(input.year) || input.year! < 1 || input.year! > 9999) {
        throw new AgentCommandError('INVALID_INPUT', 'year must be an integer from 1 to 9999.', { year: input.year });
    }

    if (!Number.isInteger(input.week) || input.week! < 1 || input.week! > 53) {
        throw new AgentCommandError('INVALID_INPUT', 'week must be an integer from 1 to 53.', { week: input.week });
    }

    return openRoute(context, `/planner/${input.year}/${String(input.week).padStart(2, '0')}`);
}

export function openAccountViewCommand(context: AgentCommandContext, input: { section?: string } = {}): { route: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    const section = input.section || 'preferences';
    const allowedSections = new Set(['preferences', 'email-templates', 'sync', 'agent', 'data']);

    if (!allowedSections.has(section)) {
        throw new AgentCommandError('INVALID_INPUT', 'section must be preferences, email-templates, sync, agent, or data.', { section });
    }

    return openRoute(context, `/account?section=${encodeURIComponent(section)}`);
}

export function focusRunningTimerCommand(context: AgentCommandContext, input: { timerKey: string }): { route: string; timerKey: string } {
    assertReady(context);
    assertPermission(context, 'navigation');

    const timerKey = requireString(input.timerKey, 'timerKey');
    readRequiredEntity<MultiTimerState>(context.store.timers as any, timerKey, 'Timer');
    const result = openRoute(context, '/');

    return {
        ...result,
        timerKey,
    };
}
