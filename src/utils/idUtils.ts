import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique UUID v4 identifier
 * @returns {string} A unique UUID string
 */
export const generateId = (): string => {
    return uuidv4();
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
