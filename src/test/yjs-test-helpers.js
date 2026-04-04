/**
 * Shared test helpers for Yjs-backed hook tests.
 *
 * Uses real Y.Doc / Y.Map instances so that nested Y.Maps
 * (created by objectToYMap in entityUtils) are properly attached
 * to a document and can be read back.
 */
import * as Y from 'yjs';

/**
 * Create a real Y.Map backed by a Y.Doc.
 * Initial values are stored as plain objects (old format) for backwards-compat testing.
 *
 * @param {Record<string, any>} initial - key/value pairs to populate
 * @param {Y.Doc} [doc] - optional shared doc (created if omitted)
 * @param {string} [name] - map name inside the doc
 * @returns {Y.Map}
 */
export function createTestYMap(initial = {}, doc = null, name = 'map') {
    if (!doc) doc = new Y.Doc();
    const map = doc.getMap(name);
    for (const [key, value] of Object.entries(initial)) {
        map.set(key, value);
    }
    return map;
}

/**
 * Read an entity from a Y.Map, handling both nested Y.Map and plain object formats.
 * Convenience wrapper that mirrors readEntity from entityUtils but avoids importing
 * production code in tests.
 */
export function readStored(map, key) {
    const val = map.get(key);
    if (val instanceof Y.Map) {
        const obj = {};
        val.forEach((v, k) => { obj[k] = v; });
        return obj;
    }
    return val;
}
