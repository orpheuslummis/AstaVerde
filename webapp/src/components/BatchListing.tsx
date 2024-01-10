"use client";

import { Batch } from "../lib/batch";
import { astaverdeContractConfig, usdcContractConfig } from "../lib/contracts";
import BatchCard from "./BatchCard";
import { paginatedIndexesConfig, useAccount, useContractInfiniteReads, useContractRead } from "wagmi";

export function BatchListing() {
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
    console.log("lastBatchIDError", lastBatchIDError);
  }
  const lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

  console.log("lastBatchIDn, isError, isLoading", lastBatchID, isError, isLoading);

  const { data, fetchNextPage, error, hasNextPage } = useContractInfiniteReads({
    cacheKey: "batchMetadata",
    ...paginatedIndexesConfig(
      (batchID: bigint) => {
        console.log("fetching batchID", batchID);
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
  console.log("data", data);

  const { address } = useAccount();

  const { data: allowance, refetch: refetchAllowance } = useContractRead({
    ...usdcContractConfig,
    functionName: "allowance",
    enabled: address !== undefined,
    args: [address!, astaverdeContractConfig.address],
  });

  if (error) {
    console.log("error", error);
    return <div>Could not display, sorry.</div>;
  }

  const batches: Batch[] =
    data?.pages?.flatMap(
      (page: any[]) =>
        page?.map((batch: any) => {
          console.log("batch", batch);
          const tokenIDs: number[] = batch.result?.[0] || [];
          const timestamp: number = batch.result?.[1] || 0;
          const price: number = batch.result?.[2] || 0;
          const itemsLeft: number = batch.result?.[3] || 0;
          const batchProper = new Batch(0, tokenIDs, timestamp, price, itemsLeft); // Assuming batch.id is not available, replace 0 with the correct value
          console.log("batchProper", batchProper);
          return batchProper;
        }),
    ) || [];

  console.log("🚀 ~ file: BatchListing.tsx:59 ~ BatchListing ~ batches:", batches);

  return (
    <>
      {/* <div className="w-full flex justify-end p-2 pt-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-700 disabled:opacity-50"
          disabled={!fetchNextPage || isLoading || isError}
          onClick={() => refetchAllowance()}
        >
          Refresh
        </button>
      </div> */}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
        {batches.map((batch) => (
          <div key={batch.id} className="w-full px-2 mb-4">
            <BatchCard batch={batch} />
          </div>
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            className="px-4 py-2 mt-4 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
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
