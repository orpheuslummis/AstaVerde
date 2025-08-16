"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

export default function RawTestPage() {
  const { address } = useAccount();
  const [status, setStatus] = useState("");

  const testRawApprove = async () => {
    if (!address || !window.ethereum) {
      setStatus("No wallet connected");
      return;
    }

    setStatus("Testing raw approve...");

    try {
      // Encode the approve function call
      // Function selector for approve(address,uint256)
      const functionSelector = "0x095ea7b3";
      // Encode spender address (AstaVerde)
      const spender = "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0";
      // Encode amount (1000 USDC = 1000000000 in 6 decimals)
      const amount = "000000000000000000000000000000000000000000000000000000003b9aca00";
      
      const data = functionSelector + spender + amount;

      const txParams = {
        from: address,
        to: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
        data: data,
      };

      console.log("Sending transaction with params:", txParams);

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      setStatus(`Transaction sent: ${txHash}`);
    } catch (error) {
      console.error("Raw approve error:", error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const testEthCall = async () => {
    if (!address) {
      setStatus("No wallet connected");
      return;
    }

    setStatus("Testing eth_call for balanceOf...");

    try {
      // Encode balanceOf(address)
      const functionSelector = "0x70a08231";
      const addressParam = "000000000000000000000000" + address.slice(2).toLowerCase();
      const data = functionSelector + addressParam;

      const result = await window.ethereum.request({
        method: "eth_call",
        params: [{
          to: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
          data: data,
        }, "latest"],
      });

      const balance = parseInt(result, 16) / 1e6;
      setStatus(`Balance: ${balance} USDC`);
    } catch (error) {
      console.error("eth_call error:", error);
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Raw Transaction Test</h1>
      
      <div className="mb-4">
        <p>Connected: {address || "Not connected"}</p>
      </div>

      <div className="flex gap-4 mb-4">
        <button 
          onClick={testEthCall}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Test eth_call (Balance)
        </button>
        
        <button 
          onClick={testRawApprove}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Test Raw Approve
        </button>
      </div>

      <div className="p-4 bg-gray-100 rounded">
        <p>Status: {status}</p>
      </div>
    </div>
  );
}