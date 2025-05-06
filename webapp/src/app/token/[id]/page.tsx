"use client";

import { useEffect, useState, useCallback } from "react";
import TokenCard from "../../../components/TokenCard";
import { astaverdeContractConfig } from "../../../lib/contracts";
import { usePublicClient } from "wagmi";
import Loader from "../../../components/Loader";
import { fetchJsonFromIpfsWithFallback, resolveIpfsUriToUrl } from "../../../utils/ipfsHelper";
import { IPFS_GATEWAY_URL } from "../../../app.config";

interface ContractTokenData {
    0: bigint; // Token ID (matches params.id)
    1: string; // Producer address
    2: string; // Token metadata CID (ipfs://...)
    3: boolean; // Is redeemed
}

interface TokenDisplayData {
    id: bigint;
    producerAddress: string;
    metadataCid: string;
    isRedeemed: boolean;
    name?: string;
    description?: string;
    imageUrl?: string; // This will be the fully resolved URL for the image
}

export default function Page({ params }: { params: { id: bigint } }) {
    const publicClient = usePublicClient();
    const [tokenDisplay, setTokenDisplay] = useState<TokenDisplayData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTokenDetails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTokenDisplay(null);

        if (!publicClient) {
            setError("Blockchain connection not available.");
            setIsLoading(false);
            return;
        }

        try {
            // 1. Fetch basic token data from the contract
            const contractData = (await publicClient.readContract({
                ...astaverdeContractConfig,
                functionName: "tokens",
                args: [params.id],
            })) as ContractTokenData;

            if (!contractData || contractData[1] === "0x0000000000000000000000000000000000000000") {
                throw new Error("Token does not exist or has no owner.");
            }

            const metadataCidUri = contractData[2];
            if (!metadataCidUri || !metadataCidUri.startsWith("ipfs://")) {
                throw new Error("Invalid or non-IPFS metadata CID URI from contract.");
            }

            // 2. Fetch metadata from IPFS with fallback
            const metadataResult = await fetchJsonFromIpfsWithFallback(metadataCidUri);

            if (!metadataResult || !metadataResult.data) {
                throw new Error(`Failed to load metadata from ${metadataCidUri} using any gateway.`);
            }

            const metadata = metadataResult.data;
            let resolvedImageUrl;
            if (metadata.image) {
                // Use the gateway that successfully fetched the metadata to resolve the image URI
                resolvedImageUrl = resolveIpfsUriToUrl(metadata.image, metadataResult.gateway);
            }

            setTokenDisplay({
                id: params.id,
                producerAddress: contractData[1],
                metadataCid: metadataCidUri,
                isRedeemed: contractData[3],
                name: metadata.name,
                description: metadata.description,
                imageUrl: resolvedImageUrl,
            });

        } catch (err: any) {
            console.error(`Error fetching token ${params.id} details:`, err);
            setError(err.message || "Failed to fetch token details.");
        } finally {
            setIsLoading(false);
        }
    }, [publicClient, params.id]);

    useEffect(() => {
        void loadTokenDetails();
    }, [loadTokenDetails]);

    if (isLoading) {
        return <Loader message={`Loading token ${params.id}...`} />;
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-4 flex justify-center items-center min-h-[calc(100vh-4rem)]">
                <p className="text-red-500 dark:text-red-400">Error: {error}</p>
            </div>
        );
    }

    if (!tokenDisplay) { // Should be caught by isLoading or error, but as a safeguard
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
                <p className="text-gray-500 dark:text-gray-400">Token data not available.</p>
            </div>
        );
    }

    // For the TokenCard component, we can pass tokenId, isRedeemed directly.
    // TokenCard itself will re-fetch metadata using its own fallback logic for display consistency
    // or you could pass all resolved data if you prefer TokenCard to be purely presentational here.
    // For simplicity and to reuse TokenCard's internal fetching for its own display purposes:
    return (
        <div className="container mx-auto px-4 py-4 flex flex-col items-center min-h-[calc(100vh-4rem)]">
            <h1 className="text-3xl font-bold mb-6 dark:text-white">Token Details</h1>
            {/* Option 1: Let TokenCard do its own full fetching for its display parts */}
            <div className="w-full max-w-md mb-8">
                <TokenCard tokenId={tokenDisplay.id} isRedeemed={tokenDisplay.isRedeemed} isCompact={false} />
            </div>

            {/* Option 2: Display some already resolved details from this page's fetch */}
            {/* You can choose to show more details here directly from tokenDisplay if needed */}
            <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
                <h2 className="text-2xl font-semibold mb-2 dark:text-gray-100">{tokenDisplay.name || `Token ID: ${tokenDisplay.id}`}</h2>
                {tokenDisplay.imageUrl && (
                    <img
                        src={tokenDisplay.imageUrl}
                        alt={tokenDisplay.name || `Image for token ${tokenDisplay.id}`}
                        className="w-full h-auto object-contain rounded-md mb-4 max-h-96"
                    />
                )}
                <p className="text-gray-700 dark:text-gray-300 mb-1">
                    <span className="font-semibold">Description:</span> {tokenDisplay.description || "No description available."}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-1 break-all">
                    <span className="font-semibold">Producer:</span> {tokenDisplay.producerAddress}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-1 break-all">
                    <span className="font-semibold">Metadata CID:</span> {tokenDisplay.metadataCid}
                </p>
                <p className={`text-lg font-semibold ${tokenDisplay.isRedeemed ? 'text-red-500' : 'text-emerald-500'}`}>
                    {tokenDisplay.isRedeemed ? "Status: Redeemed" : "Status: Not Redeemed"}
                </p>
            </div>
        </div>
    );
}
