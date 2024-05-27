"use client";
import { useAccount, useContractInfiniteReads, useContractRead } from "wagmi";
import astaverdeContractConfig from "../../lib/contracts";
import BatchRedeemCard from "./BatchRedeemCard";

// Define the necessary types
type AbiStateMutability = 'pure' | 'view' | 'nonpayable' | 'payable';
type AbiParameter = {
	internalType: string;
	name: string;
	type: string;
};
type AbiFunction = {
	inputs: AbiParameter[];
	stateMutability: AbiStateMutability;
	type: "function";
	name: string;
	outputs: AbiParameter[];
};

// Filter and type the ABI functions correctly
const functionAbi = astaverdeContractConfig.abi.filter(
	(item: any): item is AbiFunction => item.type === "function"
) as AbiFunction[];

type BatchInfo = {
	id: number;
	token_ids: number[];
	creationTime: number;
	price: number;
	remainingTokens: number;
};

type ContractResult = {
	error?: Error;
	result?: BatchInfo[];
	status: 'idle' | 'error' | 'loading' | 'success';
};

export default function Page() {
	const { data: lastBatchID } = useContractRead({
		...astaverdeContractConfig,
		functionName: "lastBatchID",
	});
	const { address } = useAccount();

	const lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

	const { data, error, fetchNextPage, isFetchingNextPage, hasNextPage } = useContractInfiniteReads({
		cacheKey: "batchMetadata",
		contracts: (pageParam: number) => [
			{
				address: astaverdeContractConfig.address as `0x${string}`,
				abi: functionAbi,
				functionName: "getBatchInfo",
				args: [pageParam] as const,
			},
		],
		getNextPageParam: (lastPage, allPages) => {
			if (!lastPage || !Array.isArray(lastPage[0]?.result) || lastPage[0].result.length === 0) {
				return undefined;
			}
			return lastBatchIDn - allPages.length;
		},
	});

	if (error) {
		return <div>Could not display, sorry.</div>;
	}

	const batches: BatchInfo[] = data?.pages?.flatMap((page) =>
		page[0]?.status === "success" && Array.isArray(page[0]?.result)
			? (page[0].result as BatchInfo[]).map((batch) => ({
				id: batch.id || 0,
				token_ids: batch.token_ids || [],
				creationTime: batch.creationTime || 0,
				price: batch.price || 0,
				remainingTokens: batch.remainingTokens || 0,
			}))
			: []
	) || [];

	if (!address) {
		return (
			<div className="flex w-full min-h-[calc(100vh-64px)] justify-center items-center text-lg font-bold">
				Please connect wallet first
			</div>
		);
	}

	return (
		<div>
			<h1 className="font-bold text-xl py-4">My Tokens</h1>
			<div className="flex flex-col gap-2">
				{batches.map((batch) => (
					<BatchRedeemCard key={batch.id} batch={batch} />
				))}
			</div>
			{hasNextPage && (
				<button
					onClick={() => fetchNextPage()}
					disabled={isFetchingNextPage}
				>
					{isFetchingNextPage ? 'Loading more...' : 'Load More'}
				</button>
			)}
		</div>
	);
}