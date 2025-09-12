import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { customToast } from "../shared/utils/customToast";
import type { WalletContextType } from "../types";

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const hasShownConnectedToast = useRef(false);

  useEffect(() => {
    if (isConnected && chain && !hasShownConnectedToast.current) {
      customToast.success(`Connected to ${chain.name}`);
      hasShownConnectedToast.current = true;
    } else if (!isConnected) {
      hasShownConnectedToast.current = false;
    }
  }, [isConnected, chain, address]);

  useEffect(() => {
    if (connectError) {
      // eslint-disable-next-line no-console
      console.error("WalletContext - Connection error:", connectError);
      customToast.error(`Connection error: ${connectError.message}`);
    }
  }, [connectError]);

  const connectWallet = useCallback(async () => {
    // Try each connector
    for (const connector of connectors) {
      try {
        const result = await connect({ connector });
        // Check if connection was successful
        if (result) {
          return true;
        }
      } catch (error) {
        // Log error but continue to next connector
        console.warn(`Failed to connect with ${connector.name}:`, error);
        // Continue to next connector
      }
    }

    // If no connectors worked, show error
    customToast.error("Failed to connect wallet. Please try again.");
    return false;
  }, [connect, connectors]);

  // E2E test helper: Listen for e2e-connect event to trigger wallet connection
  useEffect(() => {
    const handler = () => {
      void connectWallet();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("e2e-connect", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("e2e-connect", handler);
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
      chainName: chain?.name,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
