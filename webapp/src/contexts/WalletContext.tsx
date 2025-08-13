import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { customToast } from '../utils/customToast';
import type { WalletContextType } from '../types';

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const { address, isConnected, chain } = useAccount();
    const { connect, connectors, error: connectError } = useConnect();
    const { disconnect } = useDisconnect();
    const hasShownConnectedToast = useRef(false);

    useEffect(() => {
        if (isConnected && chain && !hasShownConnectedToast.current) {
            console.log(`WalletContext - Connected to ${chain.name} (Chain ID: ${chain.id})`);
            console.log("WalletContext - Connected address:", address);
            customToast.success(`Connected to ${chain.name}`);
            hasShownConnectedToast.current = true;
        } else if (!isConnected) {
            console.log("WalletContext - Disconnected");
            hasShownConnectedToast.current = false;
        }
    }, [isConnected, chain, address]);

    useEffect(() => {
        if (connectError) {
            console.error("WalletContext - Connection error:", connectError);
            customToast.error(`Connection error: ${connectError.message}`);
        }
    }, [connectError]);

    const connectWallet = useCallback(async () => {
        console.log("WalletContext - Attempting to connect wallet");
        console.log("Available connectors:", connectors.map(c => ({ name: c.name, id: c.id })));

        for (const connector of connectors) {
            console.log(`WalletContext - Trying to connect with ${connector.name} (ID: ${connector.id})`);
            try {
                await connect({ connector });
                // The connection attempt has been made, but we need to check the result
                // We can use a short timeout to allow for the connection state to update
                await new Promise(resolve => setTimeout(resolve, 100));
                if (isConnected && address) {
                    console.log(`WalletContext - Successfully connected with ${connector.name}. Account:`, address);
                    return true;
                }
                console.log(`WalletContext - Connection with ${connector.name} did not result in a connected account.`);
            } catch (error) {
                console.error(`WalletContext - Error connecting with ${connector.name}:`, error instanceof Error ? error.message : 'Unknown error');
            }
        }

        console.error("WalletContext - Failed to connect with any available connector");
        return false;
    }, [connect, connectors, isConnected, address]);

    // E2E test helper: Listen for e2e-connect event to trigger wallet connection
    useEffect(() => {
        const handler = () => {
            void connectWallet();
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('e2e-connect', handler);
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('e2e-connect', handler);
            }
        };
    }, [connectWallet]);

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