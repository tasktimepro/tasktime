import { describe, expect, it } from 'vitest';
import { getBillableTaskIds, isBillableTask } from './taskBillability';

const task = { id: 'task', title: 'Work', projectId: 'project', billable: true };
const project = { id: 'project', title: 'Project', preferredClientId: 'client' };
const client = { id: 'client', title: 'Client' };

describe('current task billability', () => {
    it('requires the flag and matching non-personal project/client relationships', () => {
        expect(isBillableTask(task, project, client)).toBe(true);
        expect(isBillableTask({ ...task, billable: false }, project, client)).toBe(false);
        expect(isBillableTask({ ...task, billable: undefined }, project, client)).toBe(false);
        expect(isBillableTask(null, project, client)).toBe(false);
        expect(isBillableTask(task, { ...project, id: 'other' }, client)).toBe(false);
        expect(isBillableTask(task, project, { ...client, id: 'other' })).toBe(false);
        expect(isBillableTask(task, { ...project, isPersonal: true }, client)).toBe(false);
    });

    it('preserves archived client work and reclassifies moves without changing saved preferences', () => {
        const tasks = [{ ...task, archived: true }];
        const projects = [{ ...project, archived: true }];
        const clients = [{ ...client, archived: true }];
        const before = JSON.stringify({ tasks, projects, clients });
        expect(getBillableTaskIds(tasks, projects, clients)).toEqual(new Set(['task']));
        expect(getBillableTaskIds([{ ...task, projectId: null }], projects, clients).size).toBe(0);
        expect(getBillableTaskIds(tasks, [], clients).size).toBe(0);
        expect(getBillableTaskIds(tasks, projects, []).size).toBe(0);
        expect(getBillableTaskIds(tasks, [{ ...project, preferredClientId: null }], clients).size).toBe(0);
        expect(JSON.stringify({ tasks, projects, clients })).toBe(before);
    });
});
