"use client";

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import TokenCard from '../../components/TokenCard';
import { useAppContext } from '../../contexts/AppContext';
import { useContractInteraction } from '../../hooks/useContractInteraction';

const TOKENS_PER_PAGE = 12;

export default function MyTokensPage() {
	const { address, isConnected } = useAccount();
	const [tokens, setTokens] = useState<number[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const { astaverdeContractConfig } = useAppContext();
	const { getTokensOfOwner } = useContractInteraction(astaverdeContractConfig, 'balanceOf');

	useEffect(() => {
		const fetchTokens = async () => {
			if (!isConnected || !address) {
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				console.log(`Fetching tokens for address: ${address}`);
				const result = await getTokensOfOwner(address);
				setTokens(result);
			} catch (err) {
				console.error("Error fetching tokens:", err);
				setError("Failed to fetch tokens. Please try again later.");
			} finally {
				setIsLoading(false);
			}
		};

		fetchTokens();
	}, [address, isConnected, getTokensOfOwner]);

	const totalPages = Math.ceil(tokens.length / TOKENS_PER_PAGE);
	const startIndex = (currentPage - 1) * TOKENS_PER_PAGE;
	const endIndex = startIndex + TOKENS_PER_PAGE;
	const currentTokens = tokens.slice(startIndex, endIndex);

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-8">My Tokens</h1>
			{isLoading ? (
				<p>Loading your tokens...</p>
			) : error ? (
				<p className="text-red-500">{error}</p>
			) : tokens.length === 0 ? (
				<p>You don't have any tokens yet.</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{currentTokens.map((tokenId) => (
							<TokenCard key={tokenId} tokenId={tokenId} />
						))}
					</div>
					<div className="mt-8 flex justify-center">
						<button
							onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
							disabled={currentPage === 1}
							className="px-4 py-2 bg-blue-500 text-white rounded mr-2 disabled:bg-gray-300"
						>
							Previous
						</button>
						<span className="px-4 py-2">
							Page {currentPage} of {totalPages}
						</span>
						<button
							onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
							disabled={currentPage === totalPages}
							className="px-4 py-2 bg-blue-500 text-white rounded ml-2 disabled:bg-gray-300"
						>
							Next
						</button>
					</div>
				</>
			)}
		</div>
	);
}