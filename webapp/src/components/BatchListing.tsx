import { useEffect, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig } from "../lib/contracts";
import { BatchCard } from "./BatchCard";

const BatchListing = () => {
  const [batches, setBatches] = useState<Batch[]>([]);

  const { data: lastBatchID, isLoading: isLastBatchIDLoading, isError: isLastBatchIDError, error: lastBatchIDError } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "lastBatchID",
  });

  useEffect(() => {
    if (lastBatchIDError) {
      console.error("Error fetching lastBatchID:", lastBatchIDError);
    }
  }, [lastBatchIDError]);

  const { data: batchesData, isLoading: isBatchesLoading, isError: isBatchesError, error: batchesError } = useReadContracts({
    contracts: lastBatchID && lastBatchID > 0n ? Array.from({ length: Number(lastBatchID) }, (_, i) => ({
      ...astaverdeContractConfig,
      functionName: "getBatchInfo",
      args: [BigInt(i + 1)],
    })) : [],
    allowFailure: false,
  });

  useEffect(() => {
    console.log("Last Batch ID:", lastBatchID);
    console.log("Last Batch ID Error:", isLastBatchIDError);
    console.log("Last Batch ID Loading:", isLastBatchIDLoading);
    console.log("AstaVerde Contract Config:", astaverdeContractConfig);
    console.log("AstaVerde Contract Address:", astaverdeContractConfig.address);
    console.log("Current Chain ID:", chain?.id);
  }, [lastBatchID, isLastBatchIDError, isLastBatchIDLoading]);

  useEffect(() => {
    console.log("Batches Data:", batchesData);
    console.log("Batches Error:", isBatchesError);
    console.log("Batches Loading:", isBatchesLoading);
    console.log("Last Batch ID (in batches effect):", lastBatchID);

    if (batchesData && Array.isArray(batchesData)) {
      try {
        const newBatches = batchesData
          .map((result, index) => {
            console.log(`Processing batch ${index + 1}:`, result);
            if (!result || !Array.isArray(result) || result.length < 5) {
              console.error(`Invalid batch data for index ${index}:`, result);
              return null;
            }
            const [batchId, tokenIds, creationTime, price, remainingTokens] = result;
            return new Batch(batchId, tokenIds, creationTime, price, remainingTokens);
          })
          .filter((batch): batch is Batch => batch !== null);
        console.log("New Batches:", newBatches);
        setBatches(newBatches);
      } catch (error) {
        console.error("Error processing batch data:", error);
      }
    }
  }, [batchesData, isBatchesError, batchesError, isBatchesLoading, lastBatchID]);

  if (isLastBatchIDLoading || isBatchesLoading) {
    return <div>Loading batch data...</div>;
  }

  if (isLastBatchIDError || isBatchesError) {
    return <div className="text-red-500">Failed to fetch batch information. Please try again later.</div>;
  }

  if (lastBatchID === undefined) {
    return <div>Waiting for contract data...</div>;
  }

  if (lastBatchID === 0n || lastBatchID === undefined) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-124px)]">
        <p className="text-xl font-semibold">No batches available yet. Please mint some batches first.</p>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-124px)]">
        <p className="text-xl font-semibold">No batches found. There might be an issue with fetching batch data.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {batches.map((batch) => (
        <BatchCard key={batch.id} batch={batch} />
      ))}
    </div>
  );
};

export default BatchListing;