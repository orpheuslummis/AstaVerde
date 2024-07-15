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
      const nextPageParam = lastBatchIDn - allPages.length;
      return Number.isInteger(nextPageParam) ? nextPageParam : undefined;
    },
  });

  useEffect(() => {
    if (lastBatchID !== undefined) updateCard();
  }, [lastBatchID, updateCard]);

  const batches: Batch[] =
    data?.pages?.flatMap((page: any[]) =>
      page?.map((batch: any) => {
        const [batchID, tokenIDs, timestamp, price, itemsLeft] = batch.result || [];
        return new Batch(batchID, tokenIDs, timestamp, price, itemsLeft);
      }),
    ) || [];

  if (isLoadingLastBatchID || isLoadingBatches) return <div>Loading...</div>;

  if (lastBatchIDError || !data || error || data.pages[0][0]?.error) {
    console.error("BatchListing: Error", lastBatchIDError || error);
    return <div>Could not display, sorry.</div>;
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
