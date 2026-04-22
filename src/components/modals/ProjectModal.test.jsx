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
});