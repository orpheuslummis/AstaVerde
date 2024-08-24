import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
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
    updateBatchItemsLeft: (batchId: number, newItemsLeft: number) => void;
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
    isAdmin: boolean; // Add isAdmin to the context type
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { address } = useAccount(); // Get the current user's address
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isAdmin, setIsAdmin] = useState(false); // State to track if the user is an admin

    const { data: lastBatchID, refetch: refetchLastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "lastBatchID",
    });

    const { data: batchesData, refetch: refetchBatchesData } = useReadContracts({
        contracts:
            lastBatchID !== undefined
                ? Array.from({ length: Number(lastBatchID) + 1 }, (_, i) => ({
                      ...astaverdeContractConfig,
                      functionName: "getBatchInfo",
                      args: [BigInt(i)],
                  }))
                : [],
    });

    const fetchBatches = useCallback(async () => {
        console.log("Fetching batches...");
        await refetchLastBatchID();
        console.log("Last Batch ID:", lastBatchID);
        await refetchBatchesData();
        console.log("Batches Data:", batchesData);
    }, [refetchLastBatchID, refetchBatchesData, lastBatchID, batchesData]);

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

    const updateBatchItemsLeft = useCallback((batchId: number, newItemsLeft: number) => {
        setBatches((prevBatches) =>
            prevBatches.map((batch) =>
                batch.id === batchId
                    ? new Batch(batch.id, batch.token_ids, batch.timestamp, batch.price, newItemsLeft)
                    : batch,
            ),
        );
    }, []);

    useEffect(() => {
        console.log("batchesData changed:", batchesData);
        if (batchesData) {
            console.log("Processing batchesData:", batchesData);
            const newBatches = batchesData
                .map((data, index) => {
                    if (data && data.result && Array.isArray(data.result)) {
                        const [batchId, tokenIds, creationTime, price, remainingTokens] = data.result;
                        console.log(`Processing batch ${index}:`, {
                            batchId,
                            tokenIds,
                            creationTime,
                            price,
                            remainingTokens,
                        });
                        const batch = new Batch(batchId, tokenIds, creationTime, price, remainingTokens);
                        console.log("Created Batch object:", batch);
                        return batch;
                    }
                    console.log(`Skipping invalid batch data for index ${index}`);
                    return null;
                })
                .filter((batch): batch is Batch => batch !== null);
            console.log("New batches:", newBatches);
            setBatches(newBatches);
        } else {
            console.log("batchesData is null or undefined");
        }
    }, [batchesData]);

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
    const getBatchInfo = useContractInteraction(astaverdeContractConfig, "getBatchInfo").execute;

    const manuallyFetchBatch = useCallback(
        async (batchId: number) => {
            console.log(`Manually fetching batch ${batchId}`);
            const result = await getBatchInfo(batchId);
            console.log(`Manually fetched batch ${batchId} result:`, result);
        },
        [getBatchInfo],
    );

    useEffect(() => {
        manuallyFetchBatch(0); // Check for batch 0
    }, [manuallyFetchBatch]);

    useEffect(() => {
        // Check if the current user is an admin
        const checkAdmin = async () => {
            if (address) {
                // Replace with your logic to check if the user is an admin
                const adminAddress = "0xe16ff25a3A5ea931A81A645aF13B9726eEe82923"; // Example admin address
                setIsAdmin(address.toLowerCase() === adminAddress.toLowerCase());
            }
        };
        checkAdmin();
    }, [address]);

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
            isAdmin, // Add isAdmin to the context value
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
