"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { WagmiProvider } from "wagmi";
import { AppProvider } from "../contexts/AppContext";
import { WalletProvider } from "../contexts/WalletContext";
import { wagmiConfig } from "../config/wagmi";
import { GlobalLoadingProvider } from "./GlobalLoadingProvider";
import { ENV } from "../config/environment";
import { ThemeProvider } from "../contexts/ThemeContext";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // Disable analytics and debugging features for local development
  // The app is single-chain: if the wallet sits on another network, ConnectKit shows a
  // "switch network" prompt instead of a bare warning badge and a refused purchase.
  const connectKitOptions = ENV.CHAIN_SELECTION === "local"
    ? {
      options: {
        disclaimer: undefined,
        walletConnectCTA: "both" as const,
        enableWebSocketProvider: false,
        enforceSupportedChains: true,
      },
      debugMode: false,
      customAvatar: undefined,
    }
    : { options: { enforceSupportedChains: true } };

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
