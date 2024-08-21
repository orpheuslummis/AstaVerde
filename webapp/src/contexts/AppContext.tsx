import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
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
        pauseContract: () => void;
        unpauseContract: () => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [batches, setBatches] = useState<Batch[]>([]);

    const { data: lastBatchID, refetch: refetchLastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "lastBatchID",
    });

    const { data: batchesData, refetch: refetchBatchesData } = useReadContracts({
        contracts: lastBatchID
            ? Array.from({ length: Number(lastBatchID) }, (_, i) => ({
                  ...astaverdeContractConfig,
                  functionName: "getBatchInfo",
                  args: [BigInt(i + 1)],
              }))
            : [],
    });

    const fetchBatches = useCallback(async () => {
        await refetchLastBatchID();
        await refetchBatchesData();
    }, [refetchLastBatchID, refetchBatchesData]);

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
        if (batchesData) {
            const newBatches = batchesData
                .map((data, index) => {
                    if (data && data.result && Array.isArray(data.result)) {
                        const [batchId, tokenIds, creationTime, price, remainingTokens] = data.result;
                        return new Batch(BigInt(index + 1), tokenIds, creationTime, price, remainingTokens);
                    }
                    return null;
                })
                .filter((batch): batch is Batch => batch !== null);
            setBatches(newBatches);
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

    const adminControls = useMemo(
        () => ({
            pauseContract,
            unpauseContract,
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
