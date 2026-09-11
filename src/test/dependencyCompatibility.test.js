import { describe, expect, it, vi } from 'vitest';
import { Editor, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { createProjectNotesPayload, extractProjectNotesPlainText } from '@/utils/projectNotesUtils';

describe('dependency compatibility and security', () => {
    it('does not turn JSON-origin prototype keys into inherited DOM attributes', () => {
        // GHSA-cp6q-959q-f8rh: exercise the actual installed dependency, not a mock.
        const input = JSON.parse('{"__proto__":{"onerror":"canary","data-inherited-canary":"present"}}');
        const attributes = mergeAttributes({ class: 'existing' }, input);
        expect(attributes.onerror).toBeUndefined();
        expect(attributes['data-inherited-canary']).toBeUndefined();
        expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
        expect(attributes.class).toBe('existing');
    });

    it('opens historical version-1 notes without rewriting them and keeps edits reversible', () => {
        const document = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Existing project' }] },
                { type: 'paragraph', content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Keep this brief' },
                    { type: 'text', text: ' and this link: ' },
                    { type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com/brief', target: '_blank', rel: 'noopener noreferrer', class: null, title: null } }], text: 'Client brief' },
                ] },
                { type: 'taskList', content: [
                    { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Already done' }] }] },
                    { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Still pending' }] }] },
                ] },
                { type: 'paragraph' },
            ],
        };
        const persisted = createProjectNotesPayload(document, 1700000000000);
        const original = JSON.stringify(persisted);
        const onUpdate = vi.fn();
        const editor = new Editor({
            extensions: [
                StarterKit.configure({ link: false, heading: { levels: [2, 3] } }),
                Link.configure({ HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
                TaskList,
                TaskItem.configure({ nested: true }),
            ],
            content: persisted.content,
            onUpdate,
        });
        try {
            expect(editor.getJSON()).toEqual(document);
            expect(onUpdate).not.toHaveBeenCalled();
            expect(JSON.stringify(persisted)).toBe(original);
            expect(editor.getHTML()).toContain('data-checked="true"');
            expect(editor.getHTML()).toContain('href="https://example.com/brief"');
            editor.commands.insertContentAt(1, 'Updated ');
            expect(extractProjectNotesPlainText(editor.getJSON())).toContain('Updated Existing project');
            expect(editor.commands.undo()).toBe(true);
            expect(editor.getJSON()).toEqual(document);
            expect(editor.commands.redo()).toBe(true);
            const saved = createProjectNotesPayload(editor.getJSON(), 1700000001000);
            expect(saved.version).toBe(1);
            expect(saved.type).toBe('tiptap-json');
            expect(saved.plainTextPreview).toContain('Already done');
        } finally {
            editor.destroy();
        }
    });
});
