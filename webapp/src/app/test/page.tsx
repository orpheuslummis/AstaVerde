"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { getAstaVerdeContract, getUsdcContract } from "../../config/contracts";
import DevOnly from "../../components/DevOnly";
import { getErrorMessage } from "../../shared/utils/error";

// Minimal ERC20 ABI
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export default function TestPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState("");
  const [balance, setBalance] = useState("");
  const [allowance, setAllowance] = useState("");

  const checkBalance = async () => {
    if (!publicClient || !address) return;

    try {
      const bal = await publicClient.readContract({
        address: getUsdcContract().address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      setBalance(formatUnits(bal as bigint, 6));
      setStatus(`Balance: ${formatUnits(bal as bigint, 6)} USDC`);
    } catch (error) {
      setStatus(`Error: ${getErrorMessage(error)}`);
    }
  };

  const checkAllowance = async () => {
    if (!publicClient || !address) return;

    try {
      const allow = await publicClient.readContract({
        address: getUsdcContract().address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, getAstaVerdeContract().address],
      });
      setAllowance(formatUnits(allow as bigint, 6));
      setStatus(`Allowance: ${formatUnits(allow as bigint, 6)} USDC`);
    } catch (error) {
      setStatus(`Error: ${getErrorMessage(error)}`);
    }
  };

  const testApprove = async () => {
    if (!walletClient || !address) return;

    setStatus("Approving...");

    try {
      const amount = parseUnits("1000", 6);

      const hash = await walletClient.writeContract({
        address: getUsdcContract().address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [getAstaVerdeContract().address, amount],
        account: address,
      });

      setStatus(`Transaction sent: ${hash}`);

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`Success! Block: ${receipt.blockNumber}`);
        checkAllowance();
      }
      } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Approve error:", error);
      setStatus(`Error: ${getErrorMessage(error)}`);
    }
  };

  return (
    <DevOnly>
      <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Contract Test Page</h1>

      <div className="mb-4">
        <p>Connected: {address || "Not connected"}</p>
        <p>USDC Address: {getUsdcContract().address}</p>
        <p>AstaVerde Address: {getAstaVerdeContract().address}</p>
      </div>

      <div className="mb-4">
        <p>Balance: {balance || "Not checked"}</p>
        <p>Allowance: {allowance || "Not checked"}</p>
      </div>

      <div className="flex gap-4 mb-4">
        <button
          onClick={checkBalance}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Check Balance
        </button>

        <button
          onClick={checkAllowance}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Check Allowance
        </button>

        <button
          onClick={testApprove}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Test Approve (1000 USDC)
        </button>
      </div>

      <div className="p-4 bg-gray-100 rounded">
        <p>Status: {status}</p>
      </div>
      </div>
    </DevOnly>
  );
}
