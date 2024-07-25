import React, { createContext, useContext } from 'react';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { CHAIN_SELECTION } from '../app.config';

const getChain = () => {
    switch (CHAIN_SELECTION) {
        case "base_mainnet":
            return base;
        case "base_sepolia":
        default:
            return baseSepolia;
    }
};

const publicClient = createPublicClient({
    chain: getChain(),
    transport: http()
});

const PublicClientContext = createContext(publicClient);

export function PublicClientProvider({ children }: { children: React.ReactNode }) {
    return (
        <PublicClientContext.Provider value={publicClient}>
            {children}
        </PublicClientContext.Provider>
    );
}

export function usePublicClient() {
    return useContext(PublicClientContext);
}