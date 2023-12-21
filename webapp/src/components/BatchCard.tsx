"use client";

import React from "react";
import { useState } from "react";
import { Batch } from "../lib/batch";
import { paginatedIndexesConfig, useContractInfiniteReads } from "wagmi";
import { astaverdeContractConfig } from "../lib/contracts";

/*
the image url is encoded in the metadata
therefore, each Batch will load its metadata then download the image

we assume that batches have a linear progression of tokenIDs

ideally, when clicked we would open a modal that shows info on all the tokens it contains 
*/

export default function BatchCard({ batch }: { batch: Batch }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  console.log("batch.token_ids", batch.token_ids);

  const { data, fetchNextPage, error } = useContractInfiniteReads({
    cacheKey: 'tokenMetadata',
    ...paginatedIndexesConfig(
      (tokenID: bigint) => {
        console.log("fetching tokenCID", tokenID);
        return [
          {
            ...astaverdeContractConfig,
            functionName: 'tokens',
            args: [tokenID] as const,
          },
        ]
      },
      { start: batch.token_ids[batch.token_ids.length - 1], perPage: 10, direction: 'decrement' },
    ),
  });

  console.log("data", data);

  // we get metadata for each token,

  // for each batch, we already have its ID, timestamp, price, and tokenIDs
  // get metadata from ipfs (via http)
  // the cid is obtained from the contract

  // buyBatch

  return (
    <>
    <p>BatchCard {} </p>
    </>
    // <div className="bg-white shadow rounded-lg p-6">
    //   <div className="flex justify-between items-center">
    //     <div className="flex-1 pr-6">
    //       <img className="h-48 w-full object-cover rounded-lg" src={batch.image_url([0].image} alt="batch item" />
    //     </div>
    //     <div className="flex-1 pl-6">
    //       <p className="text-gray-900 font-bold text-2xl">{batch.name}</p>
    //       <p className="text-gray-600">{batch.itemsLeft} items left</p>
    //       <button
    //         className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    //         onClick={() => setIsModalOpen(true)}
    //       >
    //         More Info
    //       </button>
    //       <button className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Buy</button>
    //     </div>
    //   </div>
    //   {isModalOpen && (
    //     <div className="fixed z-10 inset-0 overflow-y-auto">
    //       <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
    //         <div className="fixed inset-0 transition-opacity">
    //           <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
    //         </div>
    //         <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
    //           <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
    //             <h2 className="text-lg leading-6 font-medium text-gray-900">{batch.name}</h2>
    //             <button
    //               className="mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
    //               onClick={() => setIsModalOpen(false)}
    //             >
    //               Close
    //             </button>
    //           </div>
    //         </div>
    //       </div>
    //     </div>
    //   )}
    // </div>
  );
}
