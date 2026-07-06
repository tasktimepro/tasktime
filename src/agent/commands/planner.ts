import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { collectValidatedEntities, readValidatedEntity, validateCollectionEntity } from '@/stores/yjs/validation';
import { objectToYMap, updateEntityFields } from '@/stores/yjs/entityUtils';
import {
    cloneProjectNotesDocument,
    createEmptyProjectNotesDocument,
    createProjectNotesPayload,
    extractProjectNotesPlainText,
} from '@/utils/projectNotesUtils';
import type { Client, DailyGoal, PlannerAttachment, Project, ProjectNotes, Task, TipTapJsonNode } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    assertPermission,
    assertReady,
    getId,
    getNow,
    readRequiredEntity,
    requireString,
    withIdempotency,
} from './shared';

type PlannerEntityType = PlannerAttachment['type'];
type PlannerAttachMode = PlannerAttachment['mode'] | 'week' | 'every-week';
type PlannerDuplicateMode = 'reject' | 'skip' | 'overwrite';

const STORAGE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface ListPlannerAttachmentsCommandInput {
    type?: PlannerEntityType;
    referenceId?: string;
    mode?: PlannerAttachment['mode'];
    date?: string;
    weekday?: number;
}

export interface AttachPlannerItemCommandInput {
    type: PlannerEntityType;
    referenceId: string;
    mode: PlannerAttachMode;
    date?: string | null;
    weekday?: number | null;
    weekStartDate?: string | null;
    includeWeekends?: boolean;
    estimatedHours?: number | null;
    duplicateMode?: PlannerDuplicateMode;
    idempotencyKey?: string;
}

export interface AttachPlannerItemResult {
    created: PlannerAttachment[];
    updated: PlannerAttachment[];
    skipped: PlannerAttachment[];
}

export interface UpdatePlannerAttachmentCommandInput {
    plannerAttachmentId: string;
    estimatedHours?: number | null;
}

export interface RemovePlannerAttachmentCommandInput {
    plannerAttachmentId: string;
}

export interface RemovePlannerAttachmentResult {
    plannerAttachmentId: string;
    referenceId: string;
    type: PlannerEntityType;
    removed: true;
}

export interface ListDailyGoalsCommandInput {
    weekday?: number;
}

export interface SetDailyGoalCommandInput {
    weekday: number;
    targetHours?: number | null;
    targetEarnings?: number | null;
}

export interface SetDailyGoalResult {
    weekday: number;
    goal: DailyGoal | null;
    removed: boolean;
}

export interface RemoveDailyGoalCommandInput {
    weekday: number;
}

export interface RemoveDailyGoalResult {
    weekday: number;
    removed: boolean;
}

export interface GetProjectNotesCommandInput {
    projectId: string;
}

export interface ProjectNotesResult {
    projectId: string;
    notes: ProjectNotes | null;
    plainText: string;
}

export interface UpdateProjectNotesCommandInput {
    projectId: string;
    plainText?: string;
    content?: TipTapJsonNode | null;
    clear?: boolean;
}

function assertStorageDate(value: unknown, field: string): string {
    if (typeof value === 'string' && STORAGE_DATE_REGEX.test(value)) {
        return value;
    }

    throw new AgentCommandError('INVALID_INPUT', `${field} must be a YYYY-MM-DD date.`, { field });
}

function parseStorageDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function toStorageDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function assertWeekday(value: unknown, field = 'weekday'): number {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) {
        return value;
    }

    throw new AgentCommandError('INVALID_INPUT', `${field} must be an integer from 0 to 6.`, { field });
}

function normalizeOptionalHours(value: unknown, field: string, max: number): number | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AgentCommandError('INVALID_INPUT', `${field} must be a finite number or null.`, { field });
    }

    return Math.min(max, Math.max(0.5, value));
}

function normalizeOptionalEarnings(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AgentCommandError('INVALID_INPUT', 'targetEarnings must be a finite number or null.', { field: 'targetEarnings' });
    }

    return Math.max(0, value);
}

function assertPlannerEntityExists(context: AgentCommandContext, type: PlannerEntityType, referenceId: string, allowInactive = false): void {
    if (type === 'client') {
        const client = readRequiredEntity<Client>(context.store.clients as any, referenceId, 'Client');

        if (!allowInactive && client.archived) {
            throw new AgentCommandError('CONFLICT', 'Archived clients cannot be newly attached to the planner.', { referenceId });
        }

        return;
    }

    if (type === 'project') {
        const project = readRequiredEntity<Project>(context.store.projects as any, referenceId, 'Project');

        if (!allowInactive && project.archived) {
            throw new AgentCommandError('CONFLICT', 'Archived projects cannot be newly attached to the planner.', { referenceId });
        }

        return;
    }

    const task = readRequiredEntity<Task>(context.store.tasks as any, referenceId, 'Task');

    if (!allowInactive && (task.archived || task.completed)) {
        throw new AgentCommandError('CONFLICT', 'Archived or completed tasks cannot be newly attached to the planner.', { referenceId });
    }
}

function findMatchingAttachment(
    attachments: PlannerAttachment[],
    type: PlannerEntityType,
    referenceId: string,
    mode: PlannerAttachment['mode'],
    date: string | null,
    weekday: number | null
): PlannerAttachment | null {
    return attachments.find((attachment) => {
        if (attachment.type !== type || attachment.referenceId !== referenceId || attachment.mode !== mode) {
            return false;
        }

        if (mode === 'date') {
            return attachment.date === date;
        }

        if (mode === 'weekday') {
            return attachment.weekday === weekday;
        }

        return true;
    }) || null;
}

function buildAttachmentTargets(input: AttachPlannerItemCommandInput): Array<{
    mode: PlannerAttachment['mode'];
    date: string | null;
    weekday: number | null;
    createdAt?: number;
    estimatedHours: number | null;
}> {
    const mode = input.mode;

    if (mode === 'static') {
        return [{
            mode: 'static',
            date: null,
            weekday: null,
            estimatedHours: normalizeOptionalHours(input.estimatedHours, 'estimatedHours', 24),
        }];
    }

    if (mode === 'date') {
        return [{
            mode: 'date',
            date: assertStorageDate(input.date, 'date'),
            weekday: null,
            estimatedHours: normalizeOptionalHours(input.estimatedHours, 'estimatedHours', 24),
        }];
    }

    if (mode === 'weekday') {
        return [{
            mode: 'weekday',
            date: null,
            weekday: assertWeekday(input.weekday),
            estimatedHours: normalizeOptionalHours(input.estimatedHours, 'estimatedHours', 24),
        }];
    }

    const weekStartDate = assertStorageDate(input.weekStartDate, 'weekStartDate');
    const weekStart = parseStorageDate(weekStartDate);
    const includeWeekends = input.includeWeekends !== false;
    const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
        .filter((date) => includeWeekends || (date.getDay() !== 0 && date.getDay() !== 6));
    const totalHours = normalizeOptionalHours(input.estimatedHours, 'estimatedHours', 168);
    const baseHours = totalHours !== null && days.length > 0
        ? Number((totalHours / days.length).toFixed(2))
        : null;
    const lastHours = totalHours !== null && days.length > 0
        ? Number((totalHours - (baseHours! * (days.length - 1))).toFixed(2))
        : null;

    return days.map((date, index) => ({
        mode: mode === 'every-week' ? 'weekday' : 'date',
        date: mode === 'every-week' ? null : toStorageDate(date),
        weekday: mode === 'every-week' ? date.getDay() : null,
        createdAt: date.getTime(),
        estimatedHours: totalHours === null ? null : (index === days.length - 1 ? lastHours : baseHours),
    }));
}

function createPlainTextProjectNotesDocument(plainText: string): TipTapJsonNode {
    const lines = plainText.split(/\r?\n/u);
    const content = lines.length > 0
        ? lines.map((line) => ({
            type: 'paragraph',
            ...(line ? { content: [{ type: 'text', text: line }] } : {}),
        }))
        : [{ type: 'paragraph' }];

    return {
        type: 'doc',
        content,
    };
}

export function listPlannerAttachmentsCommand(context: AgentCommandContext, input: ListPlannerAttachmentsCommandInput = {}): PlannerAttachment[] {
    assertReady(context);
    assertPermission(context, 'read');

    if (input.date) {
        assertStorageDate(input.date, 'date');
    }

    if (input.weekday !== undefined) {
        assertWeekday(input.weekday);
    }

    return collectValidatedEntities<PlannerAttachment>('plannerAttachments', context.store.plannerAttachments as any, 'agent list planner attachments')
        .filter((attachment) => !input.type || attachment.type === input.type)
        .filter((attachment) => !input.referenceId || attachment.referenceId === input.referenceId)
        .filter((attachment) => !input.mode || attachment.mode === input.mode)
        .filter((attachment) => !input.date || attachment.date === input.date)
        .filter((attachment) => input.weekday === undefined || attachment.weekday === input.weekday)
        .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function attachPlannerItemCommand(context: AgentCommandContext, input: AttachPlannerItemCommandInput): AttachPlannerItemResult {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const type = input.type;
        const referenceId = requireString(input.referenceId, 'referenceId');
        const duplicateMode = input.duplicateMode || 'reject';

        if (!['client', 'project', 'task'].includes(type)) {
            throw new AgentCommandError('INVALID_INPUT', 'type must be client, project, or task.', { type });
        }

        if (!['static', 'date', 'weekday', 'week', 'every-week'].includes(input.mode)) {
            throw new AgentCommandError('INVALID_INPUT', 'mode must be static, date, weekday, week, or every-week.', { mode: input.mode });
        }

        if (!['reject', 'skip', 'overwrite'].includes(duplicateMode)) {
            throw new AgentCommandError('INVALID_INPUT', 'duplicateMode must be reject, skip, or overwrite.', { duplicateMode });
        }

        assertPlannerEntityExists(context, type, referenceId);

        const targets = buildAttachmentTargets(input);
        const existingAttachments = collectValidatedEntities<PlannerAttachment>('plannerAttachments', context.store.plannerAttachments as any, 'agent attach planner item');
        const duplicateAttachments = targets
            .map((target) => findMatchingAttachment(existingAttachments, type, referenceId, target.mode, target.date, target.weekday))
            .filter((attachment): attachment is PlannerAttachment => Boolean(attachment));

        if (duplicateMode === 'reject' && duplicateAttachments.length > 0) {
            throw new AgentCommandError('CONFLICT', 'Planner item is already attached for one or more requested dates/weekdays.', {
                plannerAttachmentIds: duplicateAttachments.map((attachment) => attachment.id),
            });
        }

        const now = getNow(context);
        const maxSortOrder = existingAttachments.reduce((max, attachment) => Math.max(max, attachment.sortOrder), 0);
        const created: PlannerAttachment[] = [];
        const updated: PlannerAttachment[] = [];
        const skipped: PlannerAttachment[] = [];

        context.store.coreDoc.transact(() => {
            targets.forEach((target) => {
                const existing = findMatchingAttachment(existingAttachments, type, referenceId, target.mode, target.date, target.weekday);

                if (existing) {
                    if (duplicateMode === 'overwrite') {
                        const updates = {
                            estimatedHours: target.estimatedHours,
                        };
                        const merged = validateCollectionEntity<PlannerAttachment>('plannerAttachments', {
                            ...existing,
                            ...updates,
                        }, `agent update duplicate planner attachment ${existing.id}`);
                        updateEntityFields(context.store.plannerAttachments as any, existing.id, updates);
                        updated.push(merged);
                    } else {
                        skipped.push(existing);
                    }

                    return;
                }

                const attachment = validateCollectionEntity<PlannerAttachment>('plannerAttachments', {
                    id: getId(context),
                    type,
                    referenceId,
                    mode: target.mode,
                    date: target.date,
                    weekday: target.weekday,
                    sortOrder: maxSortOrder + created.length + 1,
                    createdAt: target.createdAt ?? now,
                    estimatedHours: target.estimatedHours,
                }, `agent create planner attachment ${referenceId}`);

                (context.store.plannerAttachments as any).set(attachment.id, objectToYMap(attachment as unknown as Record<string, unknown>));
                created.push(attachment);
            });
        });

        if (created.length > 0 || updated.length > 0) {
            markMeaningfulActivity('planner_attachment_update');
        }

        return { created, updated, skipped };
    });
}

export function updatePlannerAttachmentCommand(context: AgentCommandContext, input: UpdatePlannerAttachmentCommandInput): PlannerAttachment {
    assertReady(context);
    assertPermission(context, 'write');

    const plannerAttachmentId = requireString(input.plannerAttachmentId, 'plannerAttachmentId');
    const existing = readValidatedEntity<PlannerAttachment>('plannerAttachments', context.store.plannerAttachments.get(plannerAttachmentId), `agent update planner attachment ${plannerAttachmentId}`);

    if (!existing) {
        throw new AgentCommandError('NOT_FOUND', 'Planner attachment not found.', { plannerAttachmentId });
    }

    assertPlannerEntityExists(context, existing.type, existing.referenceId, true);

    const updates = {
        estimatedHours: normalizeOptionalHours(input.estimatedHours, 'estimatedHours', 24),
    };
    const merged = validateCollectionEntity<PlannerAttachment>('plannerAttachments', {
        ...existing,
        ...updates,
    }, `agent update planner attachment ${plannerAttachmentId}`);

    context.store.coreDoc.transact(() => {
        updateEntityFields(context.store.plannerAttachments as any, plannerAttachmentId, updates);
    });

    markMeaningfulActivity('planner_attachment_update');
    return merged;
}

export function removePlannerAttachmentCommand(context: AgentCommandContext, input: RemovePlannerAttachmentCommandInput): RemovePlannerAttachmentResult {
    assertReady(context);
    assertPermission(context, 'write');

    const plannerAttachmentId = requireString(input.plannerAttachmentId, 'plannerAttachmentId');
    const existing = readValidatedEntity<PlannerAttachment>('plannerAttachments', context.store.plannerAttachments.get(plannerAttachmentId), `agent remove planner attachment ${plannerAttachmentId}`);

    if (!existing) {
        throw new AgentCommandError('NOT_FOUND', 'Planner attachment not found.', { plannerAttachmentId });
    }

    context.store.coreDoc.transact(() => {
        context.store.plannerAttachments.delete(plannerAttachmentId);
    });

    markMeaningfulActivity('planner_attachment_remove');

    return {
        plannerAttachmentId,
        referenceId: existing.referenceId,
        type: existing.type,
        removed: true,
    };
}

export function listDailyGoalsCommand(context: AgentCommandContext, input: ListDailyGoalsCommandInput = {}): DailyGoal[] {
    assertReady(context);
    assertPermission(context, 'read');

    if (input.weekday !== undefined) {
        assertWeekday(input.weekday);
    }

    return collectValidatedEntities<DailyGoal>('dailyGoals', context.store.dailyGoals as any, 'agent list daily goals')
        .filter((goal) => input.weekday === undefined || goal.weekday === input.weekday)
        .sort((left, right) => left.weekday - right.weekday);
}

export function setDailyGoalCommand(context: AgentCommandContext, input: SetDailyGoalCommandInput): SetDailyGoalResult {
    assertReady(context);
    assertPermission(context, 'write');

    const weekday = assertWeekday(input.weekday);
    const id = String(weekday);
    const existing = readValidatedEntity<DailyGoal>('dailyGoals', context.store.dailyGoals.get(id), `agent set daily goal ${weekday}`);
    const targetHours = normalizeOptionalHours(input.targetHours, 'targetHours', 24);
    const targetEarnings = normalizeOptionalEarnings(input.targetEarnings);
    const now = getNow(context);

    if (targetHours === null && targetEarnings === null) {
        context.store.coreDoc.transact(() => {
            context.store.dailyGoals.delete(id);
        });

        markMeaningfulActivity('daily_goal_remove');
        return {
            weekday,
            goal: null,
            removed: Boolean(existing),
        };
    }

    const goal = validateCollectionEntity<DailyGoal>('dailyGoals', {
        id,
        weekday,
        targetHours,
        targetEarnings,
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing ? now : null,
    }, `agent set daily goal ${weekday}`);

    context.store.coreDoc.transact(() => {
        (context.store.dailyGoals as any).set(id, objectToYMap(goal as unknown as Record<string, unknown>));
    });

    markMeaningfulActivity('daily_goal_set');

    return {
        weekday,
        goal,
        removed: false,
    };
}

export function removeDailyGoalCommand(context: AgentCommandContext, input: RemoveDailyGoalCommandInput): RemoveDailyGoalResult {
    assertReady(context);
    assertPermission(context, 'write');

    const weekday = assertWeekday(input.weekday);
    const id = String(weekday);
    const removed = context.store.dailyGoals.has(id);

    context.store.coreDoc.transact(() => {
        context.store.dailyGoals.delete(id);
    });

    if (removed) {
        markMeaningfulActivity('daily_goal_remove');
    }

    return { weekday, removed };
}

export function getProjectNotesCommand(context: AgentCommandContext, input: GetProjectNotesCommandInput): ProjectNotesResult {
    assertReady(context);
    assertPermission(context, 'read');

    const projectId = requireString(input.projectId, 'projectId');
    const project = readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
    const notes = project.notes ?? null;

    return {
        projectId,
        notes,
        plainText: notes ? extractProjectNotesPlainText(notes.content) : '',
    };
}

export function updateProjectNotesCommand(context: AgentCommandContext, input: UpdateProjectNotesCommandInput): ProjectNotesResult {
    assertReady(context);
    assertPermission(context, 'write');

    const projectId = requireString(input.projectId, 'projectId');
    const project = readRequiredEntity<Project>(context.store.projects as any, projectId, 'Project');
    const providedInputs = [
        input.clear === true,
        typeof input.plainText === 'string',
        input.content !== undefined,
    ].filter(Boolean).length;

    if (providedInputs !== 1) {
        throw new AgentCommandError('INVALID_INPUT', 'Provide exactly one of clear, plainText, or content.', { projectId });
    }

    const content = input.clear === true
        ? createEmptyProjectNotesDocument()
        : (typeof input.plainText === 'string'
            ? createPlainTextProjectNotesDocument(input.plainText)
            : cloneProjectNotesDocument(input.content));
    const notes = createProjectNotesPayload(content, getNow(context));
    const merged = validateCollectionEntity<Project>('projects', {
        ...project,
        notes,
        updatedAt: getNow(context),
    }, `agent update project notes ${projectId}`);

    context.store.coreDoc.transact(() => {
        updateEntityFields(context.store.projects as any, projectId, {
            notes: merged.notes,
            updatedAt: merged.updatedAt,
        });
    });

    markMeaningfulActivity('project_notes_update');

    return {
        projectId,
        notes: merged.notes ?? null,
        plainText: merged.notes ? extractProjectNotesPlainText(merged.notes.content) : '',
    };
}
