import { createConnector } from "wagmi";
import type { Address, Chain } from "viem";
import { custom } from "viem";

/**
 * Mock connector for E2E testing
 * Provides a simulated wallet connection without MetaMask
 */

export interface MockConnectorOptions {
  address?: Address;
  chainId?: number;
}

export function mockConnector(options: MockConnectorOptions = {}) {
  const mockAddress = options.address || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat account #0
  const mockChainId = options.chainId || 31337; // Local hardhat chain

  return createConnector((config) => ({
    id: "mock",
    name: "Mock Wallet",
    type: "injected",

    async connect() {
      // Create a mock provider that mimics MetaMask
      const mockProvider = {
        request: async ({ method, params }: any) => {
          switch (method) {
            case "eth_accounts":
              return [mockAddress];
            case "eth_chainId":
              return `0x${mockChainId.toString(16)}`;
            case "eth_requestAccounts":
              return [mockAddress];
            case "personal_sign":
            case "eth_sign":
              return "0x" + "00".repeat(65); // Mock signature
            case "eth_sendTransaction":
              return "0x" + "00".repeat(32); // Mock tx hash
            case "wallet_switchEthereumChain":
              return null;
            default:
              // eslint-disable-next-line no-console
              console.log("[Mock Connector] Unhandled method:", method);
              return null;
          }
        },
        on: () => {},
        removeListener: () => {},
      };

      // Store mock provider on window for E2E access
      if (typeof window !== "undefined") {
        (window as any).ethereum = mockProvider;
      }

      const chainId = mockChainId;
      const accounts = [mockAddress];

      return {
        accounts,
        chainId,
      };
    },

    async disconnect() {
      // Clear mock provider
      if (typeof window !== "undefined") {
        delete (window as any).ethereum;
      }
    },

    async getAccounts() {
      return [mockAddress];
    },

    async getChainId() {
      return mockChainId;
    },

    async getProvider() {
      // Return a viem-compatible provider
      if (typeof window !== "undefined" && (window as any).ethereum) {
        return custom((window as any).ethereum);
      }

      // Create a minimal provider for testing
      const provider = custom({
        request: async ({ method, params }: any) => {
          switch (method) {
            case "eth_accounts":
              return [mockAddress];
            case "eth_chainId":
              return `0x${mockChainId.toString(16)}`;
            default:
              return null;
          }
        },
      });

      return provider;
    },

    async isAuthorized() {
      return true;
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  }));
}
