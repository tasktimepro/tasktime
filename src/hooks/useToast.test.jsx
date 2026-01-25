import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ToastContext } from '../contexts/ToastContext'
import { useToast } from './useToast'

describe('useToast', () => {

    it('throws when used outside provider', () => {

        expect(() => renderHook(() => useToast())).toThrow('useToast must be used within a ToastProvider')
    })

    it('returns context methods when inside provider', () => {

        const contextValue = {
            showSuccess: vi.fn(),
            showError: vi.fn(),
            showInfo: vi.fn(),
            showWarning: vi.fn()
        }

        const wrapper = ({ children }) => (
            <ToastContext.Provider value={contextValue}>
                {children}
            </ToastContext.Provider>
        )

        const { result } = renderHook(() => useToast(), { wrapper })

        result.current.showSuccess('Saved')
        expect(contextValue.showSuccess).toHaveBeenCalledWith('Saved')
    })
})
