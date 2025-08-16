"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import Link from "next/link";
import TokenCard from "../../components/TokenCard";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import RedeemTokensButton from "./RedeemTokensButton";
import VaultCard from "../../components/VaultCard";
import { useVault } from "../../hooks/useVault";
import { fetchJsonFromIpfsWithFallback, resolveIpfsUriToUrl } from "../../utils/ipfsHelper";

type TabType = 'all' | 'available' | 'vaulted';

interface TokenMetadata {
    name: string;
    description: string;
    image: string;
}

interface TokenGroup {
    batchId: string;
    name: string;
    description?: string;
    availableTokenIds: bigint[];
    vaultedTokenIds: bigint[];
    availableCount: number;
    vaultedCount: number;
    totalCount: number;
    metadata?: TokenMetadata;
    imageUrl?: string;
}

/**
 * MyTokensPage - Grouped by token batches/collections
 */
export default function MyTokensPage() {
    const { address } = useAccount();
    const [tokens, setTokens] = useState<bigint[]>([]);
    const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});
    const [vaultedTokens, setVaultedTokens] = useState<bigint[]>([]);
    const [redeemStatus, setRedeemStatus] = useState<Record<string, boolean>>({});
    const [tokenMetadata, setTokenMetadata] = useState<Record<string, TokenMetadata>>({});
    const [selectedTokens, setSelectedTokens] = useState<Set<bigint>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [batchData, setBatchData] = useState<Map<bigint, any>>(new Map());
    
    const { astaverdeContractConfig } = useAppContext();
    const { 
        getUserLoans, 
        isVaultAvailable, 
        getSccBalance, 
        deposit, 
        depositBatch,
        vaultVersion,
        approveNFT 
    } = useVault();
    const { execute: getTokensOfOwner } = useContractInteraction(
        astaverdeContractConfig,
        "balanceOf",
    );
    const { execute: getTokenInfo } = useContractInteraction(
        astaverdeContractConfig,
        "tokens",
    );
    const { execute: getLastTokenID } = useContractInteraction(
        astaverdeContractConfig,
        "lastTokenID",
    );
    const { execute: fetchTokenURI } = useContractInteraction(
        astaverdeContractConfig,
        "uri",
    );
    const { execute: getLastBatchID } = useContractInteraction(
        astaverdeContractConfig,
        "lastBatchID",
    );
    const { execute: getBatchInfo } = useContractInteraction(
        astaverdeContractConfig,
        "getBatchInfo",
    );

    const fetchTokens = useCallback(async () => {
        if (!address) return;
        try {
            setIsLoading(true);

            const lastTokenID = await getLastTokenID();
            if (lastTokenID === undefined || lastTokenID === null) {
                throw new Error("Failed to fetch last token ID");
            }

            // Fetch all batch information in parallel
            const lastBatchID = await getLastBatchID();
            const batchMap = new Map<bigint, any>();
            
            if (lastBatchID && lastBatchID > 0n) {
                // Create array of batch IDs to fetch
                const batchIds = Array.from({ length: Number(lastBatchID) }, (_, i) => BigInt(i + 1));
                
                // Fetch all batches in parallel
                const batchPromises = batchIds.map(async (batchId) => {
                    try {
                        const batch = await getBatchInfo(batchId);
                        return { batchId, batch };
                    } catch (err) {
                        console.error(`Failed to fetch batch ${batchId}:`, err);
                        return null;
                    }
                });
                
                const batchResults = await Promise.all(batchPromises);
                
                // Process results
                batchResults.forEach(result => {
                    if (result && result.batch) {
                        batchMap.set(result.batchId, result.batch);
                    }
                });
            }
            setBatchData(batchMap);
            
            const userTokens: bigint[] = [];
            const balances: Record<string, bigint> = {};
            const metadata: Record<string, TokenMetadata> = {};
            
            for (let i = 1n; i <= lastTokenID; i++) {
                const balance = await getTokensOfOwner(address, i);
                if (balance && balance > 0n) {
                    // Add the token multiple times if balance > 1
                    for (let j = 0n; j < balance; j++) {
                        userTokens.push(i);
                    }
                    balances[i.toString()] = balance;
                    
                    // Fetch metadata for each unique token type
                    if (!metadata[i.toString()]) {
                        try {
                            const uri = await fetchTokenURI(i) as string;
                            if (uri && uri.startsWith("ipfs://")) {
                                const metadataResult = await fetchJsonFromIpfsWithFallback(uri);
                                if (metadataResult && metadataResult.data) {
                                    metadata[i.toString()] = metadataResult.data;
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to fetch metadata for token ${i}:`, err);
                        }
                    }
                }
            }
            
            setTokens(userTokens);
            setTokenBalances(balances);
            setTokenMetadata(metadata);

            const status: Record<string, boolean> = {};
            // Get unique token IDs for status check
            const uniqueTokenIds = Array.from(new Set(userTokens));
            for (const tokenId of uniqueTokenIds) {
                const tokenInfo = await getTokenInfo(tokenId);
                status[tokenId.toString()] = tokenInfo[4];
            }
            setRedeemStatus(status);

            if (isVaultAvailable) {
                try {
                    const vaultLoans = await getUserLoans();
                    setVaultedTokens(vaultLoans);
                    
                    for (const vaultTokenId of vaultLoans) {
                        if (!status[vaultTokenId.toString()]) {
                            const tokenInfo = await getTokenInfo(vaultTokenId);
                            status[vaultTokenId.toString()] = tokenInfo[4];
                        }
                        // Fetch metadata for vaulted tokens too
                        if (!metadata[vaultTokenId.toString()]) {
                            try {
                                const uri = await fetchTokenURI(vaultTokenId) as string;
                                if (uri && uri.startsWith("ipfs://")) {
                                    const metadataResult = await fetchJsonFromIpfsWithFallback(uri);
                                    if (metadataResult && metadataResult.data) {
                                        metadata[vaultTokenId.toString()] = metadataResult.data;
                                    }
                                }
                            } catch (err) {
                                console.error(`Failed to fetch metadata for vaulted token ${vaultTokenId}:`, err);
                            }
                        }
                    }
                    setRedeemStatus(status);
                    setTokenMetadata(metadata);
                } catch (vaultError) {
                    console.error("Error fetching vault loans:", vaultError);
                }
            }
        } catch (error) {
            console.error("Error fetching tokens:", error);
            setError(error instanceof Error ? error.message : "Failed to fetch tokens");
        } finally {
            setIsLoading(false);
        }
    }, [address, getTokensOfOwner, getTokenInfo, getLastTokenID, fetchTokenURI, isVaultAvailable, getUserLoans, getLastBatchID, getBatchInfo]);

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    // Handle bulk deposit of all available tokens in a group
    const [isBulkDepositing, setIsBulkDepositing] = useState(false);
    const [bulkDepositProgress, setBulkDepositProgress] = useState({ current: 0, total: 0 });
    
    const handleDepositAll = useCallback(async (tokenIds: bigint[]) => {
        if (!tokenIds || tokenIds.length === 0) {
            console.log("No tokens to deposit");
            return;
        }

        console.log(`Starting bulk deposit of ${tokenIds.length} tokens:`, tokenIds);
        setIsBulkDepositing(true);
        setBulkDepositProgress({ current: 0, total: tokenIds.length });
        
        try {
            // First ensure NFT approval
            await approveNFT();
            
            // Use batch operations if V2, otherwise fall back to sequential
            const depositedTokens: bigint[] = [];
            
            if (vaultVersion === 'V2') {
                // V2: Single batch transaction (gas efficient)
                console.log(`Depositing ${tokenIds.length} tokens in a single batch transaction...`);
                setBulkDepositProgress({ current: tokenIds.length, total: tokenIds.length });
                await depositBatch(tokenIds);
                depositedTokens.push(...tokenIds);
                console.log(`Successfully deposited all ${tokenIds.length} tokens in one transaction!`);
            } else {
                // V1: Sequential deposits with warning
                const estimatedGas = tokenIds.length * 120000; // ~120k gas per deposit
                const proceed = window.confirm(
                    `⚠️ Gas Warning: This operation will require ${tokenIds.length} separate transactions.\n\n` +
                    `Estimated total gas: ~${estimatedGas.toLocaleString()} units\n\n` +
                    `Consider upgrading to EcoStabilizerV2 for 75% gas savings with batch operations.\n\n` +
                    `Continue with sequential deposits?`
                );
                
                if (!proceed) {
                    setIsBulkDepositing(false);
                    setBulkDepositProgress({ current: 0, total: 0 });
                    return;
                }
                
                // Deposit each token sequentially
                for (let i = 0; i < tokenIds.length; i++) {
                    const tokenId = tokenIds[i];
                    console.log(`Depositing token #${tokenId}...`);
                    setBulkDepositProgress({ current: i + 1, total: tokenIds.length });
                    await deposit(tokenId);
                    depositedTokens.push(tokenId);
                    console.log(`Token #${tokenId} deposited successfully`);
                }
            }
            
            console.log(`Successfully deposited all ${tokenIds.length} tokens!`);
            
            // Clear deposited tokens from selection
            setSelectedTokens(prev => {
                const newSet = new Set(prev);
                depositedTokens.forEach(id => newSet.delete(id));
                return newSet;
            });
            
            // Refresh the token list to update the UI
            await fetchTokens();
        } catch (error) {
            console.error("Error during bulk deposit:", error);
        } finally {
            setIsBulkDepositing(false);
            setBulkDepositProgress({ current: 0, total: 0 });
        }
    }, [deposit, approveNFT, fetchTokens]);

    // Group tokens by their actual batch ID from the contract
    const tokenGroups = useMemo(() => {
        const groups = new Map<string, TokenGroup>();
        
        // Get all unique token IDs
        const allTokenIds = new Set<bigint>([...tokens, ...vaultedTokens]);
        
        if (allTokenIds.size === 0) {
            return [];
        }
        
        // If batch data is available, use it to group tokens
        if (batchData.size > 0) {
            // Create a map to track which batch each token belongs to
            const tokenToBatch = new Map<bigint, bigint>();
            
            // Iterate through all batches to find which tokens belong to which batch
            batchData.forEach((batch, batchId) => {
                if (batch && batch[1]) { // batch[1] contains the token IDs array
                    const tokenIds = batch[1];
                    tokenIds.forEach((tokenId: bigint) => {
                        tokenToBatch.set(tokenId, batchId);
                    });
                }
            });
            
            // Group tokens by their batch
            const batchGroups = new Map<bigint, Set<bigint>>();
            
            allTokenIds.forEach(tokenId => {
                const batchId = tokenToBatch.get(tokenId);
                if (batchId) {
                    if (!batchGroups.has(batchId)) {
                        batchGroups.set(batchId, new Set());
                    }
                    batchGroups.get(batchId)!.add(tokenId);
                } else {
                    // If no batch found, create individual group
                    const individualBatchId = BigInt(-Number(tokenId)); // Use negative to avoid collision
                    batchGroups.set(individualBatchId, new Set([tokenId]));
                }
            });
            
            // Create TokenGroup objects for each batch
            batchGroups.forEach((batchTokenIdSet, batchId) => {
                const batchTokenIds = Array.from(batchTokenIdSet).sort((a, b) => Number(a - b));
                
                // For batch grouping, use the batch ID for naming, not individual token metadata
                const firstTokenId = batchTokenIds[0];
                const metadata = tokenMetadata[firstTokenId.toString()];
                const isIndividual = batchId < 0n;
                const displayBatchId = isIndividual ? firstTokenId : batchId;
                // Always use batch name for consistency
                const name = `Batch #${displayBatchId}`;
                
                // Separate available and vaulted tokens for this batch
                const availableTokenIds: bigint[] = [];
                const vaultedTokenIds: bigint[] = [];
                
                batchTokenIds.forEach(tokenId => {
                    // Count how many of this token ID we have available
                    const availableCount = tokens.filter(t => t === tokenId).length;
                    const vaultedCount = vaultedTokens.filter(t => t === tokenId).length;
                    
                    // Add the appropriate number of instances
                    for (let i = 0; i < availableCount; i++) {
                        availableTokenIds.push(tokenId);
                    }
                    for (let i = 0; i < vaultedCount; i++) {
                        vaultedTokenIds.push(tokenId);
                    }
                });
                
                const batchIdStr = `batch-${displayBatchId}`;
                
                groups.set(batchIdStr, {
                    batchId: batchIdStr,
                    name,
                    description: metadata?.description,
                    availableTokenIds,
                    vaultedTokenIds,
                    availableCount: availableTokenIds.length,
                    vaultedCount: vaultedTokenIds.length,
                    totalCount: availableTokenIds.length + vaultedTokenIds.length,
                    metadata,
                    imageUrl: metadata?.image ? resolveIpfsUriToUrl(metadata.image) : undefined
                });
            });
        } else {
            // Fallback: If no batch data, group all identical tokens together
            const tokenGroupMap = new Map<bigint, { available: number; vaulted: number }>();
            
            tokens.forEach(tokenId => {
                if (!tokenGroupMap.has(tokenId)) {
                    tokenGroupMap.set(tokenId, { available: 0, vaulted: 0 });
                }
                tokenGroupMap.get(tokenId)!.available++;
            });
            
            vaultedTokens.forEach(tokenId => {
                if (!tokenGroupMap.has(tokenId)) {
                    tokenGroupMap.set(tokenId, { available: 0, vaulted: 0 });
                }
                tokenGroupMap.get(tokenId)!.vaulted++;
            });
            
            tokenGroupMap.forEach((counts, tokenId) => {
                const metadata = tokenMetadata[tokenId.toString()];
                const name = metadata?.name || `Token #${tokenId}`;
                
                const availableTokenIds: bigint[] = [];
                const vaultedTokenIds: bigint[] = [];
                
                for (let i = 0; i < counts.available; i++) {
                    availableTokenIds.push(tokenId);
                }
                for (let i = 0; i < counts.vaulted; i++) {
                    vaultedTokenIds.push(tokenId);
                }
                
                const batchIdStr = `token-${tokenId}`;
                
                groups.set(batchIdStr, {
                    batchId: batchIdStr,
                    name,
                    description: metadata?.description,
                    availableTokenIds,
                    vaultedTokenIds,
                    availableCount: availableTokenIds.length,
                    vaultedCount: vaultedTokenIds.length,
                    totalCount: availableTokenIds.length + vaultedTokenIds.length,
                    metadata,
                    imageUrl: metadata?.image ? resolveIpfsUriToUrl(metadata.image) : undefined
                });
            });
        }
        
        // Sort groups
        return Array.from(groups.values()).sort((a, b) => {
            const aMatch = a.batchId.match(/(\d+)/);
            const bMatch = b.batchId.match(/(\d+)/);
            const aId = aMatch ? parseInt(aMatch[1]) : 0;
            const bId = bMatch ? parseInt(bMatch[1]) : 0;
            return aId - bId;
        });
    }, [tokens, vaultedTokens, tokenMetadata, batchData]);

    // Filter based on active tab
    const filteredGroups = useMemo(() => {
        switch(activeTab) {
            case 'available':
                return tokenGroups.filter(g => g.availableCount > 0);
            case 'vaulted':
                return tokenGroups.filter(g => g.vaultedCount > 0);
            default:
                return tokenGroups;
        }
    }, [tokenGroups, activeTab]);

    const handleSelectAll = () => {
        const availableForRedemption = tokens.filter(t => !redeemStatus[t.toString()]);
        setSelectedTokens(new Set(availableForRedemption));
    };

    const handleDeselectAll = () => {
        setSelectedTokens(new Set());
    };

    const handleRedeemComplete = useCallback(() => {
        fetchTokens();
        setSelectedTokens(new Set());
    }, [fetchTokens]);
    
    // Callback for individual token deposit to clear from selection
    const handleIndividualDeposit = useCallback((tokenId: bigint) => {
        setSelectedTokens(prev => {
            const newSet = new Set(prev);
            newSet.delete(tokenId);
            return newSet;
        });
        fetchTokens();
    }, [fetchTokens]);

    // Calculate vault statistics
    const [sccBalance, setSccBalance] = useState<bigint>(0n);
    const [activeTransaction, setActiveTransaction] = useState<string>("");
    
    useEffect(() => {
        if (isVaultAvailable && address) {
            getSccBalance().then(setSccBalance);
        }
    }, [isVaultAvailable, address, getSccBalance, vaultedTokens]);
    
    const stats = useMemo(() => {
        const available = tokens.filter(t => !vaultedTokens.includes(t)).length;
        const vaulted = vaultedTokens.length;
        const eligibleForVault = tokens.filter(t => !redeemStatus[t.toString()] && !vaultedTokens.includes(t)).length;
        
        return {
            available,
            vaulted,
            currentScc: Number(formatEther(sccBalance)),
            potentialScc: eligibleForVault * 20,
        };
    }, [tokens, vaultedTokens, redeemStatus, sccBalance]);

    // Gate content visually if no address, but do not return early to avoid conditional hooks issues
    const showConnectPrompt = !address;

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">My Eco Assets</h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage your carbon offset NFTs and vault operations
                </p>
                
                {/* Action Guide */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Deposit</div>
                        <span className="text-gray-600 dark:text-gray-400">Lock NFT to earn 20 SCC tokens</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-1 bg-purple-600 text-white rounded text-xs">Withdraw</div>
                        <span className="text-gray-600 dark:text-gray-400">Return 20 SCC to reclaim NFT</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-1 bg-red-600 text-white rounded text-xs">Redeem</div>
                        <span className="text-gray-600 dark:text-gray-400">Retire carbon credits (permanent)</span>
                    </div>
                </div>
                
                {/* Transaction Helper */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="font-medium text-blue-900 dark:text-blue-100">About MetaMask Transactions</p>
                            <p className="text-blue-700 dark:text-blue-300 mt-1">
                                Vault operations require 2 transactions:
                            </p>
                            <ul className="ml-4 mt-1 text-blue-700 dark:text-blue-300 list-disc">
                                <li><strong>First transaction (Approval):</strong> Shows as "Send 0 ETH" - this gives permission to the vault contract</li>
                                <li><strong>Second transaction:</strong> The actual deposit/withdrawal operation</li>
                            </ul>
                            <p className="text-blue-600 dark:text-blue-400 mt-1 text-xs">
                                Watch the button text and toast notifications to know which step you're on.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {showConnectPrompt && (
                <div className="container mx-auto px-4 py-16 max-w-6xl">
                    <div className="text-center">
                        <svg className="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-xl font-semibold mb-2">Connect your wallet to get started</p>
                        <p className="text-gray-500">View and manage your Eco Assets after connecting</p>
                    </div>
                </div>
            )}

            {/* Simplified Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <button 
                    onClick={() => setActiveTab('available')}
                    className={`p-4 rounded-xl transition-all ${
                        activeTab === 'available' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500' 
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-2xl font-bold">{stats.available}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Available NFTs</p>
                </button>

                <button 
                    onClick={() => setActiveTab('vaulted')}
                    className={`p-4 rounded-xl transition-all ${
                        activeTab === 'vaulted' 
                            ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500' 
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-2xl font-bold">{stats.vaulted}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">In Vault</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Earning SCC rewards</p>
                </button>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-2xl font-bold">{stats.currentScc.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current SCC Balance</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Tradeable tokens</p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-2xl font-bold">{stats.potentialScc}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Potential SCC</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">From {stats.potentialScc / 20} eligible NFTs</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        activeTab === 'all'
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                >
                    All Assets
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                        {stats.available + stats.vaulted}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('available')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        activeTab === 'available'
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                >
                    Available
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        {stats.available}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('vaulted')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        activeTab === 'vaulted'
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                >
                    In Vault
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
                        {stats.vaulted}
                    </span>
                </button>
            </div>

            {/* Main Content */}
            {!showConnectPrompt && isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
            ) : !showConnectPrompt && error ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
            ) : !showConnectPrompt && filteredGroups.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
                    <svg className="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-lg font-medium mb-2">
                        {activeTab === 'available' && 'No available NFTs'}
                        {activeTab === 'vaulted' && 'No NFTs in vault'}
                        {activeTab === 'all' && 'No NFTs yet'}
                    </p>
                    <p className="text-sm text-gray-500">
                        {activeTab === 'available' && 'Your NFTs in the vault will appear here once withdrawn'}
                        {activeTab === 'vaulted' && 'Deposit NFTs to start earning SCC rewards'}
                        {activeTab === 'all' && 'Purchase Eco Assets from the marketplace'}
                    </p>
                </div>
            ) : !showConnectPrompt && (
                <div className="space-y-4">
                    {filteredGroups.map((group) => (
                        <div key={group.batchId} className="bg-white dark:bg-gray-800 rounded-xl p-6">
                            {/* Batch Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    {/* Show actual NFT image or placeholder */}
                                    {group.imageUrl ? (
                                        <img 
                                            src={group.imageUrl} 
                                            alt={group.name}
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center">
                                            <span className="text-white font-bold text-lg">CO2</span>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <Link 
                                            href={`/batch/${group.batchId.replace('batch-', '')}`}
                                            className="text-lg font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                        >
                                            {group.name}
                                        </Link>
                                        <div className="flex gap-4 mt-1">
                                            {group.availableCount > 0 && (
                                                <span className="text-sm text-emerald-600 dark:text-emerald-400">
                                                    {group.availableCount} available
                                                </span>
                                            )}
                                            {group.vaultedCount > 0 && (
                                                <span className="text-sm text-purple-600 dark:text-purple-400">
                                                    {group.vaultedCount} in vault
                                                </span>
                                            )}
                                        </div>
                                        {group.description && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {group.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Batch Actions - Only show if there are available tokens */}
                                {group.availableCount > 0 && (
                                    <button 
                                        onClick={() => handleDepositAll(group.availableTokenIds)}
                                        disabled={isBulkDepositing}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        {isBulkDepositing && bulkDepositProgress.total > 0 
                                            ? `Depositing... (${bulkDepositProgress.current}/${bulkDepositProgress.total})`
                                            : `Deposit All (${group.availableCount})`
                                        }
                                    </button>
                                )}
                            </div>

                            {/* Token List - Always visible, no expansion needed */}
                            <div className="space-y-2">
                                {/* Available Tokens */}
                                {group.availableTokenIds.map((tokenId, index) => (
                                    <div key={`${tokenId}-${index}`} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                            <Link 
                                                href={`/token/${tokenId}`}
                                                className="text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                            >
                                                Token #{tokenId.toString()}
                                                {tokenBalances[tokenId.toString()] && tokenBalances[tokenId.toString()] > 1n && 
                                                    ` (Instance ${index + 1})`
                                                }
                                            </Link>
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400">Available</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* Vault Action */}
                                            <div className="relative group">
                                                <VaultCard
                                                    tokenId={tokenId}
                                                    isRedeemed={redeemStatus[tokenId.toString()]}
                                                    onActionComplete={() => handleIndividualDeposit(tokenId)}
                                                />
                                                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-10">
                                                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                                                        Deposit to vault to earn 20 SCC
                                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                                            <div className="border-4 border-transparent border-t-gray-900"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Redeem Action - only for non-redeemed tokens */}
                                            {!redeemStatus[tokenId.toString()] && !vaultedTokens.includes(tokenId) && (
                                                <div className="relative group">
                                                    <button
                                                        onClick={() => {
                                                            const newSet = new Set(selectedTokens);
                                                            if (newSet.has(tokenId)) {
                                                                newSet.delete(tokenId);
                                                            } else {
                                                                newSet.add(tokenId);
                                                            }
                                                            setSelectedTokens(newSet);
                                                        }}
                                                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                                            selectedTokens.has(tokenId)
                                                                ? 'bg-red-600 text-white hover:bg-red-700'
                                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                                                        }`}
                                                    >
                                                        {selectedTokens.has(tokenId) ? 'Selected' : 'Select to Redeem'}
                                                    </button>
                                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-10">
                                                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                                                            Mark as retired (permanent, cannot be deposited to vault)
                                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                                                <div className="border-4 border-transparent border-t-gray-900"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Vaulted Tokens */}
                                {group.vaultedTokenIds.map((tokenId, index) => (
                                    <div key={`${tokenId}-vault-${index}`} className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <Link 
                                                href={`/token/${tokenId}`}
                                                className="text-sm font-medium hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                            >
                                                Token #{tokenId.toString()}
                                            </Link>
                                            <span className="text-xs text-purple-600 dark:text-purple-400">In Vault</span>
                                        </div>
                                        <VaultCard
                                            tokenId={tokenId}
                                            isRedeemed={redeemStatus[tokenId.toString()]}
                                            onActionComplete={fetchTokens}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Batch Redemption Section */}
            {selectedTokens.size > 0 && (
                <div className="mt-8 p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-medium text-lg">Carbon Credit Retirement</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {selectedTokens.size} NFTs selected for permanent retirement
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                ⚠️ This action is permanent. Redeemed NFTs cannot be deposited to vault or transferred.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleDeselectAll}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancel Selection
                            </button>
                            <RedeemTokensButton
                                selectedTokens={Array.from(selectedTokens)}
                                onRedeemComplete={handleRedeemComplete}
                                onSelectAll={handleSelectAll}
                                allTokens={tokens}
                                redeemStatus={redeemStatus}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}