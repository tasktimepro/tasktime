import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProjectsOverview from './ProjectsOverview';

vi.mock('../../hooks/useIsMobileLayout', () => ({ default: () => false }));

describe('dashboard project color dots', () => {
    it.each([
        { title: '', color: null, background: '' },
        { title: '  E\u0301quipe', color: 'invalid', background: '' },
        { title: 'Short hex', color: '#abc', background: '#aabbcc' },
        { title: 'Dark color', color: '#172554', background: '#172554' },
        { title: 'Bright color', color: '#eab308', background: '#eab308' },
    ])('renders the project color or neutral fallback for $title', ({ title, color, background }) => {
        render(<ProjectsOverview
            recentProjects={[{ id: 'project', title, color, isPersonal: true, pendingHours: 0, pendingAmount: 0 }]}
            clients={[]} preferredCurrency="EUR" projectFilter="recent" projectSearchQuery=""
            setProjectFilter={vi.fn()} setProjectSearchQuery={vi.fn()}
            navigateToProject={vi.fn()} handleClientTitleClick={vi.fn()}
        />);
        const button = screen.getByTestId('project-color-dot');
        expect(button).toHaveAttribute('aria-hidden', 'true');
        if (background) expect(button).toHaveStyle({ backgroundColor: background });
        else expect(button.style.backgroundColor).toBe('');
        expect(button).toHaveClass('bg-muted-foreground');
        expect(screen.getByText(/Personal/)).toBeInTheDocument();
    });

    it('preserves exact project and inherited colors, title navigation and client navigation', () => {
        const navigateToProject = vi.fn();
        const handleClientTitleClick = vi.fn();
        const client = { id: 'client', title: 'Client studio', color: '#ef4444' };
        render(<ProjectsOverview
            recentProjects={[
                { id: 'blue', title: 'DebugBundle App', color: '#3b82f6', client, pendingHours: 1.1, pendingAmount: 63.25 },
                { id: 'inherited', title: 'Équipe', client, pendingHours: 0, pendingAmount: 0 },
            ]}
            clients={[client]} preferredCurrency="EUR" projectFilter="recent" projectSearchQuery=""
            setProjectFilter={vi.fn()} setProjectSearchQuery={vi.fn()}
            navigateToProject={navigateToProject} handleClientTitleClick={handleClientTitleClick}
        />);
        const blue = screen.getByRole('button', { name: 'DebugBundle App', exact: true });
        const inherited = screen.getByRole('button', { name: 'Équipe', exact: true });
        expect(blue.querySelector('[data-testid=project-color-dot]')).toHaveStyle({ backgroundColor: '#3b82f6' });
        expect(inherited.querySelector('[data-testid=project-color-dot]')).toHaveStyle({ backgroundColor: '#ef4444' });
        fireEvent.click(blue);
        expect(navigateToProject).toHaveBeenLastCalledWith('blue');
        fireEvent.click(inherited);
        expect(navigateToProject).toHaveBeenLastCalledWith('inherited');
        fireEvent.click(screen.getByRole('button', { name: 'DebugBundle App', exact: true }));
        expect(navigateToProject).toHaveBeenLastCalledWith('blue');
        fireEvent.click(screen.getAllByRole('button', { name: 'Client studio', exact: true })[0]);
        expect(handleClientTitleClick).toHaveBeenCalledWith(client);
        expect(screen.getByText('1.1h pending')).toBeInTheDocument();
        expect(screen.getByText('€63.25')).toBeInTheDocument();
    });
});
