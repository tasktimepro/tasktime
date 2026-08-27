import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Notice } from './notice'

describe('Notice', () => {
    it('renders description-only notices without an empty title', () => {
        const { container } = render(
            <Notice
                variant="warning"
                description="Do not use TaskTime on other devices during this transfer."
            />,
        )

        expect(screen.getByText('Do not use TaskTime on other devices during this transfer.')).toBeInTheDocument()
        expect(container.querySelector('p.font-medium')).toBeNull()
    })
})
