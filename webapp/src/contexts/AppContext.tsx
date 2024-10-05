import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useContractInteraction } from "../hooks/useContractInteraction";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig, getUsdcContractConfig } from "../lib/contracts";
import { customToast } from "../utils/customToast";
import type { AppContextType } from "../types";
import { serializeBigInt } from "../utils/bigIntHelper";

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    const { execute: getLastBatchID } = useContractInteraction(astaverdeContractConfig, "lastBatchID");
    const { execute: getBatchInfo } = useContractInteraction(astaverdeContractConfig, "getBatchInfo");

    const { data: lastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "lastBatchID",
    }) as { data: bigint | undefined };

    useReadContracts({
        contracts:
            lastBatchID !== undefined
                ? Array.from({ length: Number(lastBatchID) }, (_, i) => ({
                    ...astaverdeContractConfig,
                    functionName: "getBatchInfo",
                    args: [serializeBigInt(BigInt(i + 1))],
                }))
                : [],
    });

    const { data: contractOwner } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "owner",
    });

    const fetchBatches = useCallback(async () => {
        console.log("Fetching batches...");
        if (getLastBatchID && getBatchInfo) {
            try {
                const lastBatchID = await getLastBatchID();
                console.log("Last Batch ID from contract:", lastBatchID.toString());

                if (lastBatchID !== undefined && lastBatchID > 0n) {
                    const batchPromises = [];
                    for (let i = 1n; i <= lastBatchID; i++) {
                        batchPromises.push(getBatchInfo(i));
                    }
                    const batchesInfo = await Promise.all(batchPromises);
                    console.log("Raw batch info:", batchesInfo);

                    const processedBatches = batchesInfo.map((batchInfo) => {
                        console.log(`Raw batch info:`, batchInfo);
                        const [batchId, tokenIds, creationTime, price, remainingTokens] = batchInfo;
                        return new Batch(
                            BigInt(batchId),
                            tokenIds.map(BigInt),
                            BigInt(creationTime),
                            BigInt(price),
                            BigInt(remainingTokens)
                        );
                    });

                    console.log("Processed batches:", processedBatches);
                    setBatches(processedBatches);
                }
            } catch (error) {
                console.error("Error fetching batches:", error);
                customToast.error("Failed to fetch batches");
            }
        }
    }, [getLastBatchID, getBatchInfo]);

    const refetchBatches = useCallback(async () => {
        try {
            await fetchBatches();
        } catch (error) {
            console.error("Error refetching batches:", error);
            customToast.error("Failed to update batch information");
        }
    }, [fetchBatches]);

    const updateBatch = useCallback((updatedBatch: Batch) => {
        setBatches((prevBatches) => prevBatches.map((batch) => (batch.batchId === updatedBatch.batchId ? updatedBatch : batch)));
    }, []);

    const updateBatchItemsLeft = useCallback((batchId: bigint, newItemsLeft: bigint) => {
        setBatches((prevBatches) =>
            prevBatches.map((batch) =>
                batch.batchId === batchId
                    ? new Batch(batch.batchId, batch.tokenIds, batch.creationTime, batch.price, newItemsLeft)
                    : batch,
            ),
        );
    }, []);

    useEffect(() => {
        console.log("Batches state updated:", serializeBigInt(batches));
    }, [batches]);

    const pauseContract = useContractInteraction(astaverdeContractConfig, "pause").execute;
    const unpauseContract = useContractInteraction(astaverdeContractConfig, "unpause").execute;
    const setURI = useContractInteraction(astaverdeContractConfig, "setURI").execute;
    const setPriceFloor = useContractInteraction(astaverdeContractConfig, "setPriceFloor").execute;
    const setBasePrice = useContractInteraction(astaverdeContractConfig, "setBasePrice").execute;
    const setMaxBatchSize = useContractInteraction(astaverdeContractConfig, "setMaxBatchSize").execute;
    const setAuctionDayThresholds = useContractInteraction(astaverdeContractConfig, "setAuctionDayThresholds").execute;
    const setPlatformSharePercentage = useContractInteraction(
        astaverdeContractConfig,
        "setPlatformSharePercentage",
    ).execute;
    const claimPlatformFunds = useContractInteraction(astaverdeContractConfig, "claimPlatformFunds").execute;
    const updateBasePrice = useContractInteraction(astaverdeContractConfig, "updateBasePrice").execute;
    const getCurrentBatchPrice = useContractInteraction(astaverdeContractConfig, "getCurrentBatchPrice").execute;
    const buyBatch = useContractInteraction(astaverdeContractConfig, "buyBatch").execute;
    const redeemTokens = useContractInteraction(astaverdeContractConfig, "redeemTokens").execute;
    const mintBatch = useContractInteraction(astaverdeContractConfig, "mintBatch").execute;
    const setPriceDecreaseRate = useContractInteraction(astaverdeContractConfig, "setPriceDecreaseRate").execute;

    const adminControls = useMemo(
        () => ({
            pauseContract: async () => {
                try {
                    const txHash = await pauseContract();
                    console.log("Pause contract transaction hash:", txHash);
                    return txHash;
                } catch (error) {
                    console.error("Error pausing contract:", error);
                    throw error;
                }
            },
            unpauseContract: async () => {
                try {
                    const txHash = await unpauseContract();
                    console.log("Unpause contract transaction hash:", txHash);
                    return txHash;
                } catch (error) {
                    console.error("Error unpausing contract:", error);
                    throw error;
                }
            },
            setURI,
            setPriceFloor,
            setBasePrice,
            setMaxBatchSize,
            setAuctionDayThresholds,
            setPlatformSharePercentage,
            claimPlatformFunds,
            updateBasePrice: async () => {
                try {
                    const txHash = await updateBasePrice();
                    console.log("Update base price transaction hash:", txHash);
                    return txHash;
                } catch (error) {
                    console.error("Error updating base price:", error);
                    throw error;
                }
            },
            mintBatch: async (producers: string[], cids: string[]) => {
                try {
                    const txHash = await mintBatch(producers, cids);
                    console.log("Mint batch transaction hash:", txHash);
                    await refetchBatches(); // Add this line to refetch batches after minting
                    return txHash;
                } catch (error) {
                    console.error("Error minting batch:", error);
                    throw error;
                }
            },
            setPriceDecreaseRate: async (rate: string) => {
                try {
                    const txHash = await setPriceDecreaseRate(rate);
                    console.log("Set price decrease rate transaction hash:", txHash);
                    return txHash;
                } catch (error) {
                    console.error("Error setting price decrease rate:", error);
                    throw error;
                }
            },
        }),
        [
            pauseContract,
            unpauseContract,
            setURI,
            setPriceFloor,
            setBasePrice,
            setMaxBatchSize,
            setAuctionDayThresholds,
            setPlatformSharePercentage,
            claimPlatformFunds,
            updateBasePrice,
            mintBatch,
            refetchBatches,
            setPriceDecreaseRate, // Add this line
        ],
    );

    useEffect(() => {
        if (address && typeof contractOwner === "string") {
            setIsAdmin(address.toLowerCase() === contractOwner.toLowerCase());
        } else {
            setIsAdmin(false);
        }
    }, [address, contractOwner]);

    const { execute: balanceOf } = useContractInteraction(astaverdeContractConfig, "balanceOf");
    const { execute: tokenOfOwnerByIndex } = useContractInteraction(astaverdeContractConfig, "tokenOfOwnerByIndex");

    const { execute: getLastTokenID } = useContractInteraction(astaverdeContractConfig, "lastTokenID");

    const contextValue = useMemo(
        () => ({
            batches,
            astaverdeContractConfig,
            getUsdcContractConfig,
            usdcContractConfig: getUsdcContractConfig(),
            refetchBatches,
            updateBatch,
            updateBatchItemsLeft,
            adminControls,
            getCurrentBatchPrice,
            buyBatch,
            redeemTokens,
            updateBasePrice: adminControls.updateBasePrice,
            getBatchInfo,
            isAdmin,
            balanceOf,
            tokenOfOwnerByIndex,
        }),
        [
            batches,
            refetchBatches,
            updateBatch,
            updateBatchItemsLeft,
            adminControls,
            getCurrentBatchPrice,
            buyBatch,
            redeemTokens,
            getBatchInfo,
            isAdmin,
            balanceOf,
            tokenOfOwnerByIndex,
        ],
    );

    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
}