"use client";

import { useEffect, useState, useMemo } from "react";
import { usePublicClient } from "wagmi";
import Image from "next/image";
import BatchInfo from "../../../components/BatchInfo";
import TokenCard from "../../../components/TokenCard";
import { useAppContext } from "../../../contexts/AppContext";
import { getPlaceholderImageUrl } from "../../../utils/placeholderImage";

export default function Page({ params }: { params: { id: string } }) {
    const [batchData, setBatchData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { astaverdeContractConfig } = useAppContext();
    const publicClient = usePublicClient();

    const placeholderImage = useMemo(() => {
        return getPlaceholderImageUrl(
            params.id,
            batchData ? batchData[1].length.toString() : "0"
        );
    }, [params.id, batchData]);

    useEffect(() => {
        const fetchBatchData = async () => {
            if (typeof params.id !== "string") {
                setError("Invalid batch ID");
                setIsLoading(false);
                return;
            }

            if (!publicClient) {
                setError("Public client not available");
                setIsLoading(false);
                return;
            }

            try {
                const batchInfo = await publicClient.readContract({
                    ...astaverdeContractConfig,
                    functionName: "getBatchInfo",
                    args: [BigInt(params.id)],
                });
                console.log("Batch info from contract:", batchInfo);
                setBatchData(batchInfo);
                setIsLoading(false);
            } catch (err) {
                console.error("Error fetching batch data:", err);
                setError("Failed to fetch batch data");
                setIsLoading(false);
            }
        };

        fetchBatchData();
    }, [params.id, publicClient, astaverdeContractConfig]);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!batchData) return <div>No batch data available.</div>;

    const [, tokenIds, creationTime, price, remainingTokens] = batchData;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
                <div className="flex items-center p-6">
                    <div className="relative w-24 h-24 mr-6">
                        <Image
                            src={placeholderImage}
                            alt={`Batch ${params.id}`}
                            fill
                            className="rounded-lg object-cover"
                        />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Batch {params.id}</h1>
                        <BatchInfo batchData={batchData} />
                    </div>
                </div>
            </div>
            <h2 className="text-2xl font-semibold mb-4">Tokens in this Batch</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {tokenIds && tokenIds.length > 0 ? (
                    tokenIds.map((tokenId: bigint) => (
                        <TokenCard 
                            key={tokenId.toString()} 
                            tokenId={tokenId} 
                            isCompact={false} // Changed to false to show full info
                        />
                    ))
                ) : (
                    <p>No tokens available for this batch.</p>
                )}
            </div>
        </div>
    );
}
