import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useContractInteraction } from "../hooks/useContractInteraction";
import { useAstaVerdeRefetch } from "../hooks/useGlobalEvent";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig, getUsdcContractConfig } from "../lib/contracts";
import { customToast } from "../shared/utils/customToast";
import type { AppContextType } from "../types";

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const hasLoadedBatchesRef = useRef(false);

  const { execute: getLastBatchID } = useContractInteraction(astaverdeContractConfig, "lastBatchID");
  const { execute: getBatchInfo } = useContractInteraction(astaverdeContractConfig, "getBatchInfo");

  // Prime ABI/types; data not used directly here
  useReadContract({
    ...astaverdeContractConfig,
    functionName: "lastBatchID",
  });

  // Note: Removed useReadContracts as it was causing BigInt serialization issues
  // and the data wasn't being used. Batches are fetched via fetchBatches() instead.

  const { data: contractOwner } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "owner",
  });

  const fetchBatches = useCallback(async () => {
    if (!getLastBatchID || !getBatchInfo) {
      return;
    }

    try {
      const lastBatchID = await getLastBatchID();

      if (lastBatchID !== undefined && lastBatchID > 0n) {
        const batchPromises = [];
        for (let i = 1n; i <= lastBatchID; i++) {
          batchPromises.push(getBatchInfo(i));
        }
        const batchesInfo = await Promise.all(batchPromises);

        const processedBatches = batchesInfo.map((batchInfo) => {
          const [batchId, tokenIds, creationTime, price, remainingTokens] = batchInfo;
          return new Batch(
            BigInt(batchId),
            tokenIds.map(BigInt),
            BigInt(creationTime),
            BigInt(price),
            BigInt(remainingTokens),
          );
        });

        setBatches(processedBatches);
        hasLoadedBatchesRef.current = true;
      } else {
        setBatches([]);
        hasLoadedBatchesRef.current = true;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching batches:", error);
      // Don't show toast on initial load failures
      if (hasLoadedBatchesRef.current) {
        customToast.error("Failed to fetch batches");
      }
    }
  }, [getLastBatchID, getBatchInfo]);

  const refetchBatches = useCallback(async () => {
    try {
      await fetchBatches();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error refetching batches:", error);
      customToast.error("Failed to update batch information");
    }
  }, [fetchBatches]);

  // Listen for a global refetch event (used by components after tx success)
  useAstaVerdeRefetch(() => {
    void refetchBatches();
  }, [refetchBatches]);

  const updateBatch = useCallback((updatedBatch: Batch) => {
    setBatches((prevBatches) =>
      prevBatches.map((batch) => (batch.batchId === updatedBatch.batchId ? updatedBatch : batch)),
    );
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


  const { execute: pauseContract } = useContractInteraction(astaverdeContractConfig, "pause");
  const { execute: unpauseContract } = useContractInteraction(astaverdeContractConfig, "unpause");

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
  // Note: updateBasePrice is private in the contract and not exposed via ABI; do not attempt to call it from UI
  const getCurrentBatchPrice = useContractInteraction(astaverdeContractConfig, "getCurrentBatchPrice").execute;
  const buyBatch = useContractInteraction(astaverdeContractConfig, "buyBatch").execute;
  const redeemToken = useContractInteraction(astaverdeContractConfig, "redeemToken").execute;
  const mintBatch = useContractInteraction(astaverdeContractConfig, "mintBatch").execute;
  const setPriceDelta = useContractInteraction(astaverdeContractConfig, "setPriceDelta").execute;
  const setDailyPriceDecay = useContractInteraction(astaverdeContractConfig, "setDailyPriceDecay").execute;
  const setMaxPriceUpdateIterations = useContractInteraction(astaverdeContractConfig, "setMaxPriceUpdateIterations").execute;
  const recoverSurplusUSDC = useContractInteraction(astaverdeContractConfig, "recoverSurplusUSDC").execute;

  const adminControls = useMemo(
    () => ({
      pauseContract: async () => {
        if (!isAdmin || !address) {
          return;
        }
        try {
          const txHash = await pauseContract();
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error pausing contract:", error);
          throw error;
        }
      },
      unpauseContract: async () => {
        if (!isAdmin || !address) {
          return;
        }
        try {
          const txHash = await unpauseContract();
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
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
      // No public updateBasePrice admin action; base price adjusts internally during mint/buy
      mintBatch: async (producers: string[], cids: string[]) => {
        try {
          const txHash = await mintBatch(producers, cids);
          await refetchBatches();
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error minting batch:", error);
          throw error;
        }
      },
      setPriceDelta: async (priceDelta: bigint) => {
        try {
          const txHash = await setPriceDelta(priceDelta);
          customToast.success("Price delta updated successfully");
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error setting price delta:", error);
          customToast.error("Failed to update price delta");
          throw error;
        }
      },
      setDailyPriceDecay: async (amount: bigint) => {
        try {
          const txHash = await setDailyPriceDecay(amount);
          customToast.success("Daily price decay updated successfully");
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error setting daily price decay:", error);
          customToast.error("Failed to update daily price decay");
          throw error;
        }
      },
      setMaxPriceUpdateIterations: async (limit: bigint) => {
        try {
          const txHash = await setMaxPriceUpdateIterations(limit);
          customToast.success("Max price update iterations updated successfully");
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error setting max price update iterations:", error);
          customToast.error("Failed to update max price update iterations");
          throw error;
        }
      },
      recoverSurplusUSDC: async (to: string) => {
        try {
          const txHash = await recoverSurplusUSDC(to);
          customToast.success("Surplus USDC recovered successfully");
          return txHash;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Error recovering surplus USDC:", error);
          customToast.error("Failed to recover surplus USDC");
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
      mintBatch,
      refetchBatches,
      setPriceDelta,
      setDailyPriceDecay,
      setMaxPriceUpdateIterations,
      recoverSurplusUSDC,
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
      // updateBasePrice is intentionally omitted
      getBatchInfo,
      isAdmin,
      balanceOf,
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
