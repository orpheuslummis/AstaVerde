import { useEffect } from "react";
import { useAccount, useContractInfiniteReads, useContractRead } from "wagmi";
import BatchCard from "./BatchCard";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig } from "../lib/contracts";

export function BatchListing() {
  const { address } = useAccount();

  const { data: lastBatchID, isError: lastBatchIDError, isLoading: isLoadingLastBatchID } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "lastBatchID",
  });

  const lastBatchIDn = lastBatchID ? Number(lastBatchID) : 0;

  const {
    data,
    fetchNextPage,
    error,
    hasNextPage,
    refetch: updateCard,
    isLoading: isLoadingBatches,
    isFetchingNextPage,
  } = useContractInfiniteReads({
    enabled: lastBatchIDn > 0,
    cacheKey: "batchMetadata",
    contracts: (pageParam: number | undefined) => [
      {
        address: astaverdeContractConfig.address as `0x${string}`,
        abi: astaverdeContractConfig.abi as readonly any[],
        functionName: "getBatchInfo",
        args: [BigInt(pageParam ?? 0)] as const,  // Provide a default value if pageParam is undefined
      },
    ],
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !Array.isArray(lastPage[0]?.result) || lastPage[0].result.length === 0) {
        return undefined;
      }
      const nextPageParam = allPages.length + 1;
      return nextPageParam <= lastBatchIDn ? nextPageParam : undefined;
    },
  });

  useEffect(() => {
    if (lastBatchID !== undefined) updateCard();
  }, [lastBatchID, updateCard]);

  const batches: Batch[] =
    data?.pages?.flatMap((page: any[]) =>
      page?.map((batch: any) => {
        try {
          const [batchID, tokenIDs, timestamp, price, itemsLeft] = batch.result || [];
          return new Batch(batchID, tokenIDs, timestamp, price, itemsLeft);
        } catch (error) {
          console.error("Error parsing batch data:", error);
          return null;
        }
      }).filter(Boolean)
    ) || [];

  if (lastBatchIDError || error) {
    console.error("BatchListing: Error", lastBatchIDError || error);
    return <div>Error loading batches. Please try again later.</div>;
  }

  if (isLoadingLastBatchID || isLoadingBatches) {
    return <div>Loading batches...</div>;
  }

  if (lastBatchIDn === 0) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-124px)]">
        <p className="text-xl font-semibold">No batches available yet.</p>
      </div>
    );
  }

  if (!data || data.pages.length === 0 || data.pages[0].length === 0) {
    return <div>No batch data available.</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
        {batches.map(
          (batch) =>
            batch.itemsLeft > 0 && (
              <div key={batch.id} className="w-full px-2 mb-4">
                <BatchCard batch={batch} updateCard={updateCard} />
              </div>
            ),
        )}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            className="px-4 py-2 mt-4 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={!fetchNextPage || isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Load More
          </button>
        </div>
      )}
    </>
  );
}