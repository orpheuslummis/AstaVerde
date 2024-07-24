import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContracts, useSimulateContract, useWriteContract } from "wagmi";
import { IPFS_GATEWAY_URL, USDC_DECIMALS } from "../app.config";
import { Batch } from "../lib/batch";
import { astaverdeContractConfig, getUsdcContractConfig } from "../lib/contracts";
import { customToast } from '../utils/customToast';
import { getPlaceholderImageUrl } from "../utils/placeholderImage";

interface BatchCardProps {
	batch: Batch;
	updateCard?: () => void;
}

export const BatchCard = ({ batch, updateCard }: BatchCardProps) => {
	const [tokenAmount, setTokenAmount] = useState(1);
	const { address, isConnected, status, chain } = useAccount();

	useEffect(() => {
		console.log("Wallet status:", status);
		console.log("Is connected:", isConnected);
		console.log("Chain:", chain);
		console.log("Address:", address);

		if (status === 'connecting') {
			customToast.info("Connecting to wallet...");
		} else if (status === 'connected') {
			customToast.success(`Connected to ${chain?.name || 'network'}`);
		} else if (status === 'disconnected') {
			customToast.error("Disconnected from wallet");
		}
	}, [status, chain, isConnected, address]);

	const { data: usdcBalanceData, isLoading: isBalanceLoading, error: balanceError } = useReadContracts({
		contracts: [
			{
				address: getUsdcContractConfig().address,
				abi: erc20Abi,
				functionName: 'balanceOf',
				args: [address],
			},
			{
				address: getUsdcContractConfig().address,
				abi: erc20Abi,
				functionName: 'decimals',
			}
		],
		enabled: isConnected,
	});

	const usdcBalance = usdcBalanceData ? {
		value: usdcBalanceData[0].result,
		decimals: usdcBalanceData[1].result,
	} : null;

	const priceInUSDC = formatUnits(batch.price, USDC_DECIMALS);
	const totalPrice = Number(priceInUSDC) * tokenAmount;

	const { data: simulateApprove, error: simulateError } = useSimulateContract({
		...getUsdcContractConfig(),
		functionName: "approve",
		args: [astaverdeContractConfig.address, parseUnits(totalPrice.toString(), USDC_DECIMALS)],
		account: address,
	});

	const { writeContract: approveUsdc, isPending: isApprovePending } = useWriteContract();
	const { writeContract: buyBatch, isPending: isBuyPending } = useWriteContract();

	const placeholderImage = useMemo(() => getPlaceholderImageUrl(batch.id), [batch.id]);

	const hasEnoughBalance = usdcBalance && usdcBalance.value >= parseUnits(totalPrice.toString(), USDC_DECIMALS);
	const canBuy = !isApprovePending && !isBuyPending && !!address && !!simulateApprove?.request && hasEnoughBalance;

	const isLoading = isApprovePending || isBuyPending;

	const handleBuy = async () => {
		if (!address || !simulateApprove?.request) {
			console.error("Cannot buy: address or simulate request missing");
			return;
		}

		try {
			// Approve USDC spending
			await approveUsdc(simulateApprove.request);

			// Buy the batch
			await buyBatch({
				...astaverdeContractConfig,
				functionName: "buyBatch",
				args: [BigInt(batch.id), parseUnits(totalPrice.toString(), USDC_DECIMALS), BigInt(tokenAmount)],
			});

			if (updateCard) updateCard();
			customToast.success("Purchase successful! 🌿 You've just acquired an EcoAsset!");
		} catch (err) {
			console.error("Error in handleBuy:", err);
			customToast.error(`Oops! ${err.message || "An error occurred while buying the batch."}`);
		}
	};

	return (
		<Card
			title={`Batch ${batch.id}`}
			image={batch.cid ? `${IPFS_GATEWAY_URL}${batch.cid}` : placeholderImage}
			content={
				<>
					<p>{batch.itemsLeft} items left</p>
					<p>{priceInUSDC} USDC</p>
					<div className="mt-4">
						<p>Select quantity</p>
						<input
							type="number"
							min="1"
							max={batch.itemsLeft}
							value={tokenAmount}
							onChange={(e) => setTokenAmount(Number(e.target.value))}
							className="w-full p-2 border rounded"
						/>
						<p className="mt-2 font-bold">Total: {totalPrice.toFixed(2)} USDC</p>
						<button
							onClick={handleBuy}
							disabled={!canBuy}
							className={`w-full mt-2 p-2 rounded ${canBuy
								? "bg-green-500 text-white hover:bg-green-600"
								: "bg-gray-400 text-gray-200 cursor-not-allowed"
								} relative overflow-hidden group`}
						>
							<span className="relative z-10">
								{isLoading ? "Processing..." : "Buy"}
							</span>
							{canBuy && (
								<div className="absolute inset-0 w-full h-full transition-all duration-300 scale-0 group-hover:scale-100 group-active:scale-95 bg-green-400 opacity-30">
									<div className="w-full h-full bg-gradient-to-br from-transparent via-green-300 to-transparent"></div>
								</div>
							)}
						</button>
						{isBalanceLoading ? (
							<p className="text-yellow-500 mt-2">Loading USDC balance... This may take a moment.</p>
						) : balanceError ? (
							<p className="text-red-500 mt-2">Error loading USDC balance. Please try again later.</p>
						) : !isConnected ? (
							<p className="text-yellow-500 mt-2">Please connect your wallet to view USDC balance.</p>
						) : !hasEnoughBalance ? (
							<p className="text-red-500 mt-2">
								Insufficient USDC balance. You have {usdcBalance ? formatUnits(usdcBalance.value, USDC_DECIMALS) : '0'} USDC
							</p>
						) : null}
						{usdcBalance && !isBalanceLoading && !balanceError && (
							<p className="text-gray-600 mt-2">Your USDC balance: {formatUnits(usdcBalance.value, USDC_DECIMALS)} USDC</p>
						)}
						{simulateError && (
							<p className="text-red-500 mt-2">Error: {simulateError.message}</p>
						)}
					</div>
				</>
			}
			footer={null}
		/>
	);
};