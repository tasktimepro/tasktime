import type { Client, Invoice, Project, Task, TimeEntry } from '@/stores/yjs/types';
import { DEFAULT_CURRENCY, normalizeCurrencyCode } from './currencyUtils';
import { getActualDurationMs } from './timeEntryDurationUtils';
import { invoiceBelongsToProject } from './invoiceUtils';

export type ProjectStatusMode = 'active' | 'quote';

export interface ProjectEstimateSummary {
    estimatedHours: number;
    actualHours: number;
    estimatedAmount: number;
    budgetAmount: number | null;
    effectiveTargetAmount: number | null;
    currency: string;
    hasTaskEstimates: boolean;
    hasBudgetAmount: boolean;
}

export interface ProjectDeadlineStatus {
    hasDeadline: boolean;
    deadline: string | null;
    isOverdue: boolean;
    isToday: boolean;
    isResolved: boolean;
    daysRemaining: number | null;
    resolvedAt: number | null;
}

export interface ProjectBudgetProgress {
    currency: string;
    budgetAmount: number | null;
    effectiveTargetAmount: number | null;
    estimatedAmount: number;
    invoicedAmount: number;
    remainingAmount: number | null;
    progressRatio: number | null;
}

const HOUR_IN_MS = 60 * 60 * 1000;

const normalizeFiniteNumber = (value: number | null | undefined): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    return value;
};

const resolveProjectClient = (
    project: Pick<Project, 'preferredClientId'>,
    clients: Client[] = []
): Client | null => {
    if (!project.preferredClientId) {
        return null;
    }

    return clients.find((client) => client.id === project.preferredClientId) ?? null;
};

const resolveProjectCurrency = (
    project: Pick<Project, 'preferredClientId'>,
    clients: Client[] = [],
    fallbackCurrency = DEFAULT_CURRENCY
): string => {
    const client = resolveProjectClient(project, clients);

    return normalizeCurrencyCode(client?.defaultCurrency || fallbackCurrency);
};

export const getClientHourlyRate = (
    client: Pick<Client, 'hourlyRate' | 'defaultHourlyRate'> | null | undefined
): number => {
    const clientDefaultRate = normalizeFiniteNumber(client?.defaultHourlyRate);

    if (clientDefaultRate !== null) {
        return clientDefaultRate;
    }

    return normalizeFiniteNumber(client?.hourlyRate) ?? 0;
};

const resolveHourlyRate = (
    project: Pick<Project, 'hourlyRate'>,
    client: Pick<Client, 'hourlyRate' | 'defaultHourlyRate'> | null
): number => {
    const projectRate = normalizeFiniteNumber(project.hourlyRate);

    if (projectRate !== null) {
        return projectRate;
    }

    return getClientHourlyRate(client);
};

const getProjectTasks = (projectId: string, tasks: Task[]): Task[] => tasks.filter((task) => task.projectId === projectId);

export const getProjectStatusMode = (project?: Pick<Project, 'statusMode' | 'isPersonal'> | null): ProjectStatusMode => {
    if (!project || project.isPersonal) {
        return 'active';
    }

    return project.statusMode === 'quote' ? 'quote' : 'active';
};

export const isProjectInQuoteMode = (project?: Pick<Project, 'statusMode' | 'isPersonal'> | null): boolean => {
    return getProjectStatusMode(project) === 'quote';
};

export const getTaskEstimateAmount = (
    task: Pick<Task, 'estimatedHours' | 'estimatedFlatAmount'>,
    project: Pick<Project, 'flatRate' | 'hourlyRate'>,
    client?: Pick<Client, 'hourlyRate' | 'defaultHourlyRate'> | null
): number => {
    if (project.flatRate) {
        return normalizeFiniteNumber(task.estimatedFlatAmount) ?? 0;
    }

    const estimatedHours = normalizeFiniteNumber(task.estimatedHours) ?? 0;

    if (estimatedHours <= 0) {
        return 0;
    }

    return estimatedHours * resolveHourlyRate(project, client ?? null);
};

export const getProjectEstimateSummary = (
    project: Pick<Project, 'id' | 'preferredClientId' | 'flatRate' | 'hourlyRate' | 'budgetAmount'>,
    tasks: Task[],
    timeEntries: TimeEntry[],
    clients: Client[] = [],
    fallbackCurrency = DEFAULT_CURRENCY
): ProjectEstimateSummary => {
    const projectTasks = getProjectTasks(project.id, tasks);
    const projectTaskIds = new Set(projectTasks.map((task) => task.id));
    const client = resolveProjectClient(project, clients);
    const estimatedHours = projectTasks.reduce((total, task) => total + (normalizeFiniteNumber(task.estimatedHours) ?? 0), 0);
    const estimatedAmount = projectTasks.reduce(
        (total, task) => total + getTaskEstimateAmount(task, project, client),
        0
    );
    const actualHours = timeEntries.reduce((total, entry) => {
        if (!projectTaskIds.has(entry.taskId)) {
            return total;
        }

        return total + (getActualDurationMs(entry) / HOUR_IN_MS);
    }, 0);
    const budgetAmount = normalizeFiniteNumber(project.budgetAmount);
    const hasTaskEstimates = projectTasks.some((task) => {
        const estimatedHoursValue = normalizeFiniteNumber(task.estimatedHours) ?? 0;
        const estimatedFlatAmountValue = normalizeFiniteNumber(task.estimatedFlatAmount) ?? 0;

        return estimatedHoursValue > 0 || estimatedFlatAmountValue > 0;
    });
    const hasBudgetAmount = budgetAmount !== null;

    return {
        estimatedHours,
        actualHours,
        estimatedAmount,
        budgetAmount,
        effectiveTargetAmount: budgetAmount,
        currency: resolveProjectCurrency(project, clients, fallbackCurrency),
        hasTaskEstimates,
        hasBudgetAmount,
    };
};

export const getProjectBudgetProgress = (
    project: Pick<Project, 'id' | 'preferredClientId' | 'flatRate' | 'hourlyRate' | 'budgetAmount'>,
    tasks: Task[],
    timeEntries: TimeEntry[],
    invoices: Invoice[],
    clients: Client[] = [],
    fallbackCurrency = DEFAULT_CURRENCY
): ProjectBudgetProgress => {
    const summary = getProjectEstimateSummary(project, tasks, timeEntries, clients, fallbackCurrency);
    const invoicedAmount = invoices.reduce((total, invoice) => {
        if (!invoiceBelongsToProject(invoice, project.id) || typeof invoice.total !== 'number' || !Number.isFinite(invoice.total)) {
            return total;
        }

        return total + invoice.total;
    }, 0);
    const targetAmount = summary.effectiveTargetAmount;
    const remainingAmount = targetAmount === null ? null : Math.max(targetAmount - invoicedAmount, 0);

    return {
        currency: summary.currency,
        budgetAmount: summary.budgetAmount,
        effectiveTargetAmount: targetAmount,
        estimatedAmount: summary.estimatedAmount,
        invoicedAmount,
        remainingAmount,
        progressRatio: targetAmount && targetAmount > 0 ? Math.min(invoicedAmount / targetAmount, 1) : null,
    };
};

export const getProjectDeadlineStatus = (
    project: Pick<Project, 'deadline' | 'deadlineResolvedAt'>,
    referenceDate = new Date()
): ProjectDeadlineStatus => {
    if (!project.deadline) {
        return {
            hasDeadline: false,
            deadline: null,
            isOverdue: false,
            isToday: false,
            isResolved: false,
            daysRemaining: null,
            resolvedAt: null,
        };
    }

    const reference = new Date(referenceDate);
    reference.setHours(0, 0, 0, 0);

    const deadline = new Date(`${project.deadline}T00:00:00`);

    if (Number.isNaN(deadline.getTime())) {
        return {
            hasDeadline: false,
            deadline: null,
            isOverdue: false,
            isToday: false,
            isResolved: false,
            daysRemaining: null,
            resolvedAt: null,
        };
    }

    const resolvedAt = typeof project.deadlineResolvedAt === 'number' && Number.isFinite(project.deadlineResolvedAt)
        ? project.deadlineResolvedAt
        : null;

    if (resolvedAt !== null) {
        return {
            hasDeadline: true,
            deadline: project.deadline,
            isOverdue: false,
            isToday: false,
            isResolved: true,
            daysRemaining: null,
            resolvedAt,
        };
    }

    const diffMs = deadline.getTime() - reference.getTime();
    const daysRemaining = Math.round(diffMs / (24 * HOUR_IN_MS));

    return {
        hasDeadline: true,
        deadline: project.deadline,
        isOverdue: daysRemaining < 0,
        isToday: daysRemaining === 0,
        isResolved: false,
        daysRemaining,
        resolvedAt: null,
    };
};
