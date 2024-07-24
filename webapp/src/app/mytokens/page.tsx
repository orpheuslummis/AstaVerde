"use client";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { BatchCard } from "../../components/BatchCard";
import { Batch } from "../../lib/batch";
import { astaverdeContractConfig } from "../../lib/contracts";

export default function Page() {
	const { address } = useAccount();
	const [batches, setBatches] = useState<Batch[]>([]);
	const [lastBatchIDn, setLastBatchIDn] = useState<number>(0);

	const { data: lastBatchID } = useReadContract({
		...astaverdeContractConfig,
		functionName: "lastBatchID",
	});

	useEffect(() => {
		if (lastBatchID) {
			setLastBatchIDn(Number(lastBatchID));
		}
	}, [lastBatchID]);

	const { data: batchesData, isLoading, error } = useReadContracts({
		contracts: Array.from({ length: lastBatchIDn }, (_, i) => ({
			...astaverdeContractConfig,
			functionName: "getBatchInfo",
			args: [BigInt(i + 1)],
		})),
	});

	if (isLoading) return <div>Loading...</div>;
	if (error) return <div>Error: {error.message}</div>;

	useEffect(() => {
		if (batchesData) {
			const newBatches = batchesData
				.map((result, index) => {
					if (result.status === "success" && Array.isArray(result.result)) {
						const [batchID, tokenIDs, timestamp, price, itemsLeft] = result.result;
						return new Batch(index + 1, tokenIDs, timestamp, price, itemsLeft);
					}
					return null;
				})
				.filter((batch): batch is Batch => batch !== null);
			setBatches(newBatches);
		}
	}, [batchesData]);

	return (
		<div>
			<h1 className="font-bold text-xl py-4">My Tokens</h1>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{batches.map((batch) => (
					<BatchCard key={batch.id} batch={batch} />
				))}
			</div>
		</div>
	);
}