"use client";

import { Batch } from "../lib/batch";
import { astaverdeContractConfig, usdcContractConfig } from "../lib/contracts";
import BatchCard from "./BatchCard";
import { paginatedIndexesConfig, useAccount, useContractInfiniteReads, useContractRead } from "wagmi";

export function BatchListing() {
  const { address } = useAccount();

  const {
    data: lastBatchID,
    isError,
    isLoading,
    error: lastBatchIDError,
  } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "lastBatchID",
  });

  if (lastBatchIDError || lastBatchID === undefined) {
    console.log("BatchListing: lastBatchIDError", lastBatchIDError);
  }
  const lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

  console.log("BatchListing: lastBatchIDn, isError, isLoading", lastBatchID, isError, isLoading);

  const {
    data,
    fetchNextPage,
    error,
    hasNextPage,
    refetch: updateCard,
  } = useContractInfiniteReads({
    cacheKey: "batchMetadata",
    ...paginatedIndexesConfig(
      (batchID: bigint) => {
        console.log("BatchListing: fetching batchID", batchID);
        return [
          {
            ...astaverdeContractConfig,
            functionName: "getBatchInfo",
            args: [batchID] as const,
          },
        ];
      },
      { start: lastBatchIDn, perPage: 10, direction: "decrement" },
    ),
  });
  console.log("BatchListing: data", data);

  const batches: Batch[] =
    data?.pages?.flatMap(
      (page: any[]) =>
        page?.map((batch: any) => {
          console.log("BatchListing: batch", batch);
          const batchID = batch.result?.[0] || 0;
          const tokenIDs: number[] = batch.result?.[1] || [];
          const timestamp: number = batch.result?.[2] || 0;
          const price: number = batch.result?.[3] || 0;
          const itemsLeft: number = batch.result?.[4] || 0;
          const batchProper = new Batch(batchID, tokenIDs, timestamp, price, itemsLeft);
          console.log("BatchListing: batchProper", batchProper);
          return batchProper;
        }),
    ) || [];

  console.log("🚀 ~ file: BatchListing.tsx:59 ~ BatchListing ~ batches:", batches);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    console.log("BatchListing: error", error);
    return <div>Could not display, sorry.</div>;
  }

  if (!data) {
    return <div>Could not display, sorry.</div>;
  }

  if (error) {
    console.log("BatchListing: error", error);
    return <div>Could not display, sorry.</div>;
  }

  if (data?.pages?.[0]?.[0]?.error) {
    return <div>Error occurred: No batch has been minted yet.</div>;
  }

  if (!address) {
    return (
      <>
        <div className="flex w-full min-h-[calc(100vh-64px)] justify-center items-center text-lg font-bold">
          Please connect wallet first
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
        {batches.map((batch) => (
          <div key={batch.id} className="w-full px-2 mb-4">
            <BatchCard batch={batch} updateCard={updateCard} />
          </div>
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            className="px-4 py-2 mt-4 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={!fetchNextPage || isLoading || isError}
            onClick={(event) => fetchNextPage()}
          >
            Load More
          </button>
        </div>
      )}
    </>
  );
}
