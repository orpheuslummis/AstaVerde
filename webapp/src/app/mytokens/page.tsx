"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TokenCard from "../../components/TokenCard";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import RedeemTokensButton from "./RedeemTokensButton";

const TOKENS_PER_PAGE = 12;

export default function MyTokensPage() {
    const { address } = useAccount();
    const [tokens, setTokens] = useState<bigint[]>([]);
    const [redeemStatus, setRedeemStatus] = useState<Record<string, boolean>>({});
    const [selectedTokens, setSelectedTokens] = useState<Set<bigint>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { astaverdeContractConfig } = useAppContext();
    const { execute: getTokensOfOwner } = useContractInteraction(astaverdeContractConfig, "balanceOf");
    const { execute: getTokenInfo } = useContractInteraction(astaverdeContractConfig, "tokens");
    const { execute: getLastTokenID } = useContractInteraction(astaverdeContractConfig, "lastTokenID");

    const fetchTokens = useCallback(async () => {
        if (!address) return;
        try {
            setIsLoading(true);
            const lastTokenID = await getLastTokenID();
            console.log("Last Token ID:", lastTokenID);
            if (lastTokenID === undefined || lastTokenID === null) {
                throw new Error("Failed to fetch last token ID: Received undefined or null");
            }
            const lastTokenIDNumber = typeof lastTokenID === "bigint" ? Number(lastTokenID) : Number(lastTokenID);
            const userTokens = [];
            for (let i = 1; i <= lastTokenIDNumber; i++) {
                const balance = await getTokensOfOwner(address, BigInt(i));
                console.log(`Token ${i} balance:`, balance);
                if (balance && balance > 0n) {
                    userTokens.push(i);
                }
            }
            console.log("User Tokens:", userTokens);
            const bigintTokens = userTokens.map(BigInt);
            setTokens(bigintTokens);

            const status: Record<string, boolean> = {};
            for (const tokenId of bigintTokens) {
                const tokenInfo = await getTokenInfo(tokenId);
                console.log(`Token ${tokenId} info:`, tokenInfo);
                status[tokenId.toString()] = tokenInfo[3]; // isRedeemed is the fourth element
            }
            setRedeemStatus(status);
        } catch (error) {
            console.error("Error fetching tokens:", error);
            if (error instanceof Error) {
                setError(`Failed to fetch tokens: ${error.message}`);
            } else {
                setError("An unknown error occurred while fetching tokens");
            }
        } finally {
            setIsLoading(false);
        }
    }, [address, getTokensOfOwner, getTokenInfo, getLastTokenID]);

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    const handleTokenSelect = (tokenId: bigint) => {
        setSelectedTokens((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(tokenId)) {
                newSet.delete(tokenId);
            } else {
                newSet.add(tokenId);
            }
            return newSet;
        });
    };

    const handleRedeemComplete = useCallback(() => {
        fetchTokens();
        setSelectedTokens(new Set());
    }, [fetchTokens]);

    const currentTokens = tokens.slice((currentPage - 1) * TOKENS_PER_PAGE, currentPage * TOKENS_PER_PAGE);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">My Tokens</h1>
            {isLoading ? (
                <p>Loading your tokens...</p>
            ) : error ? (
                <p className="text-red-500">{error}</p>
            ) : tokens.length === 0 ? (
                <p>You don't have any tokens yet.</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {currentTokens.map((tokenId) => (
                            <TokenCard
                                key={tokenId.toString()}
                                tokenId={tokenId}
                                isMyTokensPage={true}
                                isRedeemed={redeemStatus[tokenId.toString()]}
                                isSelected={selectedTokens.has(tokenId)}
                                onSelect={handleTokenSelect}
                            />
                        ))}
                    </div>
                    <div className="mt-8 flex justify-between items-center">
                        <RedeemTokensButton
                            selectedTokens={Array.from(selectedTokens)}
                            onRedeemComplete={handleRedeemComplete}
                        />
                    </div>
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 mr-2"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            disabled={currentPage * TOKENS_PER_PAGE >= tokens.length}
                            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
