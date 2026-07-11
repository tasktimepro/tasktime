type SchemaNode = {
    type?: string | string[];
    properties?: Record<string, SchemaNode>;
    required?: string[];
    additionalProperties?: boolean;
    items?: SchemaNode;
    enum?: unknown[];
    minItems?: number;
};

export interface JsonSchemaValidationResult {
    valid: boolean;
    errors: string[];
}

const valueType = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

export function validateJsonSchemaInput(schema: unknown, value: unknown): JsonSchemaValidationResult {
    const errors: string[] = [];
    validateNode(schema as SchemaNode, value, '$', errors);
    return { valid: errors.length === 0, errors };
}

function validateNode(schema: SchemaNode, value: unknown, path: string, errors: string[]): void {
    if (!schema || typeof schema !== 'object') return;

    const acceptedTypes = Array.isArray(schema.type)
        ? schema.type
        : (schema.type ? [schema.type] : []);
    const actualType = valueType(value);

    if (acceptedTypes.length > 0 && !acceptedTypes.includes(actualType)) {
        errors.push(`${path} must be ${acceptedTypes.join(' or ')}, received ${actualType}`);
        return;
    }

    if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
        errors.push(`${path} must be one of the advertised enum values`);
        return;
    }

    if (actualType === 'object') {
        const record = value as Record<string, unknown>;
        const properties = schema.properties ?? {};

        for (const requiredKey of schema.required ?? []) {
            if (!Object.prototype.hasOwnProperty.call(record, requiredKey)) {
                errors.push(`${path}.${requiredKey} is required`);
            }
        }

        for (const [key, propertyValue] of Object.entries(record)) {
            const propertySchema = properties[key];

            if (propertySchema) {
                validateNode(propertySchema, propertyValue, `${path}.${key}`, errors);
            } else if (schema.additionalProperties === false) {
                errors.push(`${path}.${key} is not allowed`);
            }
        }
    }

    if (actualType === 'array') {
        const items = value as unknown[];

        if (typeof schema.minItems === 'number' && items.length < schema.minItems) {
            errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
        }

        if (schema.items) {
            items.forEach((item, index) => validateNode(schema.items!, item, `${path}[${index}]`, errors));
        }
    }
}
