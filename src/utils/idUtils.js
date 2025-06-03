import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique UUID v4 identifier
 * @returns {string} A unique UUID string
 */
export const generateId = () => {
    return uuidv4();
};
