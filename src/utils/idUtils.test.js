import { describe, it, expect } from 'vitest'
import { generateId, slugify, generateSlugId } from './idUtils'

describe('idUtils', () => {

    describe('generateId', () => {

        it('generates a valid UUID', () => {

            const id = generateId()
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
        })

        it('generates unique IDs', () => {

            const ids = new Set()
            for (let i = 0; i < 100; i += 1) {
                ids.add(generateId())
            }
            expect(ids.size).toBe(100)
        })
    })

    describe('slugify', () => {

        it('converts to lowercase', () => {

            expect(slugify('Hello World')).toBe('hello-world')
        })

        it('replaces spaces with hyphens', () => {

            expect(slugify('my project name')).toBe('my-project-name')
        })

        it('removes special characters', () => {

            expect(slugify('Project #1 (Test)')).toBe('project-1-test')
        })

        it('handles multiple spaces/hyphens', () => {

            expect(slugify('my   project---name')).toBe('my-project-name')
        })

        it('trims whitespace', () => {

            expect(slugify('  spaced  ')).toBe('spaced')
        })

        it('limits length to 50 characters', () => {

            const longName = 'a'.repeat(100)
            expect(slugify(longName).length).toBeLessThanOrEqual(50)
        })
    })

    describe('generateSlugId', () => {

        it('combines slug with short ID', () => {

            const id = generateSlugId('My Project')
            expect(id).toMatch(/^my-project-[0-9a-f]{8}$/)
        })

        it('handles empty names', () => {

            const id = generateSlugId('')
            expect(id).toMatch(/^[0-9a-f]{8}$/)
        })

        it('generates unique IDs for same name', () => {

            const id1 = generateSlugId('Test')
            const id2 = generateSlugId('Test')
            expect(id1).not.toBe(id2)
        })
    })
})
