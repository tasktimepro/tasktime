import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

/** Namespace UUID for deterministic recurring-expense IDs */
const RECURRING_EXPENSE_NAMESPACE = '7a3f8b2e-1d4c-4e5f-9a6b-0c8d7e2f3a1b';

/**
 * Generate a unique UUID v4 identifier
 * @returns {string} A unique UUID string
 */
export const generateId = (): string => {
    return uuidv4();
};

/**
 * Generate a deterministic ID for a recurring expense instance.
 * Same recurrenceId + date always produces the same UUID on every device,
 * preventing duplicates when multiple devices generate the same occurrence.
 */
export const generateRecurringExpenseId = (recurrenceId: string, date: string): string => {
    return uuidv5(`${recurrenceId}:${date}`, RECURRING_EXPENSE_NAMESPACE);
};

/**
 * Convert a string to a URL-friendly slug
 * @param {string} text - The text to slugify
 * @returns {string} A URL-friendly slug
 */
export const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/-+/g, '-')      // Replace multiple hyphens with single
        .substring(0, 50);        // Limit length
};

/**
 * Generate a slug-based ID combining name and a short unique ID
 * Format: "project-name-a1b2c3d4"
 * @param {string} name - The name/title to include in the slug
 * @returns {string} A human-readable slug ID
 */
export const generateSlugId = (name: string): string => {
    const slug = slugify(name);
    const shortId = uuidv4().split('-')[0]; // First segment of UUID (8 chars)
    return slug ? `${slug}-${shortId}` : shortId;
};
