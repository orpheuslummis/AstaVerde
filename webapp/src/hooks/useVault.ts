import { useCallback, useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import {
  getEcoStabilizerContract,
  getSccContract,
  getAstaVerdeContract,
  detectVaultVersion,
} from "../config/contracts";
import { customToast } from "../shared/utils/customToast";
import { ENV } from "../config/environment";
import { VAULT_GAS_LIMITS } from "../config/constants";
import { parseVaultError, TxStatus, VaultErrorState } from "../utils/errors";
import { dispatchBalancesRefetch } from "./useGlobalEvent";
import type { VaultLoan } from "../features/vault/types";
import { useRateLimitedPublicClient } from "./useRateLimitedPublicClient";
import { safeMulticall } from "../lib/safeMulticall";

/**
 * Normalize a transaction hash to ensure it has the correct length (64 hex chars + 0x prefix).
 * This fixes an issue where leading zeros can be stripped during JSON serialization,
 * causing "hex string has length 62, want 64" errors.
 */
function normalizeHash(hash: `0x${string}`): `0x${string}` {
  if (!hash || !hash.startsWith("0x")) return hash;
  const hexPart = hash.slice(2);
  // Pad to 64 characters if shorter
  const padded = hexPart.padStart(64, "0");
  return `0x${padded}` as `0x${string}`;
}

export interface VaultHook {
  // Core functionality
  deposit: (tokenId: bigint) => Promise<void>;
  withdraw: (tokenId: bigint) => Promise<void>;
  // Backward-compatible alias maintained via frontend: calls withdraw
  repayAndWithdraw: (tokenId: bigint) => Promise<void>;

  // Batch operations (V2 only)
  depositBatch: (tokenIds: bigint[]) => Promise<void>;
  withdrawBatch: (tokenIds: bigint[]) => Promise<void>;
  vaultVersion: "V1" | "V2" | null;

  // Read functions
  getUserLoans: () => Promise<bigint[]>;
  getTotalActiveLoans: () => Promise<bigint>;
  getSccBalance: () => Promise<bigint>;
  getSccAllowance: () => Promise<bigint>;
  checkLoanStatus: (tokenId: bigint) => Promise<VaultLoan | null>;
  getIsNftApproved: () => Promise<boolean>;

  // Approval functions
  approveNFT: () => Promise<void>;
  approveSCC: (amount?: bigint) => Promise<void>;

  // Status
  isVaultAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  vaultError: VaultErrorState | null;
  txStatus: TxStatus;
  txHash?: string;
  clearError: () => void;
}

const SCC_PER_ASSET = parseEther("20");
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6" as const;

export function useVault(): VaultHook {
  const publicClient = useRateLimitedPublicClient();
  const { address } = useAccount();

  // State
  const [vaultVersion, setVaultVersion] = useState<"V1" | "V2" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<VaultErrorState | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [paginatedLoans, setPaginatedLoans] = useState<bigint[]>([]);

  const vaultAddress = ENV.ECOSTABILIZER_ADDRESS;

  // Transaction management
  const { writeContractAsync } = useWriteContract();
  const [currentTxHash, setCurrentTxHash] = useState<`0x${string}` | undefined>();

  // Check if vault contracts are available
  const isVaultAvailable = useMemo(() => {
    return !!(vaultAddress && ENV.SCC_ADDRESS);
  }, [vaultAddress]);

  // Detect vault version on mount
  useEffect(() => {
    const detectVersion = async () => {
      if (publicClient && isVaultAvailable && vaultAddress) {
        const version = await detectVaultVersion(publicClient);
        setVaultVersion(version);
      }
    };
    detectVersion();
  }, [publicClient, isVaultAvailable, vaultAddress]);

  // Get contract configs safely
  const getVaultContractConfig = useCallback(() => {
    if (!isVaultAvailable || !vaultAddress) {
      throw new Error("Vault contracts not configured");
    }
    return getEcoStabilizerContract();
  }, [isVaultAvailable, vaultAddress]);

  const getAssetContractConfig = useCallback(() => {
    return getAstaVerdeContract();
  }, []);

  const getSccConfig = useCallback(() => {
    if (!ENV.SCC_ADDRESS) {
      throw new Error("SCC contract not configured");
    }
    return getSccContract();
  }, []);

  // Read user's SCC balance
  const { data: sccBalance, refetch: refetchSccBalance } = useReadContract({
    ...(isVaultAvailable ? getSccContract() : { address: undefined, abi: [] }),
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isVaultAvailable && !!address },
  });

  // Read SCC allowance for vault
  const { data: sccAllowance, refetch: refetchSccAllowance } = useReadContract({
    ...(isVaultAvailable ? getSccContract() : { address: undefined, abi: [] }),
    functionName: "allowance",
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: isVaultAvailable && !!address && !!vaultAddress },
  });

  // Read user's loans directly (non-paginated version)
  const { data: userLoansData, refetch: refetchUserLoans } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContract() : { address: undefined, abi: [] }),
    functionName: "getUserLoans",
    args: address ? [address] : undefined,
    query: { enabled: isVaultAvailable && !!address },
  });

  // Read total active loans
  const { data: totalActiveLoansData } = useReadContract({
    ...(isVaultAvailable ? getEcoStabilizerContract() : { address: undefined, abi: [] }),
    functionName: "getTotalActiveLoans",
    query: { enabled: isVaultAvailable },
  });

  // Read NFT approval status
  const { data: isNftApproved, refetch: refetchNftApproval } = useReadContract({
    ...getAssetContractConfig(),
    functionName: "isApprovedForAll",
    args: address && isVaultAvailable && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: !!address && isVaultAvailable && !!vaultAddress },
  });

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    setVaultError(null);
  }, []);

  // Refresh all contract data
  const refreshContractData = useCallback(async () => {
    if (isVaultAvailable && address) {
      await Promise.all([refetchSccBalance(), refetchSccAllowance(), refetchUserLoans(), refetchNftApproval()]);
    }
  }, [isVaultAvailable, address, refetchSccBalance, refetchSccAllowance, refetchUserLoans, refetchNftApproval]);

  // Approval functions
  const approveNFT = useCallback(async () => {
    if (!address || !isVaultAvailable) {
      throw new Error("Wallet not connected or vault not available");
    }

    try {
      setIsLoading(true);
      setError(null);

      customToast.info("Approving NFT transfers...");

      // Resolve operator from current vault config to avoid ENV drift
      const vaultConfig = getVaultContractConfig();
      const operator = vaultConfig.address as `0x${string}`;

      // Prepare AstaVerde (ERC1155) contract config
      const assetConfig = getAssetContractConfig();

      // Prevent accidental self-approval (will revert onchain)
      if (operator.toLowerCase() === address.toLowerCase()) {
        throw new Error("Invalid operator: cannot approve your own address");
      }

      // Provide explicit gas to avoid wallet-side "Missing gas limit" on some RPCs
      let gasLimit: bigint | undefined;
      try {
        if (publicClient && address) {
          const estimate = await publicClient.estimateContractGas({
            ...assetConfig,
            functionName: "setApprovalForAll",
            args: [operator, true],
            account: address,
          });
          gasLimit = (estimate * 120n) / 100n; // 20% buffer
        }
      } catch {
        // Fall back to a conservative limit; ERC1155 approval is cheap
        gasLimit = 100_000n;
      }

      const rawHash = await writeContractAsync({
        ...assetConfig,
        functionName: "setApprovalForAll",
        args: [operator, true],
        account: address,
        ...(gasLimit ? { gas: gasLimit } : {}),
      });
      const hash = normalizeHash(rawHash);

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });

      if (receipt?.status === "success") {
        await refetchNftApproval();
        customToast.success("NFT approval granted!");
      } else {
        throw new Error("Approval failed");
      }
    } catch (err) {
      const errorMessage = (err as Error)?.message || "Failed to approve NFT transfers";
      setError(errorMessage);
      customToast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [
    address,
    isVaultAvailable,
    writeContractAsync,
    publicClient,
    refetchNftApproval,
    getVaultContractConfig,
    getAssetContractConfig,
  ]);

  const approveSCC = useCallback(
    async (amount: bigint = SCC_PER_ASSET) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);

        const sccConfig = getSccConfig();

        customToast.info("Approving SCC transfers...");

        const rawHash = await writeContractAsync({
          ...sccConfig,
          functionName: "approve",
          args: [ENV.ECOSTABILIZER_ADDRESS as `0x${string}`, amount],
        });
        const hash = normalizeHash(rawHash);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          await refetchSccAllowance();
          customToast.success("SCC approval granted!");
        } else {
          throw new Error("Approval failed");
        }
      } catch (err) {
        const errorMessage = (err as Error)?.message || "Failed to approve SCC";
        setError(errorMessage);
        customToast.error(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [address, isVaultAvailable, getSccConfig, writeContractAsync, publicClient, refetchSccAllowance],
  );

  const diagnoseDepositFailure = useCallback(
    async (tokenId: bigint): Promise<VaultErrorState | null> => {
      if (!publicClient || !address || !isVaultAvailable || !vaultAddress) return null;

      try {
        const vaultConfig = getVaultContractConfig();
        const assetConfig = getAssetContractConfig();
        const sccConfig = getSccConfig();

        const results = await safeMulticall(publicClient, {
          allowFailure: true,
          contracts: [
            { ...vaultConfig, functionName: "paused" },
            { ...vaultConfig, functionName: "ecoAsset" },
            { ...vaultConfig, functionName: "scc" },
            { ...assetConfig, functionName: "paused" },
            { ...assetConfig, functionName: "isApprovedForAll", args: [address, vaultAddress] },
            { ...assetConfig, functionName: "balanceOf", args: [address, tokenId] },
            { ...assetConfig, functionName: "isRedeemed", args: [tokenId] },
            { ...sccConfig, functionName: "hasRole", args: [MINTER_ROLE, vaultAddress] },
          ],
        });

        const get = <T>(i: number): T | null => {
          const res = results[i];
          if (!res || res.status !== "success") return null;
          return res.result as T;
        };

        const vaultPaused = get<boolean>(0);
        const vaultEcoAsset = get<`0x${string}`>(1);
        const vaultScc = get<`0x${string}`>(2);
        const assetPaused = get<boolean>(3);
        const approvedForAll = get<boolean>(4);
        const balance = get<bigint>(5);
        const redeemed = get<boolean>(6);
        const vaultIsMinter = get<boolean>(7);

        if (vaultEcoAsset && vaultEcoAsset.toLowerCase() !== assetConfig.address.toLowerCase()) {
          return {
            type: "contract",
            message: "Vault Address Mismatch",
            details:
              "This vault is wired to a different AstaVerde contract than the UI is configured for. Update your env addresses to match the deployed contracts.",
            originalError: { vaultEcoAsset, uiEcoAsset: assetConfig.address },
          };
        }

        if (vaultScc && vaultScc.toLowerCase() !== sccConfig.address.toLowerCase()) {
          return {
            type: "contract",
            message: "Vault Address Mismatch",
            details:
              "This vault is wired to a different SCC contract than the UI is configured for. Update your env addresses to match the deployed contracts.",
            originalError: { vaultScc, uiScc: sccConfig.address },
          };
        }

        if (vaultPaused) {
          return {
            type: "contract",
            message: "Vault Temporarily Unavailable",
            details: "The EcoStabilizer vault contract is paused.",
          };
        }

        if (assetPaused) {
          return {
            type: "contract",
            message: "Marketplace Temporarily Unavailable",
            details: "The AstaVerde NFT contract is paused, so transfers are disabled.",
          };
        }

        if (redeemed) {
          return {
            type: "contract",
            message: "NFT Already Redeemed",
            details: "This NFT has been redeemed and cannot be deposited to the vault.",
          };
        }

        if (typeof balance === "bigint" && balance === 0n) {
          return {
            type: "contract",
            message: "Not NFT Owner",
            details: "You must own this NFT to deposit it into the vault.",
          };
        }

        if (approvedForAll === false) {
          return {
            type: "approval",
            message: "NFT Approval Required",
            details: "Please approve the vault to transfer your NFTs first.",
            action: {
              label: "Approve NFTs",
              handler: async () => approveNFT(),
            },
          };
        }

        if (vaultIsMinter === false) {
          return {
            type: "contract",
            message: "Vault Misconfigured",
            details:
              "EcoStabilizer is missing SCC MINTER_ROLE, so deposits cannot mint SCC. Redeploy or grant MINTER_ROLE to the vault address.",
          };
        }
      } catch {
        // ignore — diagnostics are best-effort only
      }

      return null;
    },
    [
      address,
      approveNFT,
      getAssetContractConfig,
      getSccConfig,
      getVaultContractConfig,
      isVaultAvailable,
      publicClient,
      vaultAddress,
    ],
  );

  // Core vault functions with proper async handling
  const deposit = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultContractConfig = getVaultContractConfig();

        customToast.info("Depositing NFT to vault...");

        const rawHash = await writeContractAsync({
          ...vaultContractConfig,
          functionName: "deposit",
          args: [tokenId],
        });
        const hash = normalizeHash(rawHash);

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        // Wait for transaction receipt
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success("NFT successfully deposited!");
          await refreshContractData();
          dispatchBalancesRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        let parsedError = parseVaultError(err, {
          operation: "deposit",
          approveNFT: async () => approveNFT(),
          retry: () => deposit(tokenId),
        });
        if (parsedError.type === "unknown") {
          const diagnosed = await diagnoseDepositFailure(tokenId);
          if (diagnosed) parsedError = { ...diagnosed, originalError: err };
        }
        setError((err as Error)?.message || "Failed to deposit NFT");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [
      address,
      approveNFT,
      diagnoseDepositFailure,
      getVaultContractConfig,
      isVaultAvailable,
      publicClient,
      refreshContractData,
      writeContractAsync,
    ],
  );

  const withdraw = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info("Withdrawing NFT from vault...");

        let gasLimit: bigint | undefined;
        try {
          if (publicClient && address) {
            const estimate = await publicClient.estimateContractGas({
              ...vaultConfig,
              functionName: "withdraw",
              args: [tokenId],
              account: address,
            });
            gasLimit = (estimate * 150n) / 100n; // add 50% buffer
          }
        } catch {
          gasLimit = VAULT_GAS_LIMITS.WITHDRAW;
        }

        const rawHash = await writeContractAsync({
          ...vaultConfig,
          functionName: "withdraw",
          args: [tokenId],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });
        const hash = normalizeHash(rawHash);

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        // Wait for transaction receipt
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success("NFT successfully withdrawn!");
          await refreshContractData();
          dispatchBalancesRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "withdraw",
          approveSCC: async () => approveSCC(SCC_PER_ASSET),
          retry: () => withdraw(tokenId),
        });
        setError((err as Error)?.message || "Failed to withdraw NFT");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData, approveSCC],
  );

  // Batch operations
  const depositBatch = useCallback(
    async (tokenIds: bigint[]) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      if (vaultVersion !== "V2") {
        throw new Error("Batch operations only available in V2");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info(`Depositing ${tokenIds.length} NFTs to vault...`);

        let gasLimit: bigint | undefined;
        try {
          if (publicClient && address) {
            const estimate = await publicClient.estimateContractGas({
              ...vaultConfig,
              functionName: "depositBatch",
              args: [tokenIds],
              account: address,
            });
            gasLimit = (estimate * 150n) / 100n; // add 50% buffer for batch overhead
          }
        } catch {
          // Allow wallet to estimate if RPC supports it
          gasLimit = undefined;
        }

        // Create a truly mutable array to avoid viem frozen array issues
        const cleanTokenIds = new Array(tokenIds.length);
        for (let i = 0; i < tokenIds.length; i++) {
          cleanTokenIds[i] = BigInt(tokenIds[i].toString());
        }

        const rawHash = await writeContractAsync({
          ...vaultConfig,
          functionName: "depositBatch",
          args: [cleanTokenIds],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });
        const hash = normalizeHash(rawHash);

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success(`Successfully deposited ${tokenIds.length} NFTs!`);
          await refreshContractData();
          dispatchBalancesRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        setError((err as Error)?.message || "Failed to deposit batch");
        setTxStatus(TxStatus.ERROR);
        customToast.error("Batch deposit failed");
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [
      address,
      isVaultAvailable,
      vaultVersion,
      getVaultContractConfig,
      writeContractAsync,
      publicClient,
      refreshContractData,
    ],
  );

  const withdrawBatch = useCallback(
    async (tokenIds: bigint[]) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      if (vaultVersion !== "V2") {
        throw new Error("Batch operations only available in V2");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();
        const sccConfig = getSccConfig();

        // Check and set SCC allowance if needed
        const requiredScc = BigInt(tokenIds.length) * SCC_PER_ASSET;
        const currentAllowance = (sccAllowance as bigint) || 0n;

        if (currentAllowance < requiredScc) {
          customToast.info("Approving SCC for withdrawal...");
          const rawApproveHash = await writeContractAsync({
            ...sccConfig,
            functionName: "approve",
            args: [vaultConfig.address as `0x${string}`, requiredScc],
          });
          const approveHash = normalizeHash(rawApproveHash);
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
          await refetchSccAllowance();
          // Small delay to ensure chain state is updated
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        customToast.info(`Withdrawing ${tokenIds.length} NFTs from vault...`);

        // Create a truly mutable array to avoid viem frozen array issues
        const cleanTokenIds = new Array(tokenIds.length);
        for (let i = 0; i < tokenIds.length; i++) {
          cleanTokenIds[i] = BigInt(tokenIds[i].toString());
        }

        // Dynamic gas: ~60k per token + 100k buffer for base operations
        const estimatedGas = BigInt(cleanTokenIds.length) * 60000n + 100000n;
        const gasLimit = estimatedGas > 2000000n ? estimatedGas : 2000000n; // min 2M gas

        const rawHash = await writeContractAsync({
          ...vaultConfig,
          functionName: "withdrawBatch",
          args: [cleanTokenIds],
          gas: gasLimit,
        });
        const hash = normalizeHash(rawHash);

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success(`Successfully withdrew ${tokenIds.length} NFTs!`);
          await refreshContractData();
          dispatchBalancesRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        setError((err as Error)?.message || "Failed to withdraw batch");
        setTxStatus(TxStatus.ERROR);
        customToast.error("Batch withdrawal failed");
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [
      address,
      isVaultAvailable,
      vaultVersion,
      getVaultContractConfig,
      getSccConfig,
      writeContractAsync,
      publicClient,
      refreshContractData,
      sccAllowance,
      refetchSccAllowance,
    ],
  );

  // Backward-compatible alias for repayAndWithdraw
  const repayAndWithdraw = useCallback(
    async (tokenId: bigint) => {
      if (!address || !isVaultAvailable) {
        throw new Error("Wallet not connected or vault not available");
      }

      try {
        setIsLoading(true);
        setError(null);
        setVaultError(null);
        setTxStatus(TxStatus.SIGNING);

        const vaultConfig = getVaultContractConfig();

        customToast.info("Repaying 20 SCC and withdrawing NFT...");

        let gasLimit: bigint | undefined;
        try {
          if (publicClient && address) {
            const estimate = await publicClient.estimateContractGas({
              ...vaultConfig,
              functionName: "withdraw",
              args: [tokenId],
              account: address,
            });
            gasLimit = (estimate * 150n) / 100n;
          }
        } catch {
          gasLimit = VAULT_GAS_LIMITS.WITHDRAW;
        }

        const rawHash = await writeContractAsync({
          ...vaultConfig,
          functionName: "withdraw",
          args: [tokenId],
          ...(gasLimit ? { gas: gasLimit } : {}),
        });
        const hash = normalizeHash(rawHash);

        setCurrentTxHash(hash);
        setTxStatus(TxStatus.CONFIRMING);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        if (receipt?.status === "success") {
          setTxStatus(TxStatus.SUCCESS);
          customToast.success("NFT successfully withdrawn!");
          await refreshContractData();
          dispatchBalancesRefetch();
        } else {
          throw new Error("Transaction failed");
        }
      } catch (err) {
        const parsedError = parseVaultError(err, {
          operation: "withdraw",
          approveSCC: async () => approveSCC(SCC_PER_ASSET),
          retry: () => repayAndWithdraw(tokenId),
        });
        setError((err as Error)?.message || "Failed to repay and withdraw NFT");
        setVaultError(parsedError);
        setTxStatus(TxStatus.ERROR);
        customToast.error(parsedError.message);
        throw err;
      } finally {
        setIsLoading(false);
        setCurrentTxHash(undefined);
      }
    },
    [address, isVaultAvailable, getVaultContractConfig, writeContractAsync, publicClient, refreshContractData, approveSCC],
  );

  // Read functions
  const getUserLoans = useCallback(async (): Promise<bigint[]> => {
    // Prefer a fresh on-demand read to avoid cross-hook staleness during batch flows
    try {
      if (publicClient && address && isVaultAvailable) {
        const loans = await publicClient.readContract({
          ...getVaultContractConfig(),
          functionName: "getUserLoans",
          args: [address],
        });
        return loans as bigint[];
      }
    } catch {
      // fall back to cached data below
    }
    return (userLoansData as bigint[]) || [];
  }, [publicClient, address, isVaultAvailable, getVaultContractConfig, userLoansData]);

  const getTotalActiveLoans = useCallback(async (): Promise<bigint> => {
    return (totalActiveLoansData as bigint) || 0n;
  }, [totalActiveLoansData]);

  const getSccBalance = useCallback(async (): Promise<bigint> => {
    return (sccBalance as bigint) || 0n;
  }, [sccBalance]);

  const getSccAllowance = useCallback(async (): Promise<bigint> => {
    return (sccAllowance as bigint) || 0n;
  }, [sccAllowance]);

  const getIsNftApproved = useCallback(async (): Promise<boolean> => {
    return (isNftApproved as boolean) || false;
  }, [isNftApproved]);

  const checkLoanStatus = useCallback(async (_tokenId: bigint): Promise<VaultLoan | null> => {
    // Would need implementation
    return null;
  }, []);

  return {
    // Core functions
    deposit,
    withdraw,
    repayAndWithdraw,
    depositBatch,
    withdrawBatch,
    vaultVersion,

    // Read functions
    getUserLoans,
    getTotalActiveLoans,
    getSccBalance,
    getSccAllowance,
    checkLoanStatus,
    getIsNftApproved,

    // Approval functions
    approveNFT,
    approveSCC,

    // Status
    isVaultAvailable,
    isLoading,
    error,
    vaultError,
    txStatus,
    txHash: currentTxHash,
    clearError,
  };
}
