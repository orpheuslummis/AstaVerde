/*
mode: all, redeemed, not-redeemed
start: the latest batch
perPage: 10
*/
"use client";

import { use, useEffect, useState } from "react";
import { useContractWrite, usePrepareContractWrite, useContractRead, useAccount, useContractInfiniteReads, paginatedIndexesConfig } from "wagmi";
import { astaverdeContractConfig, usdcContractConfig } from "../../lib/contracts";
import { Batch } from "../../lib/batch";

export default function Page() {

  const { data: lastBatchID, isError, isLoading, error: lastBatchIDError } = useContractRead({
    ...astaverdeContractConfig,
    functionName: 'lastBatchID',
});

if (lastBatchIDError || lastBatchID === undefined) {
    console.log("lastBatchIDError", lastBatchIDError);
}
const lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

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

const batches: Batch[] = data?.pages?.flatMap((page: any[]) =>
    page?.map((batch: any) => {
        console.log("batch", batch);
        const tokenIDs: number[] = batch.result?.[0] || [];
        const timestamp: number = batch.result?.[1] || 0;
        const price: number = batch.result?.[2] || 0;
        const batchProper = new Batch(0, tokenIDs, timestamp, price); // Assuming batch.id is not available, replace 0 with the correct value
        console.log("batchProper", batchProper);
        return batchProper;
    })
) || [];

  return (
    <>
      <h1>My Tokens</h1>

      {/* loop through the batch ids */}
      {batches.map(batch => (
        <>
          <BatchRedeemCard batch={batch} />
        </>
      ))}

      {/* <button
      className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      // disabled={!write}

      // disabled={isLoading}
      onClick={() => redeemTokens?.()}
      >
        Redeem
      </button> */}
    </>
  );
}

function BatchRedeemCard({batch}:{batch: Batch}) {
  const { address } = useAccount();
  const [sameAddresses, setSameAddresses] = useState<`0x${string}`[]>();

  console.log("batch in mytokens: ", batch.token_ids)

  useEffect(() => {
    if(address && batch) {
      let _sameAddresses: `0x${string}`[] = [];
      // Use a for loop to fill the array
      for (let i = 0; i < batch.token_ids.length; i++) {
        _sameAddresses.push(address);
      }

      setSameAddresses(_sameAddresses)
    }
  }, [batch.token_ids.length]);

  const { data: ownedIndex} = useContractRead({
    ...astaverdeContractConfig,
    functionName: "balanceOfBatch",
    args: [sameAddresses ? sameAddresses : ["0x0000"], batch.token_ids as unknown as bigint[]]
  });
  console.log("🚀 ~ file: page.tsx:110 ~ BatchRedeemCard ~ ownedIndex:", ownedIndex)

  return (
    <>
      <button
      className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      // disabled={!write}

      // disabled={isLoading}
      // onClick={() => buyBatch?.()}
      >
        Redeem
      </button>
    </>
  );
}
