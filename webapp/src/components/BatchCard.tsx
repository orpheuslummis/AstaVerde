import { useState, useEffect } from "react";
import {
	useAccount,
	useContractRead,
	useContractWrite,
	usePrepareContractWrite,
	useWaitForTransaction,
} from "wagmi";
import { IPFS_GATEWAY_URL, USDC_DECIMALS } from "../app.config";
import { Batch } from "../lib/batch";
import {
	astaverdeContractConfig,
	getUsdcContractConfig,
} from "../lib/contracts";
import { Abi, formatUnits, parseUnits } from "viem";

interface TokenInfoData {
	tokenId: string;
	producer: string;
	cid: string;
	isRedeemed: boolean;
}

export default function BatchCard({
	batch,
	updateCard,
}: {
	batch: Batch;
	updateCard: () => void;
}) {
	const [batchImageUrl, setBatchImageUrl] = useState<string | null>(null);
	const [tokenAmount, setTokenAmount] = useState(1);

	const { data: batchInfo } = useContractRead({
		address: astaverdeContractConfig.address,
		abi: astaverdeContractConfig.abi,
		functionName: "batches",
		args: [BigInt(batch.id)],
	});

	const { data: priceOfBatch } = useContractRead({
		address: astaverdeContractConfig.address,
		abi: astaverdeContractConfig.abi,
		functionName: "getBatchPrice",
		args: [BigInt(batch.id)],
	});

	const { data: tokenInfo } = useContractRead({
		address: astaverdeContractConfig.address,
		abi: astaverdeContractConfig.abi,
		functionName: "tokens",
		enabled: batch.token_ids.length > 0,
		args: [BigInt(batch.token_ids[0])],
	}) as { data?: TokenInfoData };

	const fetchTokenImageUrl = async (tokenCID: string): Promise<string | null> => {
		try {
			const response = await fetch(`${IPFS_GATEWAY_URL}${tokenCID}`);
			const metadata = await response.json();
			return metadata.image || null;
		} catch (error) {
			console.error("Error fetching token metadata:", error);
			return null;
		}
	};

	useEffect(() => {
		if (tokenInfo) {
			const fetchImage = async () => {
				const tokenCID = tokenInfo.cid;
				if (tokenCID) {
					const imageUrl = await fetchTokenImageUrl(tokenCID);
					if (imageUrl) {
						const parts = imageUrl.split("ipfs://");
						setBatchImageUrl(parts.length > 1 ? `${IPFS_GATEWAY_URL}${parts[1]}` : null);
					}
				}
			};
			fetchImage();
		}
	}, [tokenInfo]);

	const priceInUSDC = priceOfBatch ? Number(formatUnits(priceOfBatch as bigint, USDC_DECIMALS)) : 0;

	return (
		<div className="flex justify-between items-center">
			<div className="flex-1 border rounded-lg overflow-hidden shadow-lg">
				<div className="flex flex-col items-center w-full p-4">
					<div className="w-full h-64 overflow-hidden rounded shadow-lg">
						<img
							className="w-full h-full object-cover"
							src={batchImageUrl || "/placeholder.png"}
							alt="Batch"
						/>
					</div>
					<div className="w-full mt-4">
						<p className="text-gray-900 font-bold text-2xl">
							Batch {Number(batch.id)}
						</p>
						<p className="text-gray-600">{batch.itemsLeft} items left</p>
						<p className="text-gray-600">{priceInUSDC} USDC</p>
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
							min={1}
						/>
					</div>
				</div>

				<div className="mt-4 p-4">
					<p className="text-black mt-1 font-bold">
						Total: {priceInUSDC * tokenAmount} USDC
					</p>
					<BuyBatchButton
						batchId={batch.id}
						tokenAmount={tokenAmount}
						usdcPrice={priceInUSDC}
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
	usdcPrice: number;
	updateCard: () => void;
}) {
	const totalPrice = tokenAmount * usdcPrice;
	const { address } = useAccount();
	const [awaitedHash, setAwaitedHash] = useState<`0x${string}`>();
	const [isApproving, setIsApproving] = useState(false);
	const [isBuying, setIsBuying] = useState(false);

	const { data: txReceipt } = useWaitForTransaction({ hash: awaitedHash });

	const usdcContractConfig = getUsdcContractConfig();
	const { data: allowanceData, refetch: refetchAllowance } = useContractRead({
		address: usdcContractConfig.address,
		abi: usdcContractConfig.abi as Abi,
		functionName: "allowance",
		enabled: !!address,
		args: [address!, astaverdeContractConfig.address],
	});
	const allowance = BigInt(allowanceData?.toString() ?? "0");
	const { data: balanceData } = useContractRead({
		address: usdcContractConfig.address,
		abi: usdcContractConfig.abi as Abi,
		functionName: "balanceOf",
		enabled: !!address,
		args: [address!],
	});
	const balance = BigInt(balanceData?.toString() ?? "0");
	const { config: configApprove } = usePrepareContractWrite({
		address: usdcContractConfig.address,
		abi: usdcContractConfig.abi as Abi,
		functionName: "approve",
		args: [astaverdeContractConfig.address, parseUnits(totalPrice.toString(), USDC_DECIMALS)],
	});
	const { writeAsync: approve } = useContractWrite(configApprove);

	const { config: configBuyBatch } = usePrepareContractWrite({
		address: astaverdeContractConfig.address,
		abi: astaverdeContractConfig.abi,
		functionName: "buyBatch",
		enabled: Number(formatUnits(allowance, USDC_DECIMALS)) >= totalPrice,
		args: [BigInt(batchId), parseUnits(totalPrice.toString(), USDC_DECIMALS), BigInt(tokenAmount)],
	});
	const { writeAsync: buyBatchAsync } = useContractWrite(configBuyBatch);

	useEffect(() => {
		if (txReceipt) {
			refetchAllowance();
			updateCard();
		}
	}, [txReceipt, refetchAllowance, updateCard]);

	if (tokenAmount < 1) {
		return <Button disabled>Set quantity</Button>;
	}

	if (Number(formatUnits(balance, USDC_DECIMALS)) < totalPrice) {
		return <Button disabled>Not Enough Balance</Button>;
	}

	if (Number(formatUnits(allowance, USDC_DECIMALS)) < totalPrice) {
		return (
			<Button
				disabled={isApproving}
				onClick={async () => {
					if (approve) {
						setIsApproving(true);
						const result = await approve();
						setAwaitedHash(result.hash);
						setIsApproving(false);
					}
				}}
			>
				Approve USDC
			</Button>
		);
	}

	return (
		<Button
			disabled={isBuying}
			onClick={async () => {
				if (buyBatchAsync) {
					setIsBuying(true);
					const result = await buyBatchAsync();
					setAwaitedHash(result.hash);
					setIsBuying(false);
				}
			}}
		>
			Buy
		</Button>
	);
}

function Button({
	disabled,
	onClick,
	children,
}: {
	disabled: boolean;
	onClick?: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			className={`mt-4 py-2 px-4 rounded w-full ${disabled ? "bg-red-500" : "bg-primary hover:bg-green-700"} text-white font-bold`}
			disabled={disabled}
			type="button"
			onClick={onClick}
		>
			{children}
		</button>
	);
}
