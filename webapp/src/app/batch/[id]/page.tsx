"use client";

import type { BatchData, BatchParams } from "../../../types";
import { useEffect, useMemo, useState } from "react";
import { useRateLimitedPublicClient } from "@/hooks/useRateLimitedPublicClient";
import Image from "next/image";
import Link from "next/link";
import BatchInfo from "../../../components/BatchInfo";
import TokenCard from "../../../components/TokenCard";
import Loader from "../../../components/Loader";
import { useAppContext } from "../../../contexts/AppContext";
import { getPlaceholderImageUrl } from "../../../utils/placeholderImage";

export default function Page({ params }: { params: BatchParams }) {
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { astaverdeContractConfig } = useAppContext();
  const publicClient = useRateLimitedPublicClient();

  const placeholderImage = useMemo(() =>
    getPlaceholderImageUrl(
      params.id,
      batchData ? batchData[1].length.toString() : "0",
    ), [params.id, batchData]);

  useEffect(() => {
    const fetchBatchData = async () => {
      if (typeof params.id !== "string") {
        setError("Invalid batch ID");
        setIsLoading(false);
        return;
      }

      if (!publicClient) {
        setError("Public client not available");
        setIsLoading(false);
        return;
      }

      try {
        const batchInfo = await publicClient.readContract({
          ...astaverdeContractConfig,
          functionName: "getBatchInfo",
          args: [BigInt(params.id)],
        });
        // Debug removed; keep UI quiet in dev
        setBatchData(batchInfo as BatchData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching batch data:", err);
        setError("Failed to fetch batch data");
        setIsLoading(false);
      }
    };

    fetchBatchData();
  }, [params.id, publicClient, astaverdeContractConfig]);

  if (isLoading) return <Loader message={`Loading batch ${params.id}...`} />;
  if (error) {
    return (
      <div className="text-center py-8 text-red-500 dark:text-red-400">
                Error: {error}
      </div>
    );
  }
  if (!batchData) {
    return (
      <div className="text-center py-8 dark:text-white">
                No batch data available.
      </div>
    );
  }

  const [batchId, tokenIds] = batchData;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-8">
        <div className="flex items-center p-6">
          <div className="relative w-24 h-24 mr-6">
            <Image
              src={placeholderImage}
              alt={`Batch ${params.id}`}
              fill
              className="rounded-lg object-cover"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2 dark:text-white">
                            Batch {batchId.toString()}
            </h1>
            <BatchInfo batchData={batchData} />
          </div>
        </div>
      </div>
      <h2 className="text-2xl font-semibold mb-4 dark:text-white">
                Tokens in this Batch
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {tokenIds && tokenIds.length > 0
          ? (
            tokenIds.map((tokenId: bigint) => (
              <Link
                key={tokenId.toString()}
                href={`/token/${tokenId.toString()}`}
              >
                <TokenCard
                  tokenId={tokenId}
                  isCompact={false}
                />
              </Link>
            ))
          )
          : (
            <p className="dark:text-white">
                            No tokens available for this batch.
            </p>
          )}
      </div>
    </div>
  );
}
