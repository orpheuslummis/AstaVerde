"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import mockUsdcAbi from "../../config/MockUSDC.json";
import { getAstaVerdeContract, getUsdcContract } from "../../config/contracts";
import DevOnly from "../../components/DevOnly";
import { getErrorMessage, getErrorCause } from "../../shared/utils/error";

export default function DebugApprovePage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    if (!address) return;
    addLog(`Connected wallet: ${address}`);
  }, [address]);

  const testApprove = async () => {
    if (!walletClient || !publicClient || !address) {
      addLog("Missing wallet or client");
      return;
    }

    addLog("Starting approve test...");

    try {
      // First check balance
      addLog("Checking balance...");
      const balanceResult = await publicClient.readContract({
        address: getUsdcContract().address,
        abi: mockUsdcAbi.abi,
        functionName: "balanceOf",
        args: [address],
      });
      addLog(`Balance: ${balanceResult} (raw)`);

      // Check current allowance
      addLog("Checking current allowance...");
      const allowanceResult = await publicClient.readContract({
        address: getUsdcContract().address,
        abi: mockUsdcAbi.abi,
        functionName: "allowance",
        args: [address, getAstaVerdeContract().address],
      });
      addLog(`Current allowance: ${allowanceResult} (raw)`);

      // Try to approve
      addLog("Attempting approve transaction...");
      const amount = parseUnits("100", 6);
      addLog(`Amount to approve: ${amount} (100 USDC in wei)`);

      // Log the exact parameters
      addLog(`Contract address: ${getUsdcContract().address}`);
      addLog(`Spender address: ${getAstaVerdeContract().address}`);
      addLog(`From address: ${address}`);
      addLog(`ABI has ${mockUsdcAbi.abi.length} functions`);

      const hash = await walletClient.writeContract({
        address: getUsdcContract().address,
        abi: mockUsdcAbi.abi,
        functionName: "approve",
        args: [getAstaVerdeContract().address, amount],
        account: address,
      });

      addLog(`Transaction sent! Hash: ${hash}`);

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      addLog(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Check new allowance
      const newAllowance = await publicClient.readContract({
        address: getUsdcContract().address,
        abi: mockUsdcAbi.abi,
        functionName: "allowance",
        args: [address, getAstaVerdeContract().address],
      });
      addLog(`New allowance: ${newAllowance} (raw)`);

    } catch (error) {
      addLog(`ERROR: ${getErrorMessage(error)}`);
      const cause = getErrorCause(error);
      if (cause) addLog(`Cause: ${JSON.stringify(cause)}`);
      // eslint-disable-next-line no-console
      console.error("Full error:", error);
    }
  };

  return (
    <DevOnly>
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Debug Approve Transaction</h1>

        <div className="mb-4">
          <p>Wallet: {address || "Not connected"}</p>
          <p>USDC: {getUsdcContract().address}</p>
          <p>AstaVerde: {getAstaVerdeContract().address}</p>
        </div>

        <button
          onClick={testApprove}
          className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
          disabled={!walletClient}
        >
        Test Approve
        </button>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Logs:</h2>
          <div className="font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>
    </DevOnly>
  );
}
