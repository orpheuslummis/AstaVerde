"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";

const USDC_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e" as const;
const ASTAVERDE_ADDRESS = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0" as const;


export default function SimpleApprovePage() {
  const { address } = useAccount();
  const [status, setStatus] = useState("");

  const testApprove = async () => {
    if (!address || !window.ethereum) {
      setStatus("No wallet connected");
      return;
    }

    setStatus("Starting approve...");

    try {
      // Build the transaction manually
      const amount = parseUnits("100", 6);

      // Encode the function call
      const functionSelector = "0x095ea7b3";
      const spenderPadded = ASTAVERDE_ADDRESS.slice(2).padStart(64, "0");
      const amountPadded = amount.toString(16).padStart(64, "0");
      const data = functionSelector + spenderPadded + amountPadded;

      console.log("Transaction data:", {
        to: USDC_ADDRESS,
        from: address,
        data: data,
      });

      // Send the transaction directly
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: USDC_ADDRESS,
          data: data,
          gas: "0x30000", // 196608 in decimal
        }],
      });

      setStatus(`Transaction sent: ${txHash}`);

      // Wait for confirmation
      let receipt = null;
      let attempts = 0;
      while (!receipt && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });
        attempts++;
      }

      if (receipt) {
        setStatus(`Success! Block: ${parseInt(receipt.blockNumber, 16)}`);
      } else {
        setStatus("Transaction pending...");
      }

    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${error.message || error.toString()}`);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Approve Test</h1>

      <div className="mb-4">
        <p>Wallet: {address || "Not connected"}</p>
        <p>USDC: {USDC_ADDRESS}</p>
        <p>Spender: {ASTAVERDE_ADDRESS}</p>
      </div>

      <button
        onClick={testApprove}
        className="px-4 py-2 bg-green-500 text-white rounded mb-4"
        disabled={!address}
      >
        Test Direct Approve
      </button>

      <div className="bg-gray-100 p-4 rounded">
        <p>Status: {status}</p>
      </div>
    </div>
  );
}
