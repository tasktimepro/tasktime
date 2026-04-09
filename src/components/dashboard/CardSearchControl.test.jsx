import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardSearchControl from './CardSearchControl';

describe('CardSearchControl', () => {
    it('keeps the search field collapsed by default and expands with focus on click', async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        render(
            <CardSearchControl
                value=""
                onChange={handleChange}
                placeholder="Search tasks"
                buttonLabel="Search tasks"
                inputAriaLabel="Search tasks"
            />
        );

        expect(screen.queryByRole('textbox', { name: 'Search tasks' })).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Search tasks' }));

        const input = screen.getByRole('textbox', { name: 'Search tasks' });

        expect(document.activeElement).toBe(input);
    });

    it('renders expanded when a search query already exists', () => {
        render(
            <CardSearchControl
                value="alpha"
                onChange={vi.fn()}
                placeholder="Search projects"
                buttonLabel="Search projects"
                inputAriaLabel="Search projects"
            />
        );

        const input = screen.getByRole('textbox', { name: 'Search projects' });

        expect(input.value).toBe('alpha');
    });
});