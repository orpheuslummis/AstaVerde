"use client";

import { paginatedIndexesConfig, useContractInfiniteReads, useContractRead } from "wagmi";
import { astaverdeContractConfig } from "../lib/contracts";
import BatchCard from "./BatchCard";
import { Batch } from "../lib/batch";

export function BatchListing() {
    const { data: lastBatchID, isError, isLoading, error: lastBatchIDError } = useContractRead({
        ...astaverdeContractConfig,
        functionName: 'lastBatchID',
    });

    if (lastBatchIDError || lastBatchID === undefined) {
        console.log("lastBatchIDError", lastBatchIDError);
    }
    let lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

    console.log("lastBatchIDn, isError, isLoading", lastBatchID, isError, isLoading);

    const { data, fetchNextPage, error } = useContractInfiniteReads({
        cacheKey: 'batchMetadata',
        ...paginatedIndexesConfig(
            (batchID: bigint) => {
                console.log("fetching batchID", batchID);
                return [
                    {
                        ...astaverdeContractConfig,
                        functionName: 'getBatchInfo',
                        args: [batchID] as const,
                    },
                ]
            },
            { start: lastBatchIDn, perPage: 10, direction: 'decrement' },
        ),
    });
    console.log("data", data);

    if (error) {
        console.log("error", error);
        return <div>Could not display, sorry.</div>;
    }

    const batches: Batch[] = data?.pages?.flatMap((page) =>
        page?.map((batch) => {
            console.log("batch", batch);
            let tokenIDs: number[] = batch?.result[0] || [];
            let timestamp: number = batch?.result[1] || 0;
            let price: number = batch?.result[2] || 0;
            let batchProper = new Batch(batch?.id, tokenIDs, timestamp, price);
            return batchProper;
        })
    ) || [];

    return (
        <>
            <div className="flex flex-wrap -mx-2">
                {batches.map((batch) => (
                    <div key={batch.id} className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 px-2 mb-4">
                        <BatchCard batch={batch} />
                    </div>
                ))}
            </div>
            <div className="flex justify-center">
                <button
                    className="px-4 py-2 mt-4 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={!fetchNextPage || isLoading || isError}
                    onClick={fetchNextPage}
                >
                    Load More
                </button>
            </div>
        </>
    );
}
