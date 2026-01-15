/**
 * Utility functions for validating time entries and preventing overlaps
 */

/**
 * Check if a time range overlaps with existing time entries for a given project
 * @param {number} startTime - Start time timestamp to check
 * @param {number} endTime - End time timestamp to check
 * @param {string} projectId - Project ID to check entries for
 * @param {Array} allTimeEntries - Array of all time entries
 * @param {Array} allTasks - Array of all tasks
 * @param {string} excludeEntryId - Entry ID to exclude from overlap check (for editing existing entries)
 * @returns {Object} Object with isValid boolean and error message if invalid
 */
export const checkTimeOverlap = (startTime, endTime, projectId, allTimeEntries, allTasks, excludeEntryId = null) => {
    // Get all tasks for this project
    const projectTasks = allTasks.filter(task => task.projectId === projectId);
    const projectTaskIds = projectTasks.map(task => task.id);
    
    // Get all time entries for this project's tasks
    const projectTimeEntries = allTimeEntries.filter(entry => 
        projectTaskIds.includes(entry.taskId) && 
        entry.id !== excludeEntryId && // Exclude the entry being edited
        entry.start !== undefined && 
        entry.end !== undefined &&
        !isNaN(entry.start) && 
        !isNaN(entry.end)
    );
    
    // Check for overlaps
    for (const entry of projectTimeEntries) {
        const entryStart = entry.start;
        const entryEnd = entry.end;
        
        // Check if the new time range overlaps with this entry
        // Two ranges overlap if: start1 < end2 && start2 < end1
        if (startTime < entryEnd && endTime > entryStart) {
            const overlappingTask = allTasks.find(task => task.id === entry.taskId);
            const taskTitle = overlappingTask ? overlappingTask.title : 'Unknown Task';
            
            return {
                isValid: false,
                error: `Time range overlaps with existing entry for "${taskTitle}" (${new Date(entryStart).toLocaleString()} - ${new Date(entryEnd).toLocaleString()})`
            };
        }
    }
    
    return { isValid: true, error: null };
};

/**
 * Check if a timer start time would overlap with existing time entries
 * @param {number} startTime - Timer start time timestamp
 * @param {number} currentTime - Current time (for calculating potential end time)
 * @param {string} projectId - Project ID
 * @param {Array} allTimeEntries - Array of all time entries
 * @param {Array} allTasks - Array of all tasks
 * @returns {Object} Object with isValid boolean and error message if invalid
 */
export const checkTimerStartOverlap = (startTime, currentTime, projectId, allTimeEntries, allTasks) => {
    // For timer validation, we check if the start time would create an overlap
    // assuming the timer runs until now
    return checkTimeOverlap(startTime, currentTime, projectId, allTimeEntries, allTasks);
};

/**
 * Get the latest end time for a project to ensure new entries don't go before it
 * @param {string} projectId - Project ID
 * @param {Array} allTimeEntries - Array of all time entries
 * @param {Array} allTasks - Array of all tasks
 * @param {string} excludeEntryId - Entry ID to exclude (for editing existing entries)
 * @returns {number|null} Latest end time timestamp or null if no entries exist
 */
export const getLatestEndTimeForProject = (projectId, allTimeEntries, allTasks, excludeEntryId = null) => {
    // Get all tasks for this project
    const projectTasks = allTasks.filter(task => task.projectId === projectId);
    const projectTaskIds = projectTasks.map(task => task.id);
    
    // Get all time entries for this project's tasks
    const projectTimeEntries = allTimeEntries.filter(entry => 
        projectTaskIds.includes(entry.taskId) && 
        entry.id !== excludeEntryId &&
        entry.end !== undefined && 
        !isNaN(entry.end)
    );
    
    if (projectTimeEntries.length === 0) {
        return null;
    }
    
    // Find the latest end time
    return Math.max(...projectTimeEntries.map(entry => entry.end));
};

/**
 * Get the earliest start time for a project to ensure new entries don't go after it
 * @param {string} projectId - Project ID
 * @param {Array} allTimeEntries - Array of all time entries
 * @param {Array} allTasks - Array of all tasks
 * @param {string} excludeEntryId - Entry ID to exclude (for editing existing entries)
 * @returns {number|null} Earliest start time timestamp or null if no entries exist
 */
export const getEarliestStartTimeForProject = (projectId, allTimeEntries, allTasks, excludeEntryId = null) => {
    // Get all tasks for this project
    const projectTasks = allTasks.filter(task => task.projectId === projectId);
    const projectTaskIds = projectTasks.map(task => task.id);
    
    // Get all time entries for this project's tasks
    const projectTimeEntries = allTimeEntries.filter(entry => 
        projectTaskIds.includes(entry.taskId) && 
        entry.id !== excludeEntryId &&
        entry.start !== undefined && 
        !isNaN(entry.start)
    );
    
    if (projectTimeEntries.length === 0) {
        return null;
    }
    
    // Find the earliest start time
    return Math.min(...projectTimeEntries.map(entry => entry.start));
};
