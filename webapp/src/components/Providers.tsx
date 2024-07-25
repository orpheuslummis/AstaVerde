'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from "connectkit";
import { WagmiProvider } from "wagmi";
import { AppProvider } from '../contexts/AppContext';
import { WalletProvider } from "../contexts/WalletContext";
import { config } from "../wagmi";
import { GlobalLoadingProvider } from './GlobalLoadingProvider';

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GlobalLoadingProvider>
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    <ConnectKitProvider>
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