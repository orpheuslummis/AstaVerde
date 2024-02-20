"use client";

/*
mode: all, redeemed, not-redeemed
start: the latest batch
perPage: 10
*/
import { Batch } from "../../lib/batch";
import { astaverdeContractConfig } from "../../lib/contracts";
import Link from "next/link";
import {
	ChangeEvent,
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";
import { TransactionReceipt } from "viem";
import {
	paginatedIndexesConfig,
	useAccount,
	useContractInfiniteReads,
	useContractRead,
	useContractWrite,
	usePrepareContractWrite,
	useWaitForTransaction,
} from "wagmi";

export default function Page() {
	const {
		data: lastBatchID,
		isError,
		isLoading,
		error: lastBatchIDError,
	} = useContractRead({
		...astaverdeContractConfig,
		functionName: "lastBatchID",
	});
	const { address } = useAccount();

	if (lastBatchIDError || lastBatchID === undefined) {
		console.log("lastBatchIDError", lastBatchIDError);
	}
	const lastBatchIDn: number = lastBatchID ? Number(lastBatchID) : 0;

	console.log(
		"lastBatchIDn, isError, isLoading",
		lastBatchID,
		isError,
		isLoading,
	);

	const { data, fetchNextPage, error } = useContractInfiniteReads({
		cacheKey: "batchMetadata",
		...paginatedIndexesConfig(
			(batchID: bigint) => {
				console.log("fetching batchID", batchID);
				return [
					{
						...astaverdeContractConfig,
						functionName: "getBatchInfo",
						args: [batchID] as const,
					},
				];
			},
			{ start: lastBatchIDn, perPage: 10, direction: "decrement" },
		),
	});
	console.log("data", data);

	if (error) {
		console.log("error", error);
		return <div>Could not display, sorry.</div>;
	}

	const batches: Batch[] =
		data?.pages?.flatMap((page: any[]) =>
			page?.map((batch: any) => {
				const batchID = batch.result?.[0] || 0;
				const tokenIDs: number[] = batch.result?.[1] || [];
				const timestamp: number = batch.result?.[2] || 0;
				const price: number = batch.result?.[3] || 0;
				const itemsLeft: number = batch.result?.[4] || 0;
				const batchProper = new Batch(
					batchID,
					tokenIDs,
					timestamp,
					price,
					itemsLeft,
				);
				return batchProper;
			}),
		) || [];

	if (!address) {
		return (
			<>
				<div className="flex w-full min-h-[calc(100vh-64px)] justify-center items-center text-lg font-bold">
					Please connect wallet first
				</div>
			</>
		);
	}

	return (
		<>
			<div>
				<h1 className="font-bold text-xl py-4">My Tokens</h1>

				{/* loop through the batch ids */}
				<div className="flex flex-col gap-2">
					{batches.map((batch) => (
						<>
							<BatchRedeemCard batch={batch} />
						</>
					))}
				</div>
			</div>
		</>
	);
}

function BatchRedeemCard({ batch }: { batch: Batch }) {
	const { address } = useAccount();
	const [sameAddresses, setSameAddresses] = useState<`0x${string}`[]>();
	const [redeemableTokens, setRedeemableTokens] = useState<bigint[]>([]);
	const [awaitedHash, setAwaitedHash] = useState<`0x${string}`>();
	const { data: txReceipt } = useWaitForTransaction({
		hash: awaitedHash,
	});

	console.log("batch in mytokens: ", batch);

	useEffect(() => {
		if (address && batch) {
			const _sameAddresses: `0x${string}`[] = [];
			// Use a for loop to fill the array
			for (let i = 0; i < batch.token_ids.length; i++) {
				_sameAddresses.push(address);
			}

			setSameAddresses(_sameAddresses);
		}
	}, [batch, address]);

	const { data: ownedIndex } = useContractRead({
		...astaverdeContractConfig,
		functionName: "balanceOfBatch",
		enabled: sameAddresses !== undefined,
		args: [sameAddresses || [], batch.token_ids as unknown as bigint[]],
	});

	const ownerTokens = useCallback(() => {
		if (ownedIndex) {
			return batch.token_ids.filter(
				(_, index) => +ownedIndex[index].toString() === 1,
			);
		}
	}, [batch.token_ids, ownedIndex]);

	const { config } = usePrepareContractWrite({
		...astaverdeContractConfig,
		functionName: "redeemTokens",
		enabled: redeemableTokens.length > 0,
		args: [redeemableTokens],
	});
	const { writeAsync: redeemTokens } = useContractWrite(config);

	console.log("redeem", redeemableTokens);

	// Do not show if user does not have any token
	if (ownerTokens() && ownerTokens()!.length === 0) {
		return <></>;
	}

	return (
		<>
			<div className="bg-white rounded-lg shadow-md p-4">
				<h2 className="text-lg font-semibold">Batch {Number(batch.id)}</h2>
				{/* <p className="mt-2">Token IDs</p> */}
				{ownerTokens()?.map((redeemableToken) => (
					<>
						<RedeemableTokenNumber
							txReceipt={txReceipt}
							redeemableToken={redeemableToken}
							setRedeemableTokens={setRedeemableTokens}
						/>
					</>
				))}

				{/* <div className="pt-2">Redeem amount: {redeemTokens && redeemTokens.length}</div> */}

				<div className="w-full flex justify-between">
					<button
						className={`mt-4 font-bold py-2 px-4 rounded text-white ${
							redeemTokens
								? "bg-primary hover:bg-green-700"
								: "bg-gray-400 cursor-not-allowed"
						}`}
						type="button"
						disabled={!redeemTokens}
						onClick={async () => {
							console.log(redeemableTokens);
							if (redeemTokens) {
								const result = await redeemTokens();
								setAwaitedHash(result.hash);
							}
						}}
					>
						Redeem
					</button>
				</div>
			</div>
		</>
	);
}

function RedeemableTokenNumber({
	txReceipt,
	redeemableToken,
	setRedeemableTokens,
}: {
	txReceipt: TransactionReceipt | undefined;
	redeemableToken: number;
	setRedeemableTokens: Dispatch<SetStateAction<bigint[]>>;
}) {
	const { data: tokenInfo, refetch: refreshTokenInfo } = useContractRead({
		...astaverdeContractConfig,
		functionName: "tokens",
		args: [BigInt(redeemableToken)],
	});
	console.log(
		"🚀 ~ file: page.tsx:160 ~ RedeemableTokens ~ tokenInfo:",
		tokenInfo,
	);

	const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
		const isChecked = event.target.checked;

		if (isChecked) {
			// If the checkbox is checked, add the number to the array
			setRedeemableTokens((redeemableTokens) => [
				...redeemableTokens,
				BigInt(redeemableToken),
			]);
		} else {
			// If the checkbox is unchecked, remove the number from the array
			setRedeemableTokens((redeemableTokens) =>
				redeemableTokens.filter((n) => n !== BigInt(redeemableToken)),
			);
		}
	};

	useEffect(() => {
		if (txReceipt) {
			void refreshTokenInfo();
		}
	}, [txReceipt, refreshTokenInfo]);

	return (
		<>
			<div>
				{tokenInfo && (
					<>
						<Link href={`/token/${tokenInfo[0].toString()}`}>
							Token {tokenInfo[0].toString()}
						</Link>
					</>
				)}
				: {tokenInfo?.[3] === false ? "Not redeemed" : "Redeemed"}
				{tokenInfo?.[3] === false ? (
					<input
						className="ml-2"
						type="checkbox"
						value="1"
						onChange={(e) => handleCheckboxChange(e)}
					/>
				) : (
					<></>
				)}
			</div>
		</>
	);
}
