import { describe, expect, it } from 'vitest';
import { validateJsonSchemaInput } from './jsonSchemaValidator';

describe('MCP JSON schema validation', () => {
    it('enforces required fields, nested arrays, enums, and closed objects', () => {
        const schema = {
            type: 'object',
            properties: {
                mode: { type: 'string', enum: ['one', 'two'] },
                rows: {
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'object',
                        properties: { amount: { type: 'number' } },
                        required: ['amount'],
                        additionalProperties: false,
                    },
                },
            },
            required: ['mode', 'rows'],
            additionalProperties: false,
        };

        expect(validateJsonSchemaInput(schema, {
            mode: 'three',
            rows: [{ amount: '10', extra: true }],
        })).toEqual({
            valid: false,
            errors: [
                '$.mode must be one of the advertised enum values',
                '$.rows[0].amount must be number, received string',
                '$.rows[0].extra is not allowed',
            ],
        });
    });
});
