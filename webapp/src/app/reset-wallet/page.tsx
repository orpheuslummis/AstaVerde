"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

export default function ResetWalletPage() {
  const { address } = useAccount();
  const [status, setStatus] = useState("");

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Fix MetaMask Nonce Issue</h1>
      
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6">
        <p className="font-bold mb-2">⚠️ MetaMask Nonce Out of Sync</p>
        <p className="mb-4">Your MetaMask wallet's transaction count is out of sync with the local Hardhat node.</p>
        
        <p className="font-bold mb-2">To fix this issue:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open MetaMask</li>
          <li>Click on your account icon (top right)</li>
          <li>Go to Settings → Advanced</li>
          <li>Scroll down to "Clear activity tab data"</li>
          <li>Click "Clear" button</li>
          <li>Confirm the action</li>
        </ol>
        
        <p className="mt-4 font-bold">Alternative method:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Open MetaMask</li>
          <li>Click on the network selector (top center)</li>
          <li>Switch to a different network (e.g., Ethereum Mainnet)</li>
          <li>Switch back to Localhost:8545</li>
        </ol>
      </div>

      <div className="bg-blue-100 border-l-4 border-blue-500 p-4">
        <p className="font-bold mb-2">ℹ️ Why does this happen?</p>
        <p>When the Hardhat node restarts, it resets all transaction counts to 0. However, MetaMask remembers the old transaction history. This causes a mismatch where MetaMask tries to use nonce 35 but Hardhat expects nonce 6.</p>
      </div>

      <div className="mt-6">
        <p>Connected wallet: {address || "Not connected"}</p>
      </div>
    </div>
  );
}