/**
 * Test Mode Support
 * Provides mock wallet functionality when in test mode
 */

export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.location.search.includes("testMode=true") ||
    localStorage.getItem("e2e-testing") === "true" ||
    (window as any).__PLAYWRIGHT_TEST__ === true
  );
}

export function getTestWalletAddress(): string {
  return "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
}

export function mockWalletConnect() {
  if (!isTestMode()) return null;

  // Return mock connection data
  return {
    address: getTestWalletAddress(),
    chainId: 31337,
    isConnected: true,
  };
}

export function mockTransaction(tx: any) {
  if (!isTestMode()) return null;

  // eslint-disable-next-line no-console
  console.log("[TestMode] Mock transaction:", tx);

  // Return mock transaction hash
  return {
    hash:
      "0x" +
      Array(64)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join(""),
    wait: async () => ({
      status: 1,
      blockNumber: Math.floor(Math.random() * 1000000),
    }),
  };
}
