import type React from "react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useContractInteraction } from "../hooks/useContractInteraction";
import { Batch } from "../lib/batch";
import {
    astaverdeContractConfig,
    getUsdcContractConfig,
} from "../lib/contracts";
import type { AppContextType } from "../types";
import { serializeBigInt } from "../utils/bigIntHelper";
import { customToast } from "../utils/customToast";

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { address } = useAccount();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    const { execute: getLastBatchID } = useContractInteraction(
        astaverdeContractConfig,
        "lastBatchID",
    );
    const { execute: getBatchInfo } = useContractInteraction(
        astaverdeContractConfig,
        "getBatchInfo",
    );

    const { data: lastBatchID } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "lastBatchID",
    }) as { data: bigint | undefined };

    useReadContracts({
        contracts: lastBatchID !== undefined
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
                console.log(
                    "Last Batch ID from contract:",
                    lastBatchID.toString(),
                );

                if (lastBatchID !== undefined && lastBatchID > 0n) {
                    const batchPromises = [];
                    for (let i = 1n; i <= lastBatchID; i++) {
                        batchPromises.push(getBatchInfo(i));
                    }
                    const batchesInfo = await Promise.all(batchPromises);
                    console.log("Raw batch info:", batchesInfo);

                    const processedBatches = batchesInfo.map((batchInfo) => {
                        console.log(`Raw batch info:`, batchInfo);
                        const [
                            batchId,
                            tokenIds,
                            creationTime,
                            price,
                            remainingTokens,
                        ] = batchInfo;
                        return new Batch(
                            BigInt(batchId),
                            tokenIds.map(BigInt),
                            BigInt(creationTime),
                            BigInt(price),
                            BigInt(remainingTokens),
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
        setBatches((prevBatches) =>
            prevBatches.map((
                batch,
            ) => (batch.batchId === updatedBatch.batchId
                ? updatedBatch
                : batch)
            )
        );
    }, []);

    const updateBatchItemsLeft = useCallback(
        (batchId: bigint, newItemsLeft: bigint) => {
            setBatches((prevBatches) =>
                prevBatches.map((batch) =>
                    batch.batchId === batchId
                        ? new Batch(
                            batch.batchId,
                            batch.tokenIds,
                            batch.creationTime,
                            batch.price,
                            newItemsLeft,
                        )
                        : batch
                )
            );
        },
        [],
    );

    useEffect(() => {
        console.log("Batches state updated:", serializeBigInt(batches));
    }, [batches]);

    const { execute: pauseContract } = useContractInteraction(
        astaverdeContractConfig,
        "pause",
    );
    const { execute: unpauseContract } = useContractInteraction(
        astaverdeContractConfig,
        "unpause",
    );

    const setURI =
        useContractInteraction(astaverdeContractConfig, "setURI").execute;
    const setPriceFloor =
        useContractInteraction(astaverdeContractConfig, "setPriceFloor")
            .execute;
    const setBasePrice =
        useContractInteraction(astaverdeContractConfig, "setBasePrice").execute;
    const setMaxBatchSize =
        useContractInteraction(astaverdeContractConfig, "setMaxBatchSize")
            .execute;
    const setAuctionDayThresholds = useContractInteraction(
        astaverdeContractConfig,
        "setAuctionDayThresholds",
    ).execute;
    const setPlatformSharePercentage = useContractInteraction(
        astaverdeContractConfig,
        "setPlatformSharePercentage",
    ).execute;
    const claimPlatformFunds =
        useContractInteraction(astaverdeContractConfig, "claimPlatformFunds")
            .execute;
    const updateBasePrice =
        useContractInteraction(astaverdeContractConfig, "updateBasePrice")
            .execute;
    const getCurrentBatchPrice =
        useContractInteraction(astaverdeContractConfig, "getCurrentBatchPrice")
            .execute;
    const buyBatch =
        useContractInteraction(astaverdeContractConfig, "buyBatch").execute;
    const redeemToken =
        useContractInteraction(astaverdeContractConfig, "redeemToken").execute;
    const mintBatch =
        useContractInteraction(astaverdeContractConfig, "mintBatch").execute;
    const setPriceDelta =
        useContractInteraction(astaverdeContractConfig, "setPriceDelta")
            .execute;
    const setDailyPriceDecay =
        useContractInteraction(astaverdeContractConfig, "setDailyPriceDecay")
            .execute;

    const adminControls = useMemo(
        () => ({
            pauseContract: async () => {
                if (!isAdmin || !address) {
                    console.log("Not authorized to pause contract");
                    return;
                }
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
                if (!isAdmin || !address) {
                    console.log("Not authorized to unpause contract");
                    return;
                }
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
                    await refetchBatches();
                    return txHash;
                } catch (error) {
                    console.error("Error minting batch:", error);
                    throw error;
                }
            },
            setPriceDelta: async (priceDelta: bigint) => {
                try {
                    const txHash = await setPriceDelta(priceDelta);
                    console.log("Set Price Delta transaction hash:", txHash);
                    customToast.success("Price delta updated successfully");
                    return txHash;
                } catch (error) {
                    console.error("Error setting price delta:", error);
                    customToast.error("Failed to update price delta");
                    throw error;
                }
            },
            setDailyPriceDecay: async (amount: bigint) => {
                try {
                    const txHash = await setDailyPriceDecay(amount);
                    console.log(
                        "Set Daily Price Decay transaction hash:",
                        txHash,
                    );
                    customToast.success(
                        "Daily price decay updated successfully",
                    );
                    return txHash;
                } catch (error) {
                    console.error("Error setting daily price decay:", error);
                    customToast.error("Failed to update daily price decay");
                    throw error;
                }
            },
        }),
        [
            isAdmin,
            address,
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
            setPriceDelta,
            setDailyPriceDecay,
        ],
    );

    useEffect(() => {
        if (address && typeof contractOwner === "string") {
            setIsAdmin(address.toLowerCase() === contractOwner.toLowerCase());
        } else {
            setIsAdmin(false);
        }
    }, [address, contractOwner]);

    const { execute: balanceOf } = useContractInteraction(
        astaverdeContractConfig,
        "balanceOf",
    );
    const { execute: tokenOfOwnerByIndex } = useContractInteraction(
        astaverdeContractConfig,
        "tokenOfOwnerByIndex",
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
            redeemToken,
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
            redeemToken,
            getBatchInfo,
            isAdmin,
            balanceOf,
            tokenOfOwnerByIndex,
        ],
    );

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
}
