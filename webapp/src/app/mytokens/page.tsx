"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TokenCard from "../../components/TokenCard";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import RedeemTokensButton from "./RedeemTokensButton";

const TOKENS_PER_PAGE = 12;

/**
 * MyTokensPage component displays user's tokens and provides redemption functionality.
 * 
 * @returns {JSX.Element} The rendered component.
 */
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

    /**
     * Fetches user's tokens and their redemption status.
     * Updates the component state with the fetched data.
     */
    const fetchTokens = useCallback(async () => {
        if (!address) return;
        try {
            setIsLoading(true);
            const lastTokenID = await getLastTokenID();
            console.log("Last Token ID:", lastTokenID);
            if (lastTokenID === undefined || lastTokenID === null) {
                throw new Error("Failed to fetch last token ID: Received undefined or null");
            }
            const userTokens: bigint[] = [];
            for (let i = 1n; i <= lastTokenID; i++) {
                const balance = await getTokensOfOwner(address, i);
                console.log(`Token ${i} balance:`, balance);
                if (balance && balance > 0n) {
                    userTokens.push(i);
                }
            }
            console.log("User Tokens:", userTokens);
            setTokens(userTokens);

            const status: Record<string, boolean> = {};
            for (const tokenId of userTokens) {
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

    /**
     * Toggles the selection state of a token.
     * 
     * @param {bigint} tokenId - The ID of the token to toggle.
     */
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

    /**
     * Callback function to be executed when token redemption is complete.
     * Refreshes the token list and clears the selection.
     */
    const handleRedeemComplete = useCallback(() => {
        fetchTokens();
        setSelectedTokens(new Set());
    }, [fetchTokens]);

    const currentTokens = tokens.slice((currentPage - 1) * TOKENS_PER_PAGE, currentPage * TOKENS_PER_PAGE);

    /**
     * Selects all available tokens.
     */
    const handleSelectAll = () => {
        setSelectedTokens(new Set(tokens));
    };

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
                            <div key={tokenId.toString()} className="flex flex-col">
                                <TokenCard
                                    tokenId={tokenId}
                                    isMyTokensPage={true}
                                    isRedeemed={redeemStatus[tokenId.toString()]}
                                    isSelected={selectedTokens.has(tokenId)}
                                />
                                {!redeemStatus[tokenId.toString()] && (
                                    <label className="flex items-center mt-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedTokens.has(tokenId)}
                                            onChange={() => handleTokenSelect(tokenId)}
                                            className="form-checkbox h-5 w-5 text-emerald-600 dark:text-emerald-400"
                                        />
                                        <span className="ml-2 text-sm dark:text-gray-300">Select for redemption</span>
                                    </label>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-8">
                        <RedeemTokensButton
                            selectedTokens={Array.from(selectedTokens)}
                            onRedeemComplete={handleRedeemComplete}
                            onSelectAll={handleSelectAll}
                            allTokens={tokens}
                            redeemStatus={redeemStatus}
                        />
                    </div>
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 mr-2"
                            type="button"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage((prev) => prev + 1)}
                            disabled={currentPage * TOKENS_PER_PAGE >= tokens.length}
                            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                            type="button"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}