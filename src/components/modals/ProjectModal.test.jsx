import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectModal from './ProjectModal';

const projectHookMocks = vi.hoisted(() => ({
    createProject: vi.fn(),
    updateProject: vi.fn(),
}));

const clientState = vi.hoisted(() => ({
    clients: [],
}));

vi.mock('../../hooks/useProjects.ts', () => ({
    useProjects: () => projectHookMocks,
}));

vi.mock('../../hooks/useClients.ts', () => ({
    useClients: () => ({
        clients: clientState.clients,
    }),
}));

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
    }),
}));

vi.mock('../../utils/idUtils.ts', () => ({
    generateSlugId: () => 'project-id',
}));

describe('ProjectModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clientState.clients = [];
        if (!Element.prototype.hasPointerCapture) {
            Element.prototype.hasPointerCapture = vi.fn(() => false);
        }
        if (!Element.prototype.setPointerCapture) {
            Element.prototype.setPointerCapture = vi.fn();
        }
        if (!Element.prototype.releasePointerCapture) {
            Element.prototype.releasePointerCapture = vi.fn();
        }
        if (!HTMLElement.prototype.scrollIntoView) {
            HTMLElement.prototype.scrollIntoView = vi.fn();
        }
    });

    it('checks personal project by default for a blank new project', () => {
        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByRole('checkbox', { name: 'Personal project (Not billable)' }).getAttribute('data-state')).toBe('checked');
    });

    it('uses the wider 2xl modal width', () => {
        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByRole('dialog').className.includes('sm:max-w-2xl')).toBe(true);
    });

    it('updates the personal project helper copy when the checkbox is toggled', async () => {
        const user = userEvent.setup();

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        const checkbox = screen.getByRole('checkbox', { name: 'Personal project (Not billable)' });

        expect(screen.getByText('Uncheck this for projects with clients or invoices.')).toBeInTheDocument();

        await user.click(checkbox);

        expect(screen.getByText('Check this for projects without clients or invoices.')).toBeInTheDocument();
    });

    it('keeps personal project unchecked when a client is preselected', () => {
        clientState.clients = [
            {
                id: 'client-1',
                title: 'Acme',
                archived: false,
                hourlyRate: 100,
                flatRate: false,
            },
        ];

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
                modalOptions={{ preselectedClientId: 'client-1' }}
            />
        );

        expect(screen.queryByRole('checkbox', { name: 'Personal project (Not billable)' })).not.toBeInTheDocument();
        expect(screen.getByText('Client')).toBeInTheDocument();
    });

    it('persists the billing increment setting for billable projects', async () => {
        const user = userEvent.setup();

        clientState.clients = [
            {
                id: 'client-1',
                title: 'Acme',
                archived: false,
                hourlyRate: 100,
                flatRate: false,
            },
        ];

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
                modalOptions={{ preselectedClientId: 'client-1' }}
            />
        );

        await user.type(screen.getByLabelText('Project Title *'), 'Rounded Project');
        await user.click(screen.getByRole('combobox', { name: 'Minimum billed time increment' }));
        await user.click(await screen.findByRole('option', { name: 'Round up to 15 minutes' }));
        await user.click(screen.getByRole('button', { name: 'Create Project' }));

        expect(projectHookMocks.createProject).toHaveBeenCalledWith(expect.objectContaining({
            billableTimeIncrementMinutes: 15,
        }));
    });

    it('hides quote and planning fields for personal projects', () => {
        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
            />
        );

        expect(screen.queryByLabelText('Project Status')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Deadline')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Target budget')).not.toBeInTheDocument();
    });

    it('shows and persists quote mode, deadline, and target budget for client projects', async () => {
        const user = userEvent.setup();

        clientState.clients = [
            {
                id: 'client-1',
                title: 'Acme',
                archived: false,
                hourlyRate: 100,
                flatRate: false,
                defaultCurrency: 'CHF',
            },
        ];

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
                modalOptions={{ preselectedClientId: 'client-1' }}
            />
        );

        await user.type(screen.getByLabelText('Project Title *'), 'Quoted Project');
        await user.click(screen.getByRole('combobox', { name: 'Project Status' }));
        await user.click(await screen.findByRole('option', { name: 'Quote' }));
        await user.clear(screen.getByLabelText('Deadline'));
        await user.type(screen.getByLabelText('Deadline'), '2026-06-15');
        await user.clear(screen.getByLabelText('Target budget'));
        await user.type(screen.getByLabelText('Target budget'), '2400');
        await user.click(screen.getByRole('button', { name: 'Create Project' }));

        expect(projectHookMocks.createProject).toHaveBeenCalledWith(expect.objectContaining({
            preferredClientId: 'client-1',
            statusMode: 'quote',
            deadline: '2026-06-15',
            budgetAmount: 2400,
        }));
    });

    it('shows a money icon for the target budget field', () => {
        clientState.clients = [
            {
                id: 'client-1',
                title: 'Acme',
                archived: false,
                hourlyRate: 100,
                flatRate: false,
            },
        ];

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
                modalOptions={{ preselectedClientId: 'client-1' }}
            />
        );

        expect(screen.getByText('Compares planned and actual earnings against this target.')).toBeInTheDocument();
        expect(screen.getByLabelText('Target budget').parentElement.querySelector('svg')).toBeInTheDocument();
    });

    it('resets quote mode to active when a project is saved as personal', async () => {
        const user = userEvent.setup();

        clientState.clients = [
            {
                id: 'client-1',
                title: 'Acme',
                archived: false,
                hourlyRate: 100,
                flatRate: false,
            },
        ];

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
                editingProject={{
                    id: 'project-1',
                    title: 'Internal Work',
                    preferredClientId: 'client-1',
                    isPersonal: false,
                    statusMode: 'quote',
                    deadline: '2026-06-20',
                    deadlineResolvedAt: Date.UTC(2026, 4, 29),
                    budgetAmount: 1800,
                    flatRate: false,
                    hourlyRate: 100,
                }}
            />
        );

        await user.click(screen.getByRole('checkbox', { name: 'Personal project (Not billable)' }));
        await user.click(screen.getByRole('button', { name: 'Update Project' }));

        expect(projectHookMocks.updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            isPersonal: true,
            preferredClientId: null,
            statusMode: 'active',
            deadline: null,
            deadlineResolvedAt: null,
            budgetAmount: null,
        }));
    });

    it('clears resolved deadline state when the deadline date changes', async () => {
        const user = userEvent.setup();

        clientState.clients = [
            {
                id: 'client-1',
                title: 'Acme',
                archived: false,
                hourlyRate: 100,
                flatRate: false,
            },
        ];

        render(
            <ProjectModal
                isOpen={true}
                onClose={vi.fn()}
                editingProject={{
                    id: 'project-1',
                    title: 'Quoted Work',
                    preferredClientId: 'client-1',
                    isPersonal: false,
                    statusMode: 'quote',
                    deadline: '2026-06-20',
                    deadlineResolvedAt: Date.UTC(2026, 4, 29),
                    budgetAmount: 1800,
                    flatRate: false,
                    hourlyRate: 100,
                }}
            />
        );

        await user.clear(screen.getByLabelText('Deadline'));
        await user.type(screen.getByLabelText('Deadline'), '2026-06-25');
        await user.click(screen.getByRole('button', { name: 'Update Project' }));

        expect(projectHookMocks.updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
            deadline: '2026-06-25',
            deadlineResolvedAt: null,
        }));
    });
});