"use client";

import { Batch } from "../lib/batch";
import { astaverdeContractConfig, usdcContractConfig } from "../lib/contracts";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  paginatedIndexesConfig,
  useAccount,
  useContractInfiniteReads,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";

/*
the image url is encoded in the metadata
therefore, each Batch will load its metadata then download the image

we assume that batches have a linear progression of tokenIDs

ideally, when clicked we would open a modal that shows info on all the tokens it contains 
*/

export default function BatchCard({ batch }: { batch: Batch }) {
  // const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokenAmount, setTokenAmount] = useState(1);

  console.log("batch.token_ids", batch.token_ids);

  const { data, fetchNextPage, error } = useContractInfiniteReads({
    cacheKey: "tokenMetadata",
    ...paginatedIndexesConfig(
      (tokenID: bigint) => {
        console.log("fetching tokenCID", tokenID);
        return [
          {
            ...astaverdeContractConfig,
            functionName: "batches",
            args: [tokenID] as const,
          },
        ];
      },
      { start: batch.token_ids[batch.token_ids.length - 1], perPage: 10, direction: "decrement" },
    ),
  });
  const { data: batches, refetch: refetchBathes } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "batches",
    args: [BigInt(batch.id)],
  });

  const { data: currentPrice } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "getBatchPrice",
    args: [BigInt(batch.id)],
  });

  console.log("batch", batch);
  console.log("batches", batches);
  console.log("currentPrice", currentPrice);

  // we get metadata for each token,

  // for each batch, we already have its ID, timestamp, price, and tokenIDs
  // get metadata from ipfs (via http)
  // the cid is obtained from the contract

  // buyBatch

  return (
    <div className="flex justify-between items-center">
      <div className="flex-1 border p-2">
        <img
          className="h-48 w-full object-cover rounded-lg"
          // src={batch.image_url} // Assuming batch has an image_url property
          alt="batch item"
        />

        <p className="text-gray-900 font-bold text-2xl">Batch ID: {batch.id}</p>
        <p className="text-gray-600">{batch ? `${batch.itemsLeft} items left` : "0 items left"}</p>
        <p className="text-gray-600">{currentPrice ? `${currentPrice} Unit Price` : "0 Unit Price"}</p>

        <input
          className="border rounded"
          type="number"
          value={tokenAmount}
          onChange={(e) => setTokenAmount(Number(e.target.value))}
        />

        <p className="text-gray-600">
          {currentPrice ? `${+currentPrice.toString() * tokenAmount} Total Price` : "0 Total Price"}
        </p>

        {/* <button
        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        // Add onClick handler as needed
      >
        More Info
      </button> */}

        {/* Buy Batch Button */}
        <BuyBatchButton batchId={batch.id} tokenAmount={tokenAmount} usdcPrice={currentPrice?.toString() || "0"} />
      </div>
    </div>
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

function BuyBatchButton({
  batchId,
  tokenAmount,
  usdcPrice,
}: {
  batchId: number;
  tokenAmount: number;
  usdcPrice: string;
}) {
  const totalPrice = tokenAmount * Number(usdcPrice);
  const { address } = useAccount();

  const { data: allowance, refetch: refetchAllowance } = useContractRead({
    ...usdcContractConfig,
    functionName: "allowance",
    enabled: address !== undefined,
    args: [address!, astaverdeContractConfig.address],
  });

  console.log("🚀 ~ file: BatchCard.tsx:152 ~ allowance:", Number(formatUnits(allowance || BigInt(0), 6)), totalPrice);
  console.log("buyBatch enabled", Number(formatUnits(allowance || BigInt(0), 6)) >= totalPrice);

  const { config: configApprove } = usePrepareContractWrite({
    ...usdcContractConfig,
    functionName: "approve",
    // enabled: false,
    args: [astaverdeContractConfig.address, parseUnits(totalPrice.toString(), 6)],
  });
  const { write: approve } = useContractWrite(configApprove);

  const { config: configBuyBatch } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "buyBatch",
    enabled: Number(formatUnits(allowance || BigInt(0), 6)) >= totalPrice, // allow buyBatch when there is enough allowance
    args: [BigInt(batchId), parseUnits(totalPrice.toString(), 6), BigInt(tokenAmount)],
  });
  const { write: buyBatch } = useContractWrite(configBuyBatch);

  // If there is not enough allowance to withdraw usdc from user address.
  if (Number(formatUnits(allowance || BigInt(0), 6)) < totalPrice) {
    return (
      <>
        <button
          className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
          disabled={!approve}
          onClick={() => {
            approve?.();
          }}
        >
          Approve USDC
        </button>
      </>
    );
  }

  return (
    <>
      <button
        className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
        disabled={!buyBatch}
        // disabled={isLoading}
        onClick={() => buyBatch?.()}
      >
        Buy
      </button>
    </>
  );
}
