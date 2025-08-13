'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from "connectkit";
import { WagmiProvider } from "wagmi";
import { AppProvider } from '../contexts/AppContext';
import { WalletProvider } from "../contexts/WalletContext";
import { config } from "../wagmi";
import { GlobalLoadingProvider } from './GlobalLoadingProvider';
import { CHAIN_SELECTION } from '../app.config';

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    // Disable analytics and debugging features for local development
    const connectKitOptions = CHAIN_SELECTION === 'local' 
        ? {
            options: {
                disclaimer: undefined,
                walletConnectCTA: 'both',
                enableWebSocketProvider: false,
            },
            debugMode: false,
            customAvatar: undefined,
          }
        : {};

    return (
        <GlobalLoadingProvider>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <ConnectKitProvider {...connectKitOptions}>
                        <WalletProvider>
                            <AppProvider>
                                {children}
                            </AppProvider>
                        </WalletProvider>
                    </ConnectKitProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </GlobalLoadingProvider>
    );
}