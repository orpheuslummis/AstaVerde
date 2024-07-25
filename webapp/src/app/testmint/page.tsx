"use client";

import { useState } from "react";
import { useAccount, useBalance, useSimulateContract, useWriteContract } from "wagmi";
import { USDC_DECIMALS } from "../../app.config";
import { AppProvider } from '../../contexts/AppContext';
import {
	astaverdeContractConfig,
	getUsdcContractConfig,
} from "../../lib/contracts";

interface TokenData {
	name: string;
	description: string;
	producerAddress: string;
}

export default function TestMintPage() {
	return (
		<AppProvider>
			<Page />
		</AppProvider>
	);
}

function Page() {
	const { address, isConnected } = useAccount();
	const tenthousand = 10000n * 10n ** BigInt(USDC_DECIMALS);
	const [awaitedHash, setAwaitedHash] = useState<`0x${string}`>();
	const usdcContractConfig = getUsdcContractConfig();
	const [tokenData, setTokenData] = useState<TokenData[]>([{ name: '', description: '', producerAddress: '' }]);

	const { data: simulateApproveResult, error: approveSimulateError } = useSimulateContract({
		...usdcContractConfig,
		functionName: "approve",
		args: [astaverdeContractConfig.address, tenthousand],
	});

	const { data: simulateMintResult, error: mintSimulateError } = useSimulateContract({
		...usdcContractConfig,
		functionName: "mint",
		args: address ? [address, tenthousand] : undefined,
		query: {
			enabled: !!address
		}
	});

	const { data: simulateAstaVerdeMintResult, error: astaVerdeMintSimulateError } = useSimulateContract({
		...astaverdeContractConfig,
		functionName: "mint",
		args: address ? [address, tenthousand] : undefined,
		query: {
			enabled: !!address
		}
	});

	const {
		writeContractAsync,
		isPending: isWriteLoading,
	} = useWriteContract();

	const mintUSDC = async () => {
		if (!address || !simulateMintResult?.request) return;
		try {
			const hash = await writeContractAsync(simulateMintResult.request);
			setAwaitedHash(hash);
		} catch (error) {
			console.error("Error minting USDC:", error);
		}
	};

	const handleApprove = async () => {
		if (!simulateApproveResult?.request) return;
		try {
			const hash = await writeContractAsync(simulateApproveResult.request);
			console.log("USDC approved, transaction hash:", hash);
		} catch (err) {
			console.error("Failed to approve USDC:", err);
		}
	};

	const handleMint = async () => {
		if (!address || !simulateAstaVerdeMintResult?.request) return;
		try {
			const hash = await writeContractAsync(simulateAstaVerdeMintResult.request);
			setAwaitedHash(hash);
		} catch (error) {
			console.error("Error minting AstaVerde Token:", error);
		}
	};

	const [isSimulating, setIsSimulating] = useState(false);

	const { data: simulateMintBatchResult, error: mintBatchSimulateError, refetch: refetchSimulation } = useSimulateContract({
		...astaverdeContractConfig,
		functionName: "mintBatch",
		args: [tokenData.map(t => t.producerAddress), tokenData.map(t => JSON.stringify(t))],
		query: {
			enabled: false
		}
	});

	const { data: usdcBalance } = useBalance({
		address,
		token: usdcContractConfig.address,
	});

	const handleTokenDataChange = (index: number, field: keyof TokenData, value: string) => {
		const newTokenData = [...tokenData];
		newTokenData[index] = { ...newTokenData[index], [field]: value };
		setTokenData(newTokenData);
	};

	const handleAddToken = () => {
		setTokenData([...tokenData, { name: '', description: '', producerAddress: '' }]);
	};

	const handleMintBatch = async () => {
		setIsSimulating(true);
		try {
			const result = await refetchSimulation();
			console.log("Simulation result:", result);  // Add this line for debugging
			if (result.data && result.data.request) {
				const hash = await writeContractAsync(result.data.request);
				setAwaitedHash(hash);
			} else {
				console.error("Simulation failed or returned no data", result);
			}
		} catch (error) {
			console.error("Error minting batch:", error);
		} finally {
			setIsSimulating(false);
		}
	};

	return (
		<div className="flex flex-col items-center space-y-4">
			<h1 className="text-2xl font-bold mb-4">USDC Minting, Approval, and Batch Minting</h1>

			{isConnected ? (
				<div className="flex flex-col items-center space-y-2">
					<p>Connected Address: {address}</p>
					<p>Your USDC Balance: {usdcBalance ? parseFloat(usdcBalance.formatted).toFixed(2) : 'Loading...'} USDC</p>
				</div>
			) : (
				<p>Please connect your wallet to use this page.</p>
			)}

			<button
				className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
				onClick={mintUSDC}
				disabled={!address}
			>
				Mint 10000 USDC
			</button>

			<button
				className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
				onClick={handleApprove}
				disabled={!address}
			>
				Approve USDC
			</button>

			<button
				className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full"
				onClick={handleMint}
				disabled={!address}
			>
				Mint AstaVerde Token
			</button>

			<div className="mt-8">
				<h2 className="text-xl font-bold mb-4">Batch Minting</h2>
				{tokenData.map((token, index) => (
					<div key={index} className="mb-4 p-4 border rounded">
						<input
							type="text"
							placeholder="Token Name"
							value={token.name}
							onChange={(e) => handleTokenDataChange(index, 'name', e.target.value)}
							className="w-full p-2 mb-2 border rounded"
						/>
						<input
							type="text"
							placeholder="Token Description"
							value={token.description}
							onChange={(e) => handleTokenDataChange(index, 'description', e.target.value)}
							className="w-full p-2 mb-2 border rounded"
						/>
						<input
							type="text"
							placeholder="Producer Address"
							value={token.producerAddress}
							onChange={(e) => handleTokenDataChange(index, 'producerAddress', e.target.value)}
							className="w-full p-2 mb-2 border rounded"
						/>
					</div>
				))}
				<button
					type="button"
					onClick={handleAddToken}
					className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-2"
				>
					Add Token
				</button>
				<button
					type="button"
					onClick={handleMintBatch}
					disabled={isSimulating || isWriteLoading || tokenData.some(t => !t.name || !t.description || !t.producerAddress)}
					className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
				>
					{isSimulating ? 'Simulating...' : isWriteLoading ? 'Minting...' : 'Mint Batch'}
				</button>
			</div>
			{
				awaitedHash && (
					<p className="mt-4">Transaction Hash: {awaitedHash}</p>
				)
			}
		</div>
	);
}