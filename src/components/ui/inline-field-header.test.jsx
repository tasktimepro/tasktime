import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { InlineFieldHeader } from '@/components/ui/inline-field-header';

describe('InlineFieldHeader', () => {
    it('keeps the label and action in a single inline flex row', () => {
        const { container } = render(
            <InlineFieldHeader
                action={(
                    <Button type="button" variant="link" size="sm" className="h-auto p-0">
                        + New Client
                    </Button>
                )}
            >
                <span>Client</span>
            </InlineFieldHeader>
        );

        const header = container.firstChild;

        expect(header.className).toContain('flex');
        expect(header.className).toContain('justify-between');
        expect(header.className).not.toContain('flex-col');
        expect(screen.getByRole('button', { name: '+ New Client' })).toBeInTheDocument();
    });
});