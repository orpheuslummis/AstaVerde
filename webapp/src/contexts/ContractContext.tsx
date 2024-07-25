import React, { createContext, useContext, useMemo } from 'react';
import { useReadContract, useReadContracts, useSimulateContract, useWriteContract } from 'wagmi';
import { astaverdeContractConfig, getUsdcContractConfig } from '../lib/contracts';

const ContractContext = createContext<any>(null);

export function ContractProvider({ children }: { children: React.ReactNode }) {
    const contractInteraction = useMemo(() => ({
        useSimulateContract,
        useWriteContract,
        useReadContract,
        useReadContracts,
        astaverdeContractConfig,
        getUsdcContractConfig,
    }), []);

    return (
        <ContractContext.Provider value={contractInteraction}>
            {children}
        </ContractContext.Provider>
    );
}

export function useContractContext() {
    const context = useContext(ContractContext);
    if (!context) {
        throw new Error('useContractContext must be used within a ContractProvider');
    }
    return context;
}