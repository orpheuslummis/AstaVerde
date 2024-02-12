"use client;";

import { IPFS_GATEWAY_URL, USDC_DECIMALS } from "../app.config";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig, usdcContractConfig } from "../lib/contracts";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
	useAccount,
	useContractRead,
	useContractWrite,
	usePrepareContractWrite,
	useWaitForTransaction,
} from "wagmi";

/*
obtain the first token of the batch
fetch the metadata of the token from IPFS using its CID
obtain the image CID from that metadata
build a URL to the image using the image CID
*/

export default function BatchCard({
	batch,
	updateCard,
}: { batch: Batch; updateCard: () => void }) {
	const [batchImageUrl, setBatchImageUrl] = useState<string>();
	const [tokenAmount, setTokenAmount] = useState(1);

	const { data: batchInfo } = useContractRead({
		...astaverdeContractConfig,
		functionName: "batches",
		args: [BigInt(batch.id)],
	});

	const { data: priceOfBatch } = useContractRead({
		...astaverdeContractConfig,
		functionName: "getBatchPrice",
		args: [BigInt(batch.id)],
	});

	const tokenInfo = useContractRead({
		...astaverdeContractConfig,
		functionName: "tokens",
		enabled: batch.token_ids.length > 0,
		args: [BigInt(batch.token_ids[0])],
	});

	const fetchTokenImageUrl = async (tokenCID: string) => {
		try {
			const response = await fetch(`${IPFS_GATEWAY_URL}${tokenCID}`);
			const metadata = await response.json();
			console.log("BatchCard: fetched token metadata", metadata);
			const imageUrl = metadata.image;
			console.log("BatchCard: fetched image URL", imageUrl);
			return imageUrl;
		} catch (error) {
			console.error("BatchCard: error fetching token metadata", error);
			return null;
		}
	};

	const getFirstBatchTokenCID = async () => {
		if (tokenInfo.data) {
			console.log("BatchCard: tokenInfo", tokenInfo);
			const tokenCID = tokenInfo.data[2];
			console.log("BatchCard: tokenCID", tokenCID);
			return tokenCID;
		}
		return null;
	};

	useEffect(() => {
		const fetchData = async () => {
			if (tokenInfo.data) {
				const firstBatchTokenCID = await getFirstBatchTokenCID();
				if (firstBatchTokenCID) {
					const batchImageCID: string | undefined =
						await fetchTokenImageUrl(firstBatchTokenCID);

					if (batchImageCID) {
						const parts = batchImageCID.split("ipfs://");
						if (parts.length > 1) {
							const CID = parts[1];
							setBatchImageUrl(IPFS_GATEWAY_URL + CID);
						} else {
							setBatchImageUrl(IPFS_GATEWAY_URL + "undefined");
						}
					} else {
						setBatchImageUrl(IPFS_GATEWAY_URL + "undefined");
					}
				}
			}
		};
		void fetchData();
	}, [tokenInfo]);

	return (
		<div className="flex justify-between items-center">
			<div className="flex-1 border rounded-lg overflow-hidden shadow-lg">
				<div className="flex flex-col items-center w-full p-4">
					<div className="w-full h-64 overflow-hidden rounded shadow-lg">
						<img
							className="w-full h-full object-cover"
							src={batchImageUrl}
							alt="Batch Image"
						/>
					</div>
					<div className="w-full mt-4">
						<p className="text-gray-900 font-bold text-2xl">
							Batch {Number(batch.id)}
						</p>
						<p className="text-gray-600">
							{batch ? `${batch.itemsLeft} items left` : "0 items left"}
						</p>
						<p className="text-gray-600">
							{priceOfBatch
								? `${Number(formatUnits(priceOfBatch || BigInt(0), 6))} USDC`
								: "0 USDC"}
						</p>
					</div>

					<div className="w-full mt-4">
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

				<div className="mt-4 p-4">
					<p className="text-black mt-1 font-bold">
						{priceOfBatch
							? `Total: ${
									+Number(
										formatUnits(priceOfBatch || BigInt(0), 6),
									).toString() * tokenAmount
							  } USDC`
							: "Total: 0 USDC"}
					</p>
					<BuyBatchButton
						batchId={batch.id}
						tokenAmount={tokenAmount}
						usdcPrice={
							Number(formatUnits(priceOfBatch || BigInt(0), 6))?.toString() ||
							"0"
						}
						updateCard={updateCard}
					/>
				</div>
			</div>
		</div>
	);
}

function BuyBatchButton({
	batchId,
	tokenAmount,
	usdcPrice,
	updateCard,
}: {
	batchId: number;
	tokenAmount: number;
	usdcPrice: string;
	updateCard: () => void;
}) {
	const totalPrice = tokenAmount * Number(usdcPrice);
	const { address } = useAccount();
	const [awaitedHash, setAwaitedHash] = useState<`0x${string}`>();
	const { data: txReceipt } = useWaitForTransaction({
		hash: awaitedHash,
	});

	const { data: allowance, refetch: refetchAllowance } = useContractRead({
		...usdcContractConfig,
		functionName: "allowance",
		enabled: address !== undefined,
		args: [address!, astaverdeContractConfig.address],
	});

	const { data: balance } = useContractRead({
		...usdcContractConfig,
		functionName: "balanceOf",
		enabled: address !== undefined,
		args: [address!],
	});

	console.log(
		"BatchCard: allowance:",
		Number(formatUnits(allowance || BigInt(0), 6)),
		totalPrice,
	);
	console.log(
		"BatchCard: buyBatch enabled",
		Number(formatUnits(allowance || BigInt(0), 6)) >= totalPrice,
	);

	const { config: configApprove } = usePrepareContractWrite({
		...usdcContractConfig,
		functionName: "approve",
		// enabled: false,
		args: [
			astaverdeContractConfig.address,
			parseUnits(totalPrice.toString(), 6),
		],
	});
	const { writeAsync: approve } = useContractWrite(configApprove);

	const { config: configBuyBatch } = usePrepareContractWrite({
		...astaverdeContractConfig,
		functionName: "buyBatch",
		enabled: Number(formatUnits(allowance || BigInt(0), 6)) >= totalPrice, // allow buyBatch when there is enough allowance
		args: [
			BigInt(batchId),
			parseUnits(totalPrice.toString(), 6),
			BigInt(tokenAmount),
		],
	});
	const { writeAsync: buyBatchAsync } = useContractWrite(configBuyBatch);

	const refreshAllowance = async () => {
		await refetchAllowance();
	};
	useEffect(() => {
		if (txReceipt) {
			void refreshAllowance();

			void updateCard();
		}
	}, [txReceipt]);

	if (tokenAmount < 1) {
		return (
			<>
				<button
					className="mt-4 bg-red-500 text-white font-bold py-2 px-4 rounded w-full"
					disabled
				>
					Set quantity
				</button>
			</>
		);
	}

	if (Number(formatUnits(balance || BigInt(0), 6)) < totalPrice) {
		return (
			<>
				<button
					className="mt-4 bg-red-500 text-white font-bold py-2 px-4 rounded w-full"
					disabled
				>
					Not Enough Balance
				</button>
			</>
		);
	}

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
