import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SortIcon } from '@/components/ui/icons'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './select'

describe('SelectTrigger', () => {
    it('centers icon-only triggers without label flex sizing', () => {
        render(
            <Select defaultValue="createdAt">
                <SelectTrigger
                    aria-label="Sort clients"
                    leadingIcon={SortIcon}
                    hideCaret
                    iconOnly
                >
                    <span className="sr-only">
                        <SelectValue placeholder="Sort by" />
                    </span>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="createdAt">Newest</SelectItem>
                </SelectContent>
            </Select>
        )

        const trigger = screen.getByRole('combobox', { name: 'Sort clients' })
        const leadingWrapper = trigger.querySelector('[data-select-leading]')

        expect(trigger.className).toContain('justify-center')
        expect(trigger.className).toContain('w-9')
        expect(leadingWrapper?.className).toContain('justify-center')
        expect(leadingWrapper?.className).not.toContain('flex-1')
    })

    it('keeps labeled triggers using the flexible text wrapper', () => {
        render(
            <Select defaultValue="createdAt">
                <SelectTrigger aria-label="Sort projects" leadingIcon={SortIcon}>
                    <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="createdAt">Newest</SelectItem>
                </SelectContent>
            </Select>
        )

        const trigger = screen.getByRole('combobox', { name: 'Sort projects' })
        const leadingWrapper = trigger.querySelector('[data-select-leading]')

        expect(trigger.className).toContain('justify-between')
        expect(leadingWrapper?.className).toContain('flex-1')
        expect(leadingWrapper?.className).toContain('text-left')
    })
})
