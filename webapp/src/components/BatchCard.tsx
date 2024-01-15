"use client;"

import { Batch } from "../lib/batch";
import { astaverdeContractConfig, usdcContractConfig } from "../lib/contracts";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  paginatedIndexesConfig,
  useAccount,
  useContractInfiniteReads,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";

export default function BatchCard({ batch }: { batch: Batch }) {
  const [tokenAmount, setTokenAmount] = useState(1);
  const [firstTokenCID, setFirstTokenCID] = useState<string | null>(null);
  const [image_url, setImageUrl] = useState<string | null>(null);

  console.log("BatchCard: batch.token_ids", batch.token_ids);

  const { data, fetchNextPage, error } = useContractInfiniteReads({
    cacheKey: "tokenMetadata",
    ...paginatedIndexesConfig(
      (tokenID: bigint) => {
        console.log("BatchCard: fetching tokenCID", tokenID);
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

  console.log("BatchCard: batch", batch);
  console.log("BatchCard: batches", batches);
  console.log("BatchCard: currentPrice", currentPrice);
  console.log("BatchCard: batch.id", batch.id);

  const fetchTokenImageUrl = async (tokenCID: string) => {
    try {
      const response = await fetch(`https://ipfs.io/ipfs/${tokenCID}`);
      const metadata = await response.json();
      console.log("BatchCard: fetched token metadata", metadata);
      const imageUrl = metadata.image_url;
      console.log("BatchCard: fetched image URL", imageUrl);
      return imageUrl;
    } catch (error) {
      console.error("BatchCard: error fetching token metadata", error);
      return null;
    }
  };

  const getTokenInfo = async (tokenID: bigint) => {
    const { data: token } = await useContractRead({
      ...astaverdeContractConfig,
      functionName: "tokens",
      args: [tokenID],
    });

    return token;
  };

  const getFirstTokenCID = async () => {
    if (data?.pages?.[0]?.[0]) {
      const tokenID = data.pages[0][0];
      if (tokenID === undefined) {
        return null;
      }
      const tokenInfo = await useContractRead({
        ...astaverdeContractConfig,
        functionName: "tokens",
        args: [tokenID],
      });
      console.log("BatchCard: tokenInfo", tokenInfo);
      if (tokenInfo) {
        const tokenCID = tokenInfo[2];
        console.log("BatchCard: tokenCID", tokenCID);
        return tokenCID;
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      const firstTokenCID = await getFirstTokenCID();
      console.log("BatchCard: firstTokenCID", firstTokenCID);
      if (firstTokenCID) {
        setFirstTokenCID(firstTokenCID);
        const imageUrl = await fetchTokenImageUrl(firstTokenCID);
        console.log("BatchCard: fetched image URL", imageUrl);
        setImageUrl(imageUrl);
      }
    };

    fetchData();
  }, [data]);


  return (
    <div className="flex justify-between items-center">
      <div className="flex-1 border rounded-lg overflow-hidden shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
          <img
            className="h-48 w-full object-cover rounded-lg col-span-full"
            // src={batch.image_url} // Assuming batch has an image_url property
            alt="batch item"
          />

          <div className="col-span-full mt-4">
            <p className="text-gray-900 font-bold text-2xl">Batch {Number(batch.id)}</p>
            <p className="text-gray-600">{batch ? `${batch.itemsLeft} items left` : "0 items left"}</p>
            <p className="text-gray-600">{currentPrice ? `${currentPrice} USDC` : "0 USDC"}</p>
          </div>

          <div className="col-span-full mt-4">
            <label htmlFor="quantity" className="block text-gray-600">
              Select quantity
            </label>
            <input
              id="quantity"
              className="border rounded px-2 py-1 w-full"
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Buy Batch Button */}
        <div className="mt-4 p-4">
          <p className="text-black mt-1 font-bold">
            {currentPrice ? `Total: ${+currentPrice.toString() * tokenAmount} USDC` : "Total: 0 USDC"}
          </p>
          <BuyBatchButton batchId={batch.id} tokenAmount={tokenAmount} usdcPrice={currentPrice?.toString() || "0"} />
        </div>
      </div>
    </div>
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
  const [awaitedHash, setAwaitedHash] = useState<`0x${string}` | undefined>(undefined);
  const { data: txReceipt } = useWaitForTransaction({
    hash: awaitedHash,
  });

  const { data: allowance, refetch: refetchAllowance } = useContractRead({
    ...usdcContractConfig,
    functionName: "allowance",
    enabled: address !== undefined,
    args: [address!, astaverdeContractConfig.address],
  });

  console.log("BatchCard: allowance:", Number(formatUnits(allowance || BigInt(0), 6)), totalPrice);
  console.log("BatchCard: buyBatch enabled", Number(formatUnits(allowance || BigInt(0), 6)) >= totalPrice);

  const { config: configApprove } = usePrepareContractWrite({
    ...usdcContractConfig,
    functionName: "approve",
    // enabled: false,
    args: [astaverdeContractConfig.address, parseUnits(totalPrice.toString(), 6)],
  });
  const { writeAsync: approve } = useContractWrite(configApprove);

  const { config: configBuyBatch } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "buyBatch",
    enabled: Number(formatUnits(allowance || BigInt(0), 6)) >= totalPrice, // allow buyBatch when there is enough allowance
    args: [BigInt(batchId), parseUnits(totalPrice.toString(), 6), BigInt(tokenAmount)],
  });
  const { writeAsync: buyBatchAsync } = useContractWrite(configBuyBatch);

  const refreshAllowance = async () => {
    await refetchAllowance();
  };
  useEffect(() => {
    if (txReceipt) {
      void refreshAllowance();
    }
  }, [txReceipt]);

  // If there is not enough allowance to withdraw usdc from user address.
  if (Number(formatUnits(allowance || BigInt(0), 6)) < totalPrice) {
    return (
      <>
        <button
          className="mt-4 bg-primary hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
          disabled={!approve}
          onClick={async () => {
            if (approve) {
              const result = await approve();
              setAwaitedHash(result.hash);
            }
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
        className="mt-4 bg-primary hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
        disabled={!buyBatchAsync}
        // disabled={isLoading}
        onClick={async () => {
          if (buyBatchAsync) {
            const result = await buyBatchAsync();
            setAwaitedHash(result.hash);
          }
        }}
      >
        Buy
      </button>
    </>
  );
}
