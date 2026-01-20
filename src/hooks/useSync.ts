import { useContext } from 'react';
import { SyncContext } from '@/contexts/SyncContext';

export const useSync = () => {

    const context = useContext(SyncContext);

    if (!context) {

        throw new Error('useSync must be used within a SyncProvider');
    }

    return context;
};
