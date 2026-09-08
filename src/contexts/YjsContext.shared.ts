import { createContext } from 'react';
import type { YjsContextValue } from './YjsContext';

// Keep context identity independent of provider UI dependencies. A shared-modal
// hot update can reload a lazy consumer's provider module without remounting
// the existing provider; both must still reference the same context.
export const YjsContext = createContext<YjsContextValue | null>(null);
