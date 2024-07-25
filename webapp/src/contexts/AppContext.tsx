import React, { createContext, useCallback, useContext, useState } from 'react';
import { Batch } from '../lib/batch';

interface AppContextType {
    batches: Batch[];
    fetchBatches: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [batches, setBatches] = useState<Batch[]>([]);

    const fetchBatches = useCallback(async () => {
        // Implement batch fetching logic here
    }, []);

    return (
        <AppContext.Provider value={{ batches, fetchBatches }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}