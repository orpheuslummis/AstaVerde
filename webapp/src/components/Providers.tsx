"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { WagmiProvider } from "wagmi";
import { AppProvider } from "../contexts/AppContext";
import { WalletProvider } from "../contexts/WalletContext";
import { wagmiConfig } from "../config/wagmi";
import { GlobalLoadingProvider } from "./GlobalLoadingProvider";
import { ENV } from "../config/environment";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // Disable analytics and debugging features for local development
  const connectKitOptions = ENV.CHAIN_SELECTION === "local"
    ? {
      options: {
        disclaimer: undefined,
        walletConnectCTA: "both" as const,
        enableWebSocketProvider: false,
      },
      debugMode: false,
      customAvatar: undefined,
    }
    : {};

  return (
    <GlobalLoadingProvider>
      <WagmiProvider config={wagmiConfig}>
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
