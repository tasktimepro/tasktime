import { describe, expect, it } from 'vitest';
import { planDefaultClearing, planDefaultSelection } from './defaultSelection';

describe('default selection planning', () => {
    it('plans clearing existing defaults before setting the target default', () => {
        expect(planDefaultSelection({
            items: [
                { id: 'first', isDefault: true },
                { id: 'second', isDefault: false },
            ],
            targetId: 'second',
        })).toEqual([
            { id: 'first', updates: { isDefault: false } },
            { id: 'second', updates: { isDefault: true } },
        ]);
    });

    it('supports scoped defaults such as email template type', () => {
        const items = [
            { id: 'invoice-1', type: 'invoice', isDefault: true },
            { id: 'invoice-2', type: 'invoice', isDefault: false },
            { id: 'quote-1', type: 'quote', isDefault: true },
        ];

        expect(planDefaultSelection({
            items,
            targetId: 'invoice-2',
            requireExistingTarget: true,
            isInScope: (item, target) => item.type === target?.type,
        })).toEqual([
            { id: 'invoice-1', updates: { isDefault: false } },
            { id: 'invoice-2', updates: { isDefault: true } },
        ]);
    });

    it('can clear defaults without selecting a new target', () => {
        expect(planDefaultClearing({
            items: [
                { id: 'first', isDefault: true },
                { id: 'second', isDefault: true },
            ],
            exceptId: 'second',
        })).toEqual([
            { id: 'first', updates: { isDefault: false } },
        ]);
    });

    it('does not plan target updates when an existing target is required but missing', () => {
        expect(planDefaultSelection({
            items: [{ id: 'first', isDefault: true }],
            targetId: 'missing',
            requireExistingTarget: true,
        })).toEqual([]);
    });
});
