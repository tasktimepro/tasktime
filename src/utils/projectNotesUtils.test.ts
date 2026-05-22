import { describe, expect, it } from 'vitest';
import {
    createEmptyProjectNotesDocument,
    createProjectNotesPayload,
    createProjectNotesPreview,
    extractProjectNotesPlainText,
    isProjectNotesDocumentEmpty,
} from './projectNotesUtils';

describe('projectNotesUtils', () => {
    it('creates a stable empty document shape', () => {
        expect(createEmptyProjectNotesDocument()).toEqual({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                },
            ],
        });
    });

    it('extracts plain text from nested TipTap nodes', () => {
        expect(extractProjectNotesPlainText({
            type: 'doc',
            content: [
                {
                    type: 'heading',
                    content: [{ type: 'text', text: 'Kickoff' }],
                },
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Share status update' }],
                },
            ],
        })).toBe('Kickoff\nShare status update');
    });

    it('creates a trimmed preview and payload metadata', () => {
        const document = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'A'.repeat(250) }],
                },
            ],
        };

        const preview = createProjectNotesPreview(document, 20);
        const payload = createProjectNotesPayload(document, 123);

        expect(preview).toBe(`${'A'.repeat(19)}…`);
        expect(payload).toMatchObject({
            version: 1,
            type: 'tiptap-json',
            updatedAt: 123,
        });
        expect(payload.plainTextPreview?.length).toBeLessThanOrEqual(200);
    });

    it('detects empty note documents', () => {
        expect(isProjectNotesDocumentEmpty(createEmptyProjectNotesDocument())).toBe(true);
        expect(isProjectNotesDocumentEmpty({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Not empty' }],
                },
            ],
        })).toBe(false);
    });
});