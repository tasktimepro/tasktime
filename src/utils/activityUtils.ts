import type {
    Client,
    Expense,
    ExpenseRecurrence,
    Invoice,
    Project,
    Task,
    TimeEntry,
} from '@/stores/yjs/types';

type TimestampedEntity = {
    createdAt?: number | null;
    updatedAt?: number | null;
};

interface BuildProjectRecentUpdateMapOptions {
    projects: Project[];
    tasks: Task[];
    timeEntries: TimeEntry[];
    invoices?: Invoice[];
    expenses?: Expense[];
    recurrences?: ExpenseRecurrence[];
}

interface BuildClientRecentUpdateMapOptions {
    clients: Client[];
    projects: Project[];
    invoices?: Invoice[];
    expenses?: Expense[];
    recurrences?: ExpenseRecurrence[];
    projectRecentUpdateMap: Map<string, number>;
}

const getMutationTimestamp = (entity?: TimestampedEntity | null): number => {

    return Math.max(entity?.updatedAt || 0, entity?.createdAt || 0);
};

const getTimeEntryTimestamp = (entry: TimeEntry): number => {

    return Math.max(getMutationTimestamp(entry), entry.end || 0, entry.start || 0);
};

const getInvoiceTimestamp = (invoice: Invoice): number => {

    return Math.max(getMutationTimestamp(invoice), invoice.paidAt || 0);
};

const touchMap = (map: Map<string, number>, id: string | null | undefined, timestamp: number) => {

    if (!id || !timestamp) {
        return;
    }

    const current = map.get(id) || 0;
    if (timestamp > current) {
        map.set(id, timestamp);
    }
};

export const buildProjectRecentUpdateMap = ({
    projects,
    tasks,
    timeEntries,
    invoices = [],
    expenses = [],
    recurrences = [],
}: BuildProjectRecentUpdateMapOptions): Map<string, number> => {

    const map = new Map<string, number>();
    const taskProjectMap = new Map<string, string>();

    projects.forEach((project) => {
        touchMap(map, project.id, getMutationTimestamp(project));
    });

    tasks.forEach((task) => {
        if (!task.projectId) {
            return;
        }

        taskProjectMap.set(task.id, task.projectId);
        touchMap(map, task.projectId, Math.max(task.lastActive || 0, task.createdAt || 0));
    });

    timeEntries.forEach((entry) => {
        touchMap(map, taskProjectMap.get(entry.taskId), getTimeEntryTimestamp(entry));
    });

    invoices.forEach((invoice) => {
        touchMap(map, invoice.projectId, getInvoiceTimestamp(invoice));
    });

    expenses.forEach((expense) => {
        touchMap(map, expense.projectId, getMutationTimestamp(expense));
    });

    recurrences.forEach((recurrence) => {
        touchMap(map, recurrence.projectId, getMutationTimestamp(recurrence));
    });

    return map;
};

export const buildClientRecentUpdateMap = ({
    clients,
    projects,
    invoices = [],
    expenses = [],
    recurrences = [],
    projectRecentUpdateMap,
}: BuildClientRecentUpdateMapOptions): Map<string, number> => {

    const map = new Map<string, number>();

    clients.forEach((client) => {
        touchMap(map, client.id, getMutationTimestamp(client));
    });

    projects.forEach((project) => {
        touchMap(map, project.preferredClientId, projectRecentUpdateMap.get(project.id) || 0);
    });

    invoices.forEach((invoice) => {
        touchMap(map, invoice.clientId, getInvoiceTimestamp(invoice));
    });

    expenses.forEach((expense) => {
        touchMap(map, expense.clientId, getMutationTimestamp(expense));
    });

    recurrences.forEach((recurrence) => {
        touchMap(map, recurrence.clientId, getMutationTimestamp(recurrence));
    });

    return map;
};