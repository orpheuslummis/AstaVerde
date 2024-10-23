"use client";

import { useEffect, useState, useCallback } from "react";
import { IPFS_GATEWAY_URL } from "../../../app.config";
import TokenCard from "../../../components/TokenCard";
import { astaverdeContractConfig } from "../../../lib/contracts";
import { usePublicClient } from "wagmi";
import Loader from "../../../components/Loader";

interface TokenData {
    0: bigint; // Token ID
    1: string; // Producer
    2: string; // CID
    3: boolean; // Is redeemed
}

export default function Page({ params }: { params: { id: bigint } }) {
    const publicClient = usePublicClient();
    const [tokenData, setTokenData] = useState<TokenData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tokenImageUrl, setTokenImageUrl] = useState<string>();

    useEffect(() => {
        async function fetchTokenData() {
            try {
                const data = (await publicClient?.readContract({
                    ...astaverdeContractConfig,
                    functionName: "tokens",
                    args: [params.id],
                })) as TokenData;
                setTokenData(data);
            } catch (err) {
                console.error("Error fetching token data:", err);
                setError("Failed to fetch token data");
            } finally {
                setIsLoading(false);
            }
        }

        fetchTokenData();
    }, [publicClient, params.id]);

    const fetchTokenImageUrl = useCallback(async (tokenCID: string) => {
        try {
            const response = await fetch(`${IPFS_GATEWAY_URL}${tokenCID}`);
            const metadata = await response.json();
            const imageUrl = metadata.image;
            return imageUrl;
        } catch (error) {
            return null;
        }
    }, []);  // Empty dependency array if IPFS_GATEWAY_URL is constant

    useEffect(() => {
        const fetchData = async () => {
            if (tokenData?.[2]) {
                const tokenImageCID = await fetchTokenImageUrl(tokenData[2]);
                if (tokenImageCID) {
                    const parts = tokenImageCID.split("ipfs://");
                    const CID = parts[1];
                    setTokenImageUrl(IPFS_GATEWAY_URL + CID);
                }
            }
        };
        void fetchData();
    }, [tokenData, fetchTokenImageUrl]);

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

    if (!tokenData || tokenData[1] === "0x0000000000000000000000000000000000000000") {
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
                <div className="bg-gray-100 dark:bg-gray-800 p-5 rounded-lg text-gray-700 dark:text-gray-300">
                    Token doesn&apos;t exist
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-4 flex justify-center items-start min-h-[calc(100vh-4rem)]">
            <div className="w-full max-w-2xl">
                <TokenCard
                    tokenId={params.id}
                    isCompact={false}
                    isMyTokensPage={false}
                    isRedeemed={tokenData[3]}
                />
            </div>
        </div>
    );
}
