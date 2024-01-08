"use client";

// import BatchCard from '../components/BatchCard';
// import { useContractInfiniteReads, paginatedIndexesConfig, useContractRead } from 'wagmi'
// import { astaverdeContractConfig } from "../lib/contracts";
import { BatchListing } from "../components/BatchListing";

/*
mode: available , fullySold
start: the latest batch
perPage: 10
*/

export default function Page() {
  //   const { data: batchesLength } = useContractRead({
  //   ...astaverdeContractConfig,
  //   functionName: "lastBatchID"
  // });
  //   const { data: batches, refetch: refetchBathes } = useContractRead({
  //     ...astaverdeContractConfig,
  //     functionName: "batches",
  //     args: [BigInt(batchesLength || 0)]
  //   });

  return (
    <>
      {/* <button onClick={() => {refetchBathes();
      console.log(BigInt(batchesLength || 0).toString())}}>
        batchesLength 
    </button>
     <button onClick={() => {refetchBathes();
      console.log(batches)}}>
        Test 
    </button> */}
      <BatchListing />
    </>
  );
}
