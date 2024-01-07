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

  //
  

  return (
    <>
      <h1>My Tokens</h1>

      {/* loop through the batch ids */}
      {[...Array(lastBatchID).keys()].map(batchIndex => (
        <>
      <BatchCard lastBatchID={batchIndex} />

        </>
      ))}

      <button
      className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      // disabled={!write}

      // disabled={isLoading}
      onClick={() => redeemTokens?.()}
      >
        Redeem
      </button>
    </>
  );
}




function BatchCard({lastBatchID}:{lastBatchID: number}) {


  // get all tokens owned by user
  const { data: balanceOfBatch} = useContractRead({
    ...astaverdeContractConfig,
    functionName: "batches",
    args: [lastTokenID]
  });

  useEffect(() => {
    if(lastTokenID) {
      let sameAddresses = [];
      let tokenIDInArray = [];
      // Use a for loop to fill the array
      for (let i = 0; i < Number(lastTokenID?.toString()); i++) {
        sameAddresses.push(address);
        tokenIDInArray.push(i+1) // starting from 1
      }
    }
  }, [lastTokenID]);

  const { data: balanceOf} = useContractRead({
    ...astaverdeContractConfig,
    functionName: "balanceOf",
    args: []
  });

  return (
    <>
      <button
      className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      // disabled={!write}

      // disabled={isLoading}
      onClick={() => buyBatch?.()}
      >
        Buy
      </button>
    </>
  );
}
