import type { Project } from '@/stores/yjs/types';
import type { ClientDeleteImpactPlan } from './clientDeletion';
import type { ProjectDeleteImpactPlan } from './projectDeletion';
import type { TaskDeleteImpactPlan } from './taskDeletion';

export interface TaskDeleteApplicationPlan {
    taskIdsToDelete: string[];
    timeEntryIdsToDelete: string[];
    timerKeysToClear: string[];
    plannerAttachmentIdsToDelete: string[];
}

export interface ProjectDeleteApplicationPlan extends TaskDeleteApplicationPlan {
    projectIdToDelete: string;
    invoiceIdsToDelete: string[];
    expenseIdsToDelete: string[];
    recurrenceIdsToDelete: string[];
}

export interface ClientDeleteApplicationPlan extends TaskDeleteApplicationPlan {
    clientIdToDelete: string;
    projectIdsToDelete: string[];
    projectConversionUpdates: Array<{
        id: string;
        updates: Partial<Project>;
    }>;
    invoiceIdsToDelete: string[];
    expenseIdsToDelete: string[];
    recurrenceIdsToDelete: string[];
}

export function buildTaskDeleteApplicationPlan(plan: TaskDeleteImpactPlan): TaskDeleteApplicationPlan {
    return {
        taskIdsToDelete: [...plan.taskIdsToDelete],
        timeEntryIdsToDelete: [...plan.timeEntryIdsToDelete],
        timerKeysToClear: [...plan.timerKeysToClear],
        plannerAttachmentIdsToDelete: [...plan.plannerAttachmentIdsToDelete],
    };
}

export function buildProjectDeleteApplicationPlan(plan: ProjectDeleteImpactPlan): ProjectDeleteApplicationPlan {
    return {
        projectIdToDelete: plan.projectId,
        taskIdsToDelete: [...plan.taskIdsToDelete],
        timeEntryIdsToDelete: [...plan.timeEntryIdsToDelete],
        timerKeysToClear: [...plan.timerKeysToClear],
        invoiceIdsToDelete: plan.includeInvoiceDeletion ? [...plan.invoiceIds] : [],
        expenseIdsToDelete: [...plan.expenseIdsToDelete],
        recurrenceIdsToDelete: [...plan.recurrenceIdsToDelete],
        plannerAttachmentIdsToDelete: [...plan.plannerAttachmentIdsToDelete],
    };
}

export function buildClientDeleteApplicationPlan(plan: ClientDeleteImpactPlan): ClientDeleteApplicationPlan {
    return {
        clientIdToDelete: plan.clientId,
        projectIdsToDelete: [...plan.projectIdsToDelete],
        projectConversionUpdates: plan.projectIdsToConvertToPersonal.map((projectId) => ({
            id: projectId,
            updates: buildConvertedPersonalProjectUpdates(),
        })),
        taskIdsToDelete: [
            ...plan.activeTaskIdsToDelete,
            ...plan.archivedTaskIdsToDelete,
        ].sort(),
        timeEntryIdsToDelete: [...plan.timeEntryIdsToDelete],
        timerKeysToClear: [...plan.timerKeysToClear],
        invoiceIdsToDelete: plan.includeInvoiceDeletion ? [...plan.invoiceIds] : [],
        expenseIdsToDelete: [...plan.expenseIdsToDelete],
        recurrenceIdsToDelete: [...plan.recurrenceIdsToDelete],
        plannerAttachmentIdsToDelete: [...plan.plannerAttachmentIdsToDelete],
    };
}

export function buildConvertedPersonalProjectUpdates(): Partial<Project> {
    return {
        preferredClientId: null,
        hourlyRate: null,
        flatRate: false,
        isPersonal: true,
    };
}
