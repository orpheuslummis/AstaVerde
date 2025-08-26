"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useVault } from "../../hooks/useVault";
import RedeemTokensButton from "./RedeemTokensButton";

// Import custom hooks
import { useTokenData } from "./hooks/useTokenData";
import { useTokenMetadata } from "./hooks/useTokenMetadata";
import { useTokenGroups, TabType } from "./hooks/useTokenGroups";

// Import components
import { TokenGroupCard } from "./components/TokenGroupCard";
import { TokenTabs } from "./components/TokenTabs";
import { StatsDisplay } from "./components/StatsDisplay";
import { resolveIpfsUriToUrl } from "../../utils/ipfsHelper";

/**
 * MyTokensPage - Simplified main component using extracted hooks and components
 */
export default function MyTokensPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedTokens, setSelectedTokens] = useState<Set<bigint>>(new Set());
  const [isBulkDepositing, setIsBulkDepositing] = useState(false);
  const [bulkDepositProgress, setBulkDepositProgress] = useState({ current: 0, total: 0 });
  const [sccBalance, setSccBalance] = useState<bigint>(0n);

  // Use custom hooks for data management
  const {
    tokens,
    tokenBalances,
    vaultedTokens,
    redeemStatus,
    batchData,
    isLoading,
    error,
    refetch: fetchTokens,
  } = useTokenData();

  const { metadata: tokenMetadata, fetchMetadata } = useTokenMetadata();

  const { filteredGroups } = useTokenGroups({
    tokens,
    vaultedTokens,
    tokenMetadata,
    batchData,
    activeTab,
  });

  const {
    deposit,
    depositBatch,
    approveNFT,
    getSccBalance,
    getIsNftApproved,
    isVaultAvailable,
    vaultVersion,
  } = useVault();

  // Memoize the token IDs to prevent unnecessary re-renders
  const allTokenIds = useMemo(() => {
    const uniqueIds = new Set([...tokens, ...vaultedTokens]);
    return Array.from(uniqueIds);
  }, [tokens, vaultedTokens]);

  // Fetch metadata when tokens change
  useEffect(() => {
    if (allTokenIds.length > 0) {
      fetchMetadata(allTokenIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTokenIds]); // Removed fetchMetadata from deps to prevent infinite loop

  // Fetch SCC balance
  useEffect(() => {
    if (isVaultAvailable && address) {
      getSccBalance().then(setSccBalance);
    }
  }, [isVaultAvailable, address, getSccBalance, vaultedTokens]);

  // Calculate statistics
  const stats = useMemo(() => {
    const available = tokens.filter(t => !vaultedTokens.includes(t)).length;
    const vaulted = vaultedTokens.length;
    const eligibleForVault = tokens.filter(t => !redeemStatus[t.toString()] && !vaultedTokens.includes(t)).length;

    return {
      available,
      vaulted,
      currentScc: sccBalance,
      potentialScc: eligibleForVault * 20,
    };
  }, [tokens, vaultedTokens, redeemStatus, sccBalance]);

  const tabCounts = useMemo(() => ({
    all: stats.available + stats.vaulted,
    available: stats.available,
    vaulted: stats.vaulted,
  }), [stats]);

  // Handle bulk deposit
  const handleDepositAll = useCallback(async (tokenIds: bigint[]) => {
    if (!tokenIds || tokenIds.length === 0) return;

    setIsBulkDepositing(true);
    setBulkDepositProgress({ current: 0, total: tokenIds.length });

    try {
      // Check if NFTs are already approved
      const isApproved = await getIsNftApproved();

      if (!isApproved) {
        // Need approval first; approveNFT waits for receipt and refetch
        await approveNFT();
      }

      // Treat unknown version as V2 (single-system contracts ship V2)
      if (vaultVersion === "V2" || vaultVersion === null) {
        setBulkDepositProgress({ current: tokenIds.length, total: tokenIds.length });
        await depositBatch(tokenIds);
      } else {
        const estimatedGas = tokenIds.length * 120000;
        const proceed = window.confirm(
          `⚠️ Gas Warning: This operation will require ${tokenIds.length} separate transactions.\n\n` +
          `Estimated total gas: ~${estimatedGas.toLocaleString()} units\n\n` +
          "Continue with sequential deposits?",
        );

        if (!proceed) {
          setIsBulkDepositing(false);
          setBulkDepositProgress({ current: 0, total: 0 });
          return;
        }

        for (let i = 0; i < tokenIds.length; i++) {
          setBulkDepositProgress({ current: i + 1, total: tokenIds.length });
          await deposit(tokenIds[i]);
        }
      }

      setSelectedTokens(prev => {
        const newSet = new Set(prev);
        tokenIds.forEach(id => newSet.delete(id));
        return newSet;
      });

      await fetchTokens();
    } catch (error) {
      console.error("Error during bulk deposit:", error);
    } finally {
      setIsBulkDepositing(false);
      setBulkDepositProgress({ current: 0, total: 0 });
    }
  }, [deposit, approveNFT, fetchTokens, depositBatch, vaultVersion, getIsNftApproved]);

  // Handle individual deposit
  const handleIndividualDeposit = useCallback((tokenId: bigint) => {
    setSelectedTokens(prev => {
      const newSet = new Set(prev);
      newSet.delete(tokenId);
      return newSet;
    });
    fetchTokens();
  }, [fetchTokens]);

  // Handle token selection
  const handleTokenSelect = useCallback((tokenId: bigint) => {
    setSelectedTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenId)) {
        newSet.delete(tokenId);
      } else {
        newSet.add(tokenId);
      }
      return newSet;
    });
  }, []);

  // Handle redeem complete
  const handleRedeemComplete = useCallback(() => {
    fetchTokens();
    setSelectedTokens(new Set());
  }, [fetchTokens]);

  const handleSelectAll = () => {
    const availableForRedemption = tokens.filter(t => !redeemStatus[t.toString()]);
    setSelectedTokens(new Set(availableForRedemption));
  };

  const handleDeselectAll = () => {
    setSelectedTokens(new Set());
  };

  const showConnectPrompt = !address;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
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
                <li><strong>First transaction (Approval):</strong> Shows as &quot;Send 0 ETH&quot; - this gives permission to the vault contract</li>
                <li><strong>Second transaction:</strong> The actual deposit/withdrawal operation</li>
              </ul>
              <p className="text-blue-600 dark:text-blue-400 mt-1 text-xs">
                Watch the button text and toast notifications to know which step you&apos;re on.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Connect Wallet Prompt */}
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

      {!showConnectPrompt && (
        <>
          {/* Stats Display */}
          <StatsDisplay
            stats={stats}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Tab Navigation */}
          <TokenTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />

          {/* Main Content */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl">
              <svg className="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-lg font-medium mb-2">
                {activeTab === "available" && "No available NFTs"}
                {activeTab === "vaulted" && "No NFTs in vault"}
                {activeTab === "all" && "No NFTs yet"}
              </p>
              <p className="text-sm text-gray-500">
                {activeTab === "available" && "Your NFTs in the vault will appear here once withdrawn"}
                {activeTab === "vaulted" && "Deposit NFTs to start earning SCC rewards"}
                {activeTab === "all" && "Purchase Eco Assets from the marketplace"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                // Enhance group with resolved image URL
                const enhancedGroup = {
                  ...group,
                  imageUrl: group.metadata?.image ? resolveIpfsUriToUrl(group.metadata.image) : undefined,
                };
                return (
                  <TokenGroupCard
                    key={group.batchId}
                    group={enhancedGroup}
                    redeemStatus={redeemStatus}
                    tokenBalances={tokenBalances}
                    selectedTokens={selectedTokens}
                    onTokenSelect={handleTokenSelect}
                    onDepositAll={handleDepositAll}
                    onIndividualDeposit={handleIndividualDeposit}
                    onActionComplete={fetchTokens}
                    isBulkDepositing={isBulkDepositing}
                    bulkDepositProgress={bulkDepositProgress}
                  />
                );
              })}
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
        </>
      )}
    </div>
  );
}
