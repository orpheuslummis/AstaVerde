"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import ecoStabilizerAbi from "../../config/EcoStabilizer.json";
import astaVerdeAbi from "../../config/AstaVerde.json";

const VAULT_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508" as const;
const ASTAVERDE_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0" as const;

export default function TestVaultPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const checkApproval = async () => {
    if (!publicClient || !address) return;

    addLog("Checking NFT approval for vault...");

    try {
      const isApproved = await publicClient.readContract({
        address: ASTAVERDE_ADDRESS,
        abi: astaVerdeAbi.abi,
        functionName: "isApprovedForAll",
        args: [address, VAULT_ADDRESS],
      });

      addLog(`NFT approval status: ${isApproved ? "✅ Approved" : "❌ Not approved"}`);
      return isApproved;
    } catch (error) {
      addLog(`Error checking approval: ${error.message}`);
      return false;
    }
  };

  const approveVault = async () => {
    if (!walletClient || !address) return;

    addLog("Approving vault for NFTs...");

    try {
      const hash = await walletClient.writeContract({
        address: ASTAVERDE_ADDRESS,
        abi: astaVerdeAbi.abi,
        functionName: "setApprovalForAll",
        args: [VAULT_ADDRESS, true],
        account: address,
      });

      addLog(`Approval tx sent: ${hash}`);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        addLog(`✅ Approval confirmed in block ${receipt.blockNumber}`);
      }
    } catch (error) {
      addLog(`❌ Approval error: ${error.message}`);
    }
  };

  const checkBalance = async () => {
    if (!publicClient || !address) return;

    addLog("Checking NFT balances...");

    try {
      for (let tokenId = 1; tokenId <= 3; tokenId++) {
        const balance = await publicClient.readContract({
          address: ASTAVERDE_ADDRESS,
          abi: astaVerdeAbi.abi,
          functionName: "balanceOf",
          args: [address, BigInt(tokenId)],
        }) as bigint;

        if (balance > 0n) {
          addLog(`Token #${tokenId}: ${balance} owned`);
        }
      }
    } catch (error) {
      addLog(`Error checking balance: ${error.message}`);
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
        address: VAULT_ADDRESS,
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
      addLog(`❌ Deposit error: ${error.message}`);
      if (error.cause) {
        addLog(`Cause: ${JSON.stringify(error.cause)}`);
      }
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Test Vault Operations</h1>

      <div className="mb-4">
        <p>Wallet: {address || "Not connected"}</p>
        <p>Vault: {VAULT_ADDRESS}</p>
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
  );
}
