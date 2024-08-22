"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { USDC_DECIMALS } from "../../app.config";
import { AppProvider, useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { astaverdeContractConfig, getUsdcContractConfig } from "../../lib/contracts";
import { customToast } from "../../utils/customToast";

function Page() {
    const { address, isConnected } = useAccount();
    const { adminControls } = useAppContext();
    const [producers, setProducers] = useState<string[]>([""]);
    const [cids, setCids] = useState<string[]>([""]);

    const usdcContractConfig = getUsdcContractConfig();
    const { data: usdcBalance } = useBalance({
        address,
        token: usdcContractConfig.address,
    });

    const { execute: approveUSDC } = useContractInteraction(usdcContractConfig, "approve");
    const { execute: mintUSDC } = useContractInteraction(usdcContractConfig, "mint");

    const handleMintUSDC = async () => {
        if (!address) return;
        try {
            const amount = parseUnits("10000", USDC_DECIMALS);
            await mintUSDC(address, amount);
            customToast.success("Successfully minted 10000 USDC");
        } catch (error) {
            console.error("Error minting USDC:", error);
            customToast.error("Failed to mint USDC");
        }
    };

    const handleApproveUSDC = async () => {
        if (!address) return;
        try {
            const amount = parseUnits("10000", USDC_DECIMALS);
            await approveUSDC(astaverdeContractConfig.address, amount);
            customToast.success("Successfully approved USDC");
        } catch (error) {
            console.error("Error approving USDC:", error);
            customToast.error("Failed to approve USDC");
        }
    };

    const handleMintBatch = async () => {
        try {
            await adminControls.mintBatch(producers, cids);
            customToast.success("Successfully minted new batch");
            // Reset the form after successful minting
            setProducers([""]);
            setCids([""]);
        } catch (error) {
            console.error("Error minting batch:", error);
            customToast.error("Failed to mint batch");
        }
    };

    const addProducerCid = () => {
        setProducers([...producers, ""]);
        setCids([...cids, ""]);
    };

    const updateProducer = (index: number, value: string) => {
        const newProducers = [...producers];
        newProducers[index] = value;
        setProducers(newProducers);
    };

    const updateCid = (index: number, value: string) => {
        const newCids = [...cids];
        newCids[index] = value;
        setCids(newCids);
    };

    return (
        <div className="flex flex-col items-center space-y-8 p-4">
            <h1 className="text-3xl font-bold mb-4">AstaVerde Test Minting Page</h1>

            {isConnected ? (
                <div className="flex flex-col items-center space-y-2">
                    <p>Connected Address: {address}</p>
                    <p>
                        Your USDC Balance: {usdcBalance ? parseFloat(usdcBalance.formatted).toFixed(2) : "Loading..."}{" "}
                        USDC
                    </p>
                </div>
            ) : (
                <p>Please connect your wallet to use this page.</p>
            )}

            <div className="w-full max-w-md space-y-4">
                <h2 className="text-2xl font-semibold">USDC Operations</h2>
                <button
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleMintUSDC}
                    disabled={!address}
                >
                    Mint 10000 Test USDC
                </button>

                <button
                    className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleApproveUSDC}
                    disabled={!address}
                >
                    Approve USDC for AstaVerde
                </button>
            </div>

            <div className="w-full max-w-md space-y-4">
                <h2 className="text-2xl font-semibold">Mint New Batch</h2>
                {producers.map((producer, index) => (
                    <div key={index} className="flex space-x-2 mb-2">
                        <input
                            type="text"
                            placeholder="Producer Address"
                            value={producer}
                            onChange={(e) => updateProducer(index, e.target.value)}
                            className="border rounded px-2 py-1 w-1/2"
                        />
                        <input
                            type="text"
                            placeholder="CID"
                            value={cids[index]}
                            onChange={(e) => updateCid(index, e.target.value)}
                            className="border rounded px-2 py-1 w-1/2"
                        />
                    </div>
                ))}
                <div className="flex space-x-2">
                    <button
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex-grow"
                        onClick={addProducerCid}
                    >
                        Add Producer/CID
                    </button>
                    <button
                        className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded flex-grow"
                        onClick={handleMintBatch}
                        disabled={producers.some((p) => !p) || cids.some((c) => !c)}
                    >
                        Mint New Batch
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TestMintPage() {
    return (
        <AppProvider>
            <Page />
        </AppProvider>
    );
}
