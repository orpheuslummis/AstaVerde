"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import ecoStabilizerAbi from "../../config/EcoStabilizer.json";
import astaVerdeAbi from "../../config/AstaVerde.json";
import { getEcoStabilizerContract, getAstaVerdeContract } from "../../config/contracts";
import DevOnly from "../../components/DevOnly";
import { getErrorMessage, getErrorCause } from "../../shared/utils/error";
import { useRateLimitedPublicClient } from "@/hooks/useRateLimitedPublicClient";

export default function TestVaultPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = useRateLimitedPublicClient();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const checkApproval = async () => {
    if (!publicClient || !address) return;

    addLog("Checking NFT approval for vault...");

    try {
      const isApproved = await publicClient.readContract({
        address: getAstaVerdeContract().address,
        abi: astaVerdeAbi.abi,
        functionName: "isApprovedForAll",
        args: [address, getEcoStabilizerContract().address],
      });

      addLog(`NFT approval status: ${isApproved ? "✅ Approved" : "❌ Not approved"}`);
      return isApproved;
    } catch (error) {
      addLog(`Error checking approval: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const approveVault = async () => {
    if (!walletClient || !address) return;

    addLog("Approving vault for NFTs...");

    try {
      const hash = await walletClient.writeContract({
        address: getAstaVerdeContract().address,
        abi: astaVerdeAbi.abi,
        functionName: "setApprovalForAll",
        args: [getEcoStabilizerContract().address, true],
        account: address,
      });

      addLog(`Approval tx sent: ${hash}`);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        addLog(`✅ Approval confirmed in block ${receipt.blockNumber}`);
      }
    } catch (error) {
      addLog(`❌ Approval error: ${getErrorMessage(error)}`);
    }
  };

  const checkBalance = async () => {
    if (!publicClient || !address) return;

    addLog("Checking NFT balances...");

    try {
      for (let tokenId = 1; tokenId <= 3; tokenId++) {
        const balance = await publicClient.readContract({
          address: getAstaVerdeContract().address,
          abi: astaVerdeAbi.abi,
          functionName: "balanceOf",
          args: [address, BigInt(tokenId)],
        }) as bigint;

        if (balance > 0n) {
          addLog(`Token #${tokenId}: ${balance} owned`);
        }
      }
    } catch (error) {
      addLog(`Error checking balance: ${getErrorMessage(error)}`);
    }
  };

  const depositToken = async (tokenId: number) => {
    if (!walletClient || !publicClient || !address) return;

    addLog(`Attempting to deposit token #${tokenId}...`);

    // First check if approved
    const isApproved = await checkApproval();
    if (!isApproved) {
      addLog("Need to approve vault first!");
      await approveVault();
    }

    try {
      addLog(`Calling vault.deposit(${tokenId})...`);

      const hash = await walletClient.writeContract({
        address: getEcoStabilizerContract().address,
        abi: ecoStabilizerAbi.abi,
        functionName: "deposit",
        args: [BigInt(tokenId)],
        account: address,
      });

      addLog(`Deposit tx sent: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      addLog(`✅ Deposit confirmed in block ${receipt.blockNumber}`);
      addLog("Successfully deposited! You should have received 20 SCC.");

    } catch (error) {
      addLog(`❌ Deposit error: ${getErrorMessage(error)}`);
      const cause = getErrorCause(error);
      if (cause) addLog(`Cause: ${JSON.stringify(cause)}`);
    }
  };

  return (
    <DevOnly>
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Test Vault Operations</h1>

        <div className="mb-4">
          <p>Wallet: {address || "Not connected"}</p>
          <p>Vault: {getEcoStabilizerContract().address}</p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={checkBalance}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
          Check NFT Balance
          </button>

          <button
            onClick={checkApproval}
            className="px-4 py-2 bg-yellow-500 text-white rounded"
          >
          Check Approval
          </button>

          <button
            onClick={approveVault}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
          Approve Vault
          </button>

          <button
            onClick={() => depositToken(2)}
            className="px-4 py-2 bg-purple-500 text-white rounded"
          >
          Deposit Token #2
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Logs:</h2>
          <div className="font-mono text-sm max-h-96 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>
    </DevOnly>
  );
}
