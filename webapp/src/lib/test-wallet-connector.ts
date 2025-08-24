/**
 * Test Wallet Connector
 * A custom wagmi connector that works for E2E tests
 */

import { createConnector } from "wagmi";
import { ethers } from "ethers";

export function testWalletConnector() {
  // Only enable in test mode
  if (
    !process.env.NEXT_PUBLIC_TEST_MODE &&
        typeof window !== "undefined" &&
        !window.location.search.includes("testMode=true")
  ) {
    return null;
  }

  return createConnector((config) => ({
    id: "test-wallet",
    name: "Test Wallet",
    type: "injected",

    async connect() {
      const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

      // Actually execute transactions on real blockchain
      const provider = new ethers.JsonRpcProvider("http://localhost:8545");
      const signer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider,
      );

      // Store signer for transaction execution
      (window as any).__testSigner = signer;

      return {
        accounts: [address],
        chainId: 31337,
      };
    },

    async disconnect() {
      delete (window as any).__testSigner;
    },

    async getAccount() {
      return "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    },

    async getAccounts() {
      return ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"];
    },

    async getChainId() {
      return 31337;
    },

    async isAuthorized() {
      return true;
    },

    async switchChain({ chainId }) {
      if (chainId !== 31337) throw new Error("Test wallet only works on localhost");
      return { id: 31337, name: "Localhost" } as any;
    },

    async getProvider() {
      // Return a provider that actually executes transactions
      return {
        request: async ({ method, params }: any) => {
          // eslint-disable-next-line no-console
          console.log("[TestWallet]", method, params);

          const signer = (window as any).__testSigner;
          if (!signer) throw new Error("Test signer not initialized");

          switch (method) {
          case "eth_sendTransaction": {
            // Actually send the transaction
            const tx = params[0];
            const realTx = await signer.sendTransaction({
              to: tx.to,
              data: tx.data,
              value: tx.value || 0,
            });

            // Return real transaction hash
            return realTx.hash;
          }

          case "eth_call": {
            // Forward to real provider
            const provider = signer.provider;
            return await provider.call(params[0]);
          }

          case "eth_getTransactionReceipt": {
            // Get real receipt
            const provider = signer.provider;
            return await provider.getTransactionReceipt(params[0]);
          }

          default:
            // Handle other methods
            return null;
          }
        },
      };
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  }));
}
