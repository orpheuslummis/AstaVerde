import React, { createContext, useCallback, useContext, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { customToast } from '../utils/customToast';

interface WalletContextType {
    isConnected: boolean;
    address: string | undefined;
    connect: () => void;
    disconnect: () => void;
    chainId: number | undefined;
    chainName: string | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { address, isConnected, chain } = useAccount();
    const { connect, connectors, error: connectError } = useConnect();
    const { disconnect } = useDisconnect();

    useEffect(() => {
        if (isConnected && chain) {
            customToast.success(`Connected to ${chain.name} (Chain ID: ${chain.id})`);
        } else if (!isConnected) {
            customToast.error("Disconnected from wallet");
        }
    }, [isConnected, chain]);

    useEffect(() => {
        if (connectError) {
            customToast.error(`Connection error: ${connectError.message}`);
            console.error("Wallet connection error:", connectError);
        }
    }, [connectError]);

    const connectWallet = useCallback(() => {
        if (connectors.length > 0) {
            connect({ connector: connectors[0] });
        } else {
            customToast.error("No connectors available");
        }
    }, [connect, connectors]);

    return (
        <WalletContext.Provider value={{
            isConnected,
            address,
            connect: connectWallet,
            disconnect,
            chainId: chain?.id,
            chainName: chain?.name
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}