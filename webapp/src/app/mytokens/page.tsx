/*
mode: all, redeemed, not-redeemed
start: the latest batch
perPage: 10
*/

"use client";

import { use, useEffect, useState } from "react";
import { useContractWrite, usePrepareContractWrite, useContractRead, useAccount } from "wagmi";
import { astaverdeContractConfig, usdcContractConfig } from "../../lib/contracts";

export default function Page() {
  return (
    <>
      <h1>My Tokens</h1>

      {/* loop through the batch ids */}
      {[...Array(lastBatchID).keys()].map(batchIndex => (
        <>
      <BatchCard lastBatchID={BigInt(batchIndex)} />

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

function BatchCard({lastBatchID}:{lastBatchID: bigint}) {
  const { address } = useAccount();
  const [sameAddresses, setSameAddresses] = useState<`0x${string}`[]>();
  // get all tokens owned by user
  const { data: batch} = useContractRead({
    ...astaverdeContractConfig,
    functionName: "batches",
    args: [lastBatchID]
  });

  console.log(batch)

  useEffect(() => {
    if(lastBatchID && address && batch) {
      let _sameAddresses: `0x${string}`[] = [];
      let tokenIDInArray = [];
      // Use a for loop to fill the array
      for (let i = 0; i < Number(batch[0]); i++) {// should be Number(batch[0]).tokenIds
        _sameAddresses.push(address);
        tokenIDInArray.push(i+1) // starting from 1
      }

      setSameAddresses(_sameAddresses)
    }
  }, [lastBatchID]);

  const { data: balanceOf} = useContractRead({
    ...astaverdeContractConfig,
    functionName: "balanceOfBatch",
    args: [sameAddresses ? sameAddresses : ["0x0000"], batch?.[0] as unknown as bigint[]]
  });

  return (
    <>
      <button
      className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      // disabled={!write}

      // disabled={isLoading}
      // onClick={() => buyBatch?.()}
      >
        Buy
      </button>
    </>
  );
}