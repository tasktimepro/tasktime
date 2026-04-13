import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MobileBottomNav from './MobileBottomNav'

describe('MobileBottomNav', () => {
    it('renders with an opaque dock background', () => {
        render(
            <MobileBottomNav
                items={[
                    {
                        key: 'dashboard',
                        label: 'Dashboard',
                        Icon: () => <span>Dashboard icon</span>,
                        isActive: true,
                        onClick: vi.fn(),
                    },
                ]}
                isMoreActive={false}
                onOpenMore={vi.fn()}
            />
        )

        const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })

        expect(navigation.className).toContain('bg-background')
        expect(navigation.className.includes('backdrop-blur')).toBe(false)
        expect(navigation.className.includes('bg-background/95')).toBe(false)
    })
})