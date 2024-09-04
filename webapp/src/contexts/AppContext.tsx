import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { useContractInteraction } from "../hooks/useContractInteraction";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig, getUsdcContractConfig } from "../lib/contracts";
import { customToast } from "../utils/customToast";

interface AppContextType {
    batches: Batch[];
    astaverdeContractConfig: typeof astaverdeContractConfig;
    getUsdcContractConfig: typeof getUsdcContractConfig;
    usdcContractConfig: ReturnType<typeof getUsdcContractConfig>;
    refetchBatches: () => void;
    updateBatch: (updatedBatch: Batch) => void;
    updateBatchItemsLeft: (batchId: bigint, newItemsLeft: bigint) => void;
    adminControls: {
        pauseContract: () => Promise<string>;
        unpauseContract: () => Promise<string>;
        setURI: (uri: string) => void;
        setPriceFloor: (priceFloor: string) => void;
        setBasePrice: (basePrice: string) => void;
        setMaxBatchSize: (maxBatchSize: string) => void;
        setAuctionDayThresholds: (increase: string, decrease: string) => void;
        setPlatformSharePercentage: (percentage: string) => void;
        claimPlatformFunds: (address: string) => void;
        updateBasePrice: () => Promise<string>;
        mintBatch: (producers: string[], cids: string[]) => Promise<string>;
    };
    getCurrentBatchPrice: (batchId: number) => Promise<bigint>;
    buyBatch: (batchId: number, usdcAmount: bigint, tokenAmount: number) => Promise<string>;
    redeemTokens: (tokenIds: number[]) => Promise<string>;
    updateBasePrice: () => Promise<string>;
    getBatchInfo: (batchId: number) => Promise<any>;
    isAdmin: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    const { data: lastBatchID, refetch: refetchLastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "lastBatchID",
    }) as { data: bigint | undefined; refetch: () => void };

    const { data: batchesData, refetch: refetchBatchesData } = useReadContracts({
        contracts:
            lastBatchID !== undefined
                ? Array.from({ length: Number(lastBatchID) }, (_, i) => ({
                      ...astaverdeContractConfig,
                      functionName: "getBatchInfo",
                      args: [BigInt(i + 1)],
                  }))
                : [],
    });

    const { execute: getBatchInfo } = useContractInteraction(astaverdeContractConfig, "getBatchInfo");

    const { data: contractOwner } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "owner",
    });

    const fetchBatches = useCallback(async () => {
        console.log("Fetching batches...");
        if (!publicClient) {
            console.error("Public client not available");
            return;
        }
        try {
            const lastBatchID = (await publicClient.readContract({
                ...astaverdeContractConfig,
                functionName: "lastBatchID",
            })) as bigint;

            console.log("Last Batch ID from contract:", lastBatchID);
            if (lastBatchID !== null && lastBatchID !== undefined) {
                const fetchedBatches: Batch[] = [];
                for (let i = 0n; i <= lastBatchID; i++) {
                    const batchInfo = await getBatchInfo(Number(i));
                    console.log(`Raw batch ${i} info:`, batchInfo);
                    if (batchInfo) {
                        const [id, token_ids, timestamp, price, itemsLeft] = batchInfo;
                        const batch = new Batch(
                            BigInt(id),
                            token_ids as bigint[],
                            BigInt(timestamp),
                            BigInt(price),
                            BigInt(itemsLeft),
                        );
                        fetchedBatches.push(batch);
                    }
                }
                console.log("Processed batches:", fetchedBatches);
                setBatches(fetchedBatches);
            } else {
                console.log("No batches available according to lastBatchID");
                setBatches([]);
            }
        } catch (error) {
            console.error("Error fetching batches:", error);
            setBatches([]);
        }
    }, [publicClient, getBatchInfo]);

    const refetchBatches = useCallback(async () => {
        try {
            await fetchBatches();
        } catch (error) {
            console.error("Error refetching batches:", error);
            customToast.error("Failed to update batch information");
        }
    }, [fetchBatches]);

    const updateBatch = useCallback((updatedBatch: Batch) => {
        setBatches((prevBatches) => prevBatches.map((batch) => (batch.id === updatedBatch.id ? updatedBatch : batch)));
    }, []);

    const updateBatchItemsLeft = useCallback((batchId: bigint, newItemsLeft: bigint) => {
        setBatches((prevBatches) =>
            prevBatches.map((batch) =>
                batch.id === batchId
                    ? new Batch(batch.id, batch.token_ids, batch.timestamp, batch.price, newItemsLeft)
                    : batch,
            ),
        );
    }, []);

    useEffect(() => {
        console.log("Batches state updated:", batches);
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
        ],
    );

    useEffect(() => {
        if (address && typeof contractOwner === "string") {
            setIsAdmin(address.toLowerCase() === contractOwner.toLowerCase());
        } else {
            setIsAdmin(false);
        }
    }, [address, contractOwner]);

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
