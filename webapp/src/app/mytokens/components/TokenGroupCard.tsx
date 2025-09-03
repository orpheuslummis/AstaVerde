import Link from "next/link";
import Image from "next/image";
import VaultCard from "../../../components/VaultCard";
import { TokenGroup } from "../hooks/useTokenGroups";
import { resolveIpfsUriToUrl } from "../../../utils/ipfsHelper";

interface TokenGroupCardProps {
  group: TokenGroup;
  redeemStatus: Record<string, boolean>;
  tokenBalances: Record<string, bigint>;
  selectedTokens: Set<bigint>;
  onTokenSelect: (tokenId: bigint) => void;
  onDepositAll: (tokenIds: bigint[]) => void;
  onIndividualDeposit: (tokenId: bigint) => void;
  onActionComplete: () => void;
  isBulkDepositing: boolean;
  bulkDepositProgress: { current: number; total: number };
}

export function TokenGroupCard({
  group,
  redeemStatus,
  tokenBalances,
  selectedTokens,
  onTokenSelect,
  onDepositAll,
  onIndividualDeposit,
  onActionComplete,
  isBulkDepositing,
  bulkDepositProgress,
}: TokenGroupCardProps) {
  const imageUrl = group.imageUrl ? resolveIpfsUriToUrl(group.imageUrl) : undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
      {/* Batch Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Show actual NFT image or placeholder */}
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={group.name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">CO2</span>
            </div>
          )}

          <div>
            <Link
              href={`/batch/${group.batchId.replace("batch-", "")}`}
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

        {/* Batch Actions - Only show if there are non-redeemed available tokens */}
        {(() => {
          const depositableTokenIds = group.availableTokenIds.filter(
            tokenId => !redeemStatus[tokenId.toString()]
          );
          if (depositableTokenIds.length === 0) return null;
          
          return (
            <button
              onClick={() => onDepositAll(depositableTokenIds)}
              disabled={isBulkDepositing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isBulkDepositing && bulkDepositProgress.total > 0
                ? `Depositing... (${bulkDepositProgress.current}/${bulkDepositProgress.total})`
                : `Deposit All (${depositableTokenIds.length})`
              }
            </button>
          );
        })()}
      </div>

      {/* Token List */}
      <div className="space-y-2">
        {/* Available Tokens */}
        {group.availableTokenIds.map((tokenId, index) => {
          const isRedeemed = redeemStatus[tokenId.toString()];
          return (
            <div key={`${tokenId}-${index}`} className={`flex items-center justify-between p-3 rounded-lg ${
              isRedeemed 
                ? "bg-gray-100 dark:bg-gray-800 opacity-75" 
                : "bg-emerald-50 dark:bg-emerald-900/20"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  isRedeemed ? "bg-gray-500" : "bg-emerald-500"
                }`}></div>
                <Link
                  href={`/token/${tokenId}`}
                  className={`text-sm font-medium transition-colors ${
                    isRedeemed 
                      ? "text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      : "hover:text-emerald-600 dark:hover:text-emerald-400"
                  }`}
                >
                  Token #{tokenId.toString()}
                  {tokenBalances[tokenId.toString()] && tokenBalances[tokenId.toString()] > 1n &&
                    ` (Instance ${index + 1})`
                  }
                </Link>
                <span className={`text-xs ${
                  isRedeemed 
                    ? "text-gray-600 dark:text-gray-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {isRedeemed ? "Redeemed" : "Available"}
                </span>
              </div>
            <div className="flex items-center gap-2">
              {/* Vault Action */}
              <div className="relative group">
                <VaultCard
                  tokenId={tokenId}
                  isRedeemed={redeemStatus[tokenId.toString()]}
                  onActionComplete={() => onIndividualDeposit(tokenId)}
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

              {/* Redeem Action */}
              {!redeemStatus[tokenId.toString()] && (
                <div className="relative group">
                  <button
                    onClick={() => onTokenSelect(tokenId)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      selectedTokens.has(tokenId)
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {selectedTokens.has(tokenId) ? "Selected" : "Select to Redeem"}
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
          );
        })}

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
              onActionComplete={onActionComplete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

