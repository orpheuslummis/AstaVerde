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
    for (const connector of connectors) {
      try {
        await connect({ connector });
        // The connection attempt has been made, but we need to check the result
        // We can use a short timeout to allow for the connection state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        if (isConnected && address) {
          return true;
        }
      } catch (error) {
        // Continue to next connector
      }
    }

    return false;
  }, [connect, connectors, isConnected, address]);

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
