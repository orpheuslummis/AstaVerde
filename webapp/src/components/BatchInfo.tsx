"use client";

import { formatUnits } from "viem";
import { useReadContract } from "wagmi";
import { USDC_DECIMALS } from "../app.config";
import { astaverdeContractConfig } from "../lib/contracts";

interface BatchInfoProps {
    batchID: bigint;
}

export default function BatchInfo({ batchID }: BatchInfoProps) {
    const { data: batchData, isError, isLoading, error } = useReadContract({
        ...astaverdeContractConfig,
        functionName: 'getBatchInfo',
        args: [batchID] as const,
    });

    const renderContent = (data: any) => {
        if (!data) return null;
        const [batchId, tokenIds, creationTime, price, remainingTokens] = data;
        return (
            <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                <div className="mb-4">
                    <span className="font-bold">Batch ID:</span> {batchId.toString()}
                </div>
                <div className="mb-4">
                    <span className="font-bold">Token IDs:</span> {tokenIds.map(id => id.toString()).join(", ")}
                </div>
                <div className="mb-4">
                    <span className="font-bold">Creation Time:</span> {new Date(Number(creationTime) * 1000).toLocaleString()}
                </div>
                <div className="mb-4">
                    <span className="font-bold">Price:</span> {formatUnits(price, USDC_DECIMALS)} USDC
                </div>
                <div className="mb-4">
                    <span className="font-bold">Remaining Tokens:</span> {remainingTokens.toString()}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4">{`Batch Information for ID: ${batchID.toString()}`}</h2>
            {isLoading ? (
                <p className="text-gray-600">Loading...</p>
            ) : isError ? (
                <p className="text-red-500">Error: {error?.message}</p>
            ) : (
                renderContent(batchData)
            )}
        </div>
    );
}