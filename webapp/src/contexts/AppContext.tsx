import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { Batch } from '../lib/batch';
import { astaverdeContractConfig } from '../lib/contracts';

interface AppContextType {
    useContractInteraction: typeof useContractInteraction;
    batches: Batch[];
    fetchBatches: () => Promise<void>;
    adminControls: AdminControls;
}

interface AdminControls {
    pauseContract: () => void;
    unpauseContract: () => void;
    setURI: (uri: string) => void;
    setPriceFloor: (price: string) => void;
    setBasePrice: (price: string) => void;
    setMaxBatchSize: (size: string) => void;
    setAuctionTimeThresholds: (increase: string, decrease: string) => void;
    setPlatformSharePercentage: (percentage: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const useContractInteraction = ({ contractConfig, functionName, args = [], onSuccessCallback }: {
    contractConfig: typeof astaverdeContractConfig;
    functionName: string;
    args?: any[];
    onSuccessCallback?: () => void;
}) => {
    const { data: simulateResult, error: simulateError } = useSimulateContract({
        ...contractConfig,
        functionName,
        args,
    });

    const { writeContract, isPending, isSuccess, error: writeError } = useWriteContract();

    const write = useCallback(() => {
        if (simulateResult?.request) {
            writeContract(simulateResult.request)
                .catch(error => {
                    console.error(`Error executing ${functionName}:`, error);
                    customToast.error(`Failed to execute ${functionName}`);
                });
        } else {
            console.error(`Simulation failed for ${functionName}`);
            customToast.error(`Unable to execute ${functionName}`);
        }
    }, [simulateResult, writeContract, functionName]);

    useEffect(() => {
        if (isSuccess && onSuccessCallback) {
            onSuccessCallback();
            customToast.success(`${functionName} executed successfully`);
        }
    }, [isSuccess, onSuccessCallback, functionName]);

    useEffect(() => {
        if (simulateError) {
            console.error(`Simulation error for ${functionName}:`, simulateError);
            customToast.error(`Error simulating ${functionName}`);
        }
    }, [simulateError, functionName]);

    return { write, isPending, isSuccess, error: simulateError || writeError };
};

const AppContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [batches, setBatches] = useState<Batch[]>([]);

    const { data: lastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: 'lastBatchID',
    });

    const { data: batchesData } = useReadContracts({
        contracts: lastBatchID ? Array.from({ length: Number(lastBatchID) }, (_, i) => ({
            ...astaverdeContractConfig,
            functionName: 'getBatchInfo',
            args: [BigInt(i + 1)],
        })) : [],
    });

    useEffect(() => {
        if (batchesData) {
            const newBatches = batchesData
                .map((result, index) => {
                    if (result.status === 'success' && Array.isArray(result.result)) {
                        return new Batch(index + 1, result.result[1], result.result[2], result.result[3], result.result[4]);
                    }
                    return null;
                })
                .filter((batch): batch is Batch => batch !== null);
            setBatches(newBatches);
        }
    }, [batchesData]);

    const fetchBatches = useCallback(async () => {
        // This function is now empty as we're using hooks to fetch data
    }, []);

    const createAdminControl = (functionName: string, argsTransformer = (args: any[]) => args) => {
        return (...args: any[]) => {
            const { write } = useContractInteraction({
                contractConfig: astaverdeContractConfig,
                functionName,
                args: argsTransformer(args)
            });
            write();
        };
    };

    const adminControls: AdminControls = {
        pauseContract: createAdminControl('pause'),
        unpauseContract: createAdminControl('unpause'),
        setURI: createAdminControl('setURI'),
        setPriceFloor: createAdminControl('setPriceFloor', ([price]) => [BigInt(price)]),
        setBasePrice: createAdminControl('setBasePrice', ([price]) => [BigInt(price)]),
        setMaxBatchSize: createAdminControl('setMaxBatchSize', ([size]) => [BigInt(size)]),
        setAuctionTimeThresholds: createAdminControl('setAuctionTimeThresholds', ([increase, decrease]) => [BigInt(increase), BigInt(decrease)]),
        setPlatformSharePercentage: createAdminControl('setPlatformSharePercentage', ([percentage]) => [BigInt(percentage)]),
    };

    return (
        <>
            {children}
            <AppContext.Provider value={{ useContractInteraction, batches, fetchBatches, adminControls }}>
                <></>
            </AppContext.Provider>
        </>
    );
};

export function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <AppContext.Provider value={{ useContractInteraction, batches: [], fetchBatches: () => Promise.resolve(), adminControls: {} }}>
            <AppContent>{children}</AppContent>
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