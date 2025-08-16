"use client";

import { useEffect, useState, useCallback } from "react";
import { astaverdeContractConfig } from "../../../lib/contracts";
import { usePublicClient } from "wagmi";
import Loader from "../../../components/Loader";
import { fetchJsonFromIpfsWithFallback, resolveIpfsUriToUrl } from "../../../utils/ipfsHelper";

// Helper to stringify BigInt values for logging
function bigIntReplacer(key: string, value: unknown) {
    if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Suffix with 'n' to denote BigInt in logs
    }
    return value;
}

// This interface now correctly reflects the tuple returned by the public `tokens` getter
// Order: owner, tokenId, producer, cid, redeemed
interface ContractTokenDataTuple extends Array<unknown> {
    0: string;  // owner
    1: bigint;  // tokenId
    2: string;  // producer
    3: string;  // cid (this is just the hash, not the full ipfs:// URI)
    4: boolean; // redeemed
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
            console.log(`Fetching token data for ID: ${params.id} using contract: ${astaverdeContractConfig.address}`);
            const contractData = (await publicClient.readContract({
                ...astaverdeContractConfig,
                functionName: "tokens",
                args: [params.id],
            })) as ContractTokenDataTuple; // Use the updated interface

            console.log("Raw tokenContractData from contract:", JSON.stringify(contractData, bigIntReplacer));

            // Check based on producer address, as tokenId might be 0 if not minted but owner is set
            if (!contractData || contractData[2] === "0x0000000000000000000000000000000000000000") {
                // Assuming producer address (index 2) being zero address means token doesn't exist or is invalid.
                // contractData[0] is owner, contractData[1] is tokenId.
                // For a non-existent token, the getter usually returns default zero values for all fields.
                // If tokenId (contractData[1]) is 0, it indicates it's not a valid/minted token.
                // Or if owner (contractData[0]) is zero address.
                // A more robust check might involve checking if tokenId is 0 (contractData[1] === 0n)
                throw new Error("Token does not exist or has no valid producer.");
            }

            const rawCid = contractData[3]; // CID is at index 3
            console.log("Extracted rawCid:", rawCid);
            console.log("Type of rawCid:", typeof rawCid);

            if (!rawCid || typeof rawCid !== 'string' || rawCid.trim() === "") {
                console.error("Detailed check failed. rawCid is invalid:", rawCid, "Type:", typeof rawCid);
                throw new Error(
                    "Invalid or empty CID string from contract.",
                );
            }

            const metadataCidUri = `ipfs://${rawCid}`; // Prepend ipfs://
            console.log("Constructed metadataCidUri:", metadataCidUri);

            // The check for startsWith "ipfs://" is now implicitly handled by the construction above.
            // We rely on fetchJsonFromIpfsWithFallback to handle it.

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
                id: params.id, // or contractData[1] which should be the same
                producerAddress: contractData[2], // Producer is at index 2
                metadataCid: metadataCidUri, // Use the full URI
                isRedeemed: contractData[4], // Redeemed is at index 4
                name: metadata.name,
                description: metadata.description,
                imageUrl: resolvedImageUrl,
            });

        } catch (err) {
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
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Token Details
            </h1>
            
            {/* Display resolved token details */}
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden">
                {/* Image Section */}
                <div className="relative bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 p-8">
                    {tokenDisplay.imageUrl ? (
                        <img
                            src={tokenDisplay.imageUrl}
                            alt={tokenDisplay.name || `Image for token ${tokenDisplay.id}`}
                            className="w-full h-auto object-contain max-h-96 rounded-xl shadow-lg mx-auto"
                        />
                    ) : (
                        <div className="w-full h-96 flex items-center justify-center bg-gradient-to-br from-purple-400 to-blue-400 rounded-xl shadow-lg">
                            <div className="text-white text-center">
                                <svg className="w-24 h-24 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-lg font-medium">No Image Available</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="p-8">
                    {/* Title and Status Badge */}
                    <div className="flex items-start justify-between mb-6">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {tokenDisplay.name || `Carbon Offset #${tokenDisplay.id}`}
                        </h2>
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                            tokenDisplay.isRedeemed 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                            {tokenDisplay.isRedeemed ? '✓ Redeemed' : '● Active'}
                        </span>
                    </div>

                    {/* Description */}
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                        {tokenDisplay.description || "Test carbon offset NFT for local development. This represents verified carbon credits from renewable energy projects."}
                    </p>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Producer Card */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                            <div className="flex items-center mb-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Producer
                                </h3>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-200 font-mono break-all">
                                {tokenDisplay.producerAddress}
                            </p>
                        </div>

                        {/* Metadata Card */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                            <div className="flex items-center mb-2">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Metadata CID
                                </h3>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-gray-200 font-mono break-all">
                                {tokenDisplay.metadataCid}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 flex gap-4">
                        <button
                            onClick={() => window.history.back()}
                            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-colors duration-200"
                        >
                            ← Back
                        </button>
                        <a
                            href={`https://ipfs.io/ipfs/${tokenDisplay.metadataCid.replace('ipfs://', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-200 text-center shadow-lg hover:shadow-xl"
                        >
                            View on IPFS →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
