import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { Batch } from '../lib/batch';
import { astaverdeContractConfig, getUsdcContractConfig } from '../lib/contracts';
import { customToast } from '../utils/customToast';

interface AppContextType {
    batches: Batch[];
    astaverdeContractConfig: typeof astaverdeContractConfig;
    getUsdcContractConfig: typeof getUsdcContractConfig;
    usdcContractConfig: ReturnType<typeof getUsdcContractConfig>;
    refetchBatches: () => void;
    updateBatch: (updatedBatch: Batch) => void;
    updateBatchItemsLeft: (batchId: number, newItemsLeft: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [batches, setBatches] = useState<Batch[]>([]);

    const { data: lastBatchID, refetch: refetchLastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: 'lastBatchID',
    });

    const { data: batchesData, refetch: refetchBatchesData } = useReadContracts({
        contracts: lastBatchID ? Array.from({ length: Number(lastBatchID) }, (_, i) => ({
            ...astaverdeContractConfig,
            functionName: 'getBatchInfo',
            args: [BigInt(i + 1)],
        })) : [],
    });

    const fetchBatches = useCallback(async () => {
        await refetchLastBatchID();
        await refetchBatchesData();
    }, [refetchLastBatchID, refetchBatchesData]);

    const refetchBatches = useCallback(async () => {
        try {
            await fetchBatches();
        } catch (error) {
            console.error('Error refetching batches:', error);
            customToast.error('Failed to update batch information');
        }
    }, [fetchBatches]);

    const updateBatch = useCallback((updatedBatch: Batch) => {
        setBatches(prevBatches =>
            prevBatches.map(batch =>
                batch.id === updatedBatch.id ? updatedBatch : batch
            )
        );
    }, []);

    const updateBatchItemsLeft = useCallback((batchId: number, newItemsLeft: number) => {
        setBatches(prevBatches =>
            prevBatches.map(batch =>
                batch.id === batchId ? { ...batch, itemsLeft: newItemsLeft } : batch
            )
        );
    }, []);

    useEffect(() => {
        if (batchesData) {
            const newBatches = batchesData
                .map((data, index) => {
                    if (data && data.result && Array.isArray(data.result)) {
                        const [batchId, tokenIds, creationTime, price, remainingTokens] = data.result;
                        return new Batch(BigInt(index + 1), tokenIds, creationTime, price, remainingTokens);
                    }
                    return null;
                })
                .filter((batch): batch is Batch => batch !== null);
            setBatches(newBatches);
        }
    }, [batchesData]);

    const contextValue = useMemo(() => ({
        batches,
        astaverdeContractConfig,
        getUsdcContractConfig,
        usdcContractConfig: getUsdcContractConfig(),
        refetchBatches,
        updateBatch,
        updateBatchItemsLeft,
    }), [batches, refetchBatches, updateBatch, updateBatchItemsLeft]);

    return (
        <AppContext.Provider value={contextValue}>
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