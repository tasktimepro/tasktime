import { useState, useEffect, useCallback, useRef } from 'react';
import { openDB } from 'idb';

/**
 * Database configuration
 */
const DB_NAME = 'tasktime-db';
const DB_VERSION = 1;
const STORE_NAME = 'app-data';
const BROADCAST_CHANNEL_NAME = 'tasktime-sync';

/**
 * Singleton database instance promise
 * Ensures we only open one connection
 */
let dbPromise = null;

/**
 * Singleton BroadcastChannel for cross-tab communication
 * Used to sync state changes across browser tabs
 */
let broadcastChannel = null;

/**
 * Get or create the BroadcastChannel
 * @returns {BroadcastChannel|null} BroadcastChannel instance or null if not supported
 */
const getBroadcastChannel = () => {
    if (typeof BroadcastChannel === 'undefined') {
        return null; // Not supported in this browser
    }
    
    if (!broadcastChannel) {
        broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    }
    
    return broadcastChannel;
};

/**
 * Get or create the database connection
 * @returns {Promise} Database instance
 */
const getDB = () => {

    if (!dbPromise) {

        dbPromise = openDB(DB_NAME, DB_VERSION, {

            upgrade(db) {

                // Create the object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {

                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }

    return dbPromise;
};

/**
 * Custom hook for managing IndexedDB state
 * Provides a similar API to useState but persists to IndexedDB
 * 
 * @param {string} key - The key to store the value under
 * @param {*} defaultValue - Default value if no stored value exists
 * @returns {Array} [value, setValue, { loading, error }] - Current value, setter, and status
 */
export const useIndexedDB = (key, defaultValue) => {

    const [value, setValue] = useState(defaultValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Track if this is the initial load to prevent writing default value
    const isInitialLoad = useRef(true);
    
    // Track the latest value to avoid stale closures in save
    const latestValue = useRef(value);
    latestValue.current = value;
    
    // Track if the update came from another tab to prevent echo
    const isExternalUpdate = useRef(false);

    /**
     * Load initial value from IndexedDB
     */
    useEffect(() => {

        const loadValue = async () => {

            try {

                const db = await getDB();
                const storedValue = await db.get(STORE_NAME, key);

                if (storedValue !== undefined) {

                    setValue(storedValue);
                }

                setLoading(false);
                isInitialLoad.current = false;

            } catch (err) {

                console.error(`Error loading "${key}" from IndexedDB:`, err);
                setError(err);
                setLoading(false);
                isInitialLoad.current = false;
            }
        };

        loadValue();
    }, [key]);
    
    /**
     * Listen for cross-tab updates via BroadcastChannel
     */
    useEffect(() => {
        const channel = getBroadcastChannel();
        if (!channel) return;
        
        const handleMessage = (event) => {
            // Only process messages for this key
            if (event.data?.key !== key) return;
            
            // Mark as external update to prevent broadcasting back
            isExternalUpdate.current = true;
            setValue(event.data.value);
            
            // Reset the flag after a microtask
            Promise.resolve().then(() => {
                isExternalUpdate.current = false;
            });
        };
        
        channel.addEventListener('message', handleMessage);
        
        return () => {
            channel.removeEventListener('message', handleMessage);
        };
    }, [key]);

    /**
     * Save value to IndexedDB whenever it changes
     */
    useEffect(() => {

        // Don't save during initial load
        if (isInitialLoad.current) {

            return;
        }

        const saveValue = async () => {

            try {

                const db = await getDB();
                await db.put(STORE_NAME, value, key);
                
                // Broadcast the change to other tabs (only if this wasn't an external update)
                if (!isExternalUpdate.current) {
                    const channel = getBroadcastChannel();
                    if (channel) {
                        channel.postMessage({ key, value });
                    }
                }

            } catch (err) {

                console.error(`Error saving "${key}" to IndexedDB:`, err);
                setError(err);
            }
        };

        saveValue();
    }, [key, value]);

    /**
     * Wrapped setValue that can accept a function or value
     * Matches the useState API
     */
    const setStoredValue = useCallback((newValue) => {

        setValue(prevValue => {

            // Support functional updates like setState(prev => prev + 1)
            const resolvedValue = typeof newValue === 'function' 
                ? newValue(prevValue) 
                : newValue;

            return resolvedValue;
        });
    }, []);

    return [value, setStoredValue, { loading, error }];
};

/**
 * Hook to track loading state across multiple useIndexedDB hooks
 * Returns true only when ALL provided loading states are false
 * 
 * @param {Array<{loading: boolean}>} states - Array of status objects from useIndexedDB
 * @returns {boolean} True if any state is still loading
 */
export const useIndexedDBLoading = (states) => {

    return states.some(state => state.loading);
};

/**
 * Utility to clear all data (useful for testing/reset)
 */
export const clearAllData = async () => {

    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    await tx.done;
};

/**
 * Utility to get all keys (useful for debugging)
 */
export const getAllKeys = async () => {

    const db = await getDB();
    return db.getAllKeys(STORE_NAME);
};

export default useIndexedDB;
