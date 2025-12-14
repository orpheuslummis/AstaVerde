import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useAppContext } from "../../../contexts/AppContext";
import { useVault } from "../../../hooks/useVault";
import type { BatchData } from "../../../types";
import { useRateLimitedPublicClient } from "@/hooks/useRateLimitedPublicClient";

type TokenBalanceRecord = Record<string, bigint>;
type RedeemStatus = Record<string, boolean>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const BATCH_INFO_CHUNK = 20;
const BALANCE_CHUNK = 75;
const REDEEM_CHUNK = 100;
const CHUNK_DELAY_MS = 200;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function useTokenData() {
  const publicClient = useRateLimitedPublicClient();
  const { address } = useAccount();
  const { astaverdeContractConfig } = useAppContext();
  const { getUserLoans } = useVault();

  const [tokens, setTokens] = useState<bigint[]>([]);
  const [vaultedTokens, setVaultedTokens] = useState<bigint[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalanceRecord>({});
  const [redeemStatus, setRedeemStatus] = useState<RedeemStatus>({});
  const [batchData, setBatchData] = useState<Map<bigint, BatchData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInFlightRef = useRef(false);
  const fetchPendingRef = useRef(false);

  const fetchBatchData = useCallback(
    async (lastBatchId: bigint) => {
      if (!publicClient || lastBatchId <= 0n) return new Map<bigint, BatchData>();

      const ids = Array.from({ length: Number(lastBatchId) }, (_, i) => BigInt(i + 1));
      const batches = new Map<bigint, BatchData>();
      const chunks = chunkArray(ids, BATCH_INFO_CHUNK);

      for (const chunk of chunks) {
        const results = await publicClient.multicall({
          allowFailure: true,
          contracts: chunk.map((id) => ({
            ...astaverdeContractConfig,
            functionName: "getBatchInfo",
            args: [id],
          })),
        });

        results.forEach((res, idx) => {
          if (res.status === "success" && res.result) {
            batches.set(chunk[idx], res.result as BatchData);
          }
        });

        await sleep(CHUNK_DELAY_MS);
      }

      return batches;
    },
    [astaverdeContractConfig, publicClient],
  );

  const fetchBalances = useCallback(
    async (owner: `0x${string}`, lastTokenId: bigint) => {
      if (!publicClient || lastTokenId <= 0n) {
        return { ownedTokens: [] as bigint[], balances: {} as TokenBalanceRecord };
      }

      const tokenIds = Array.from({ length: Number(lastTokenId) }, (_, i) => BigInt(i + 1));
      const balances: TokenBalanceRecord = {};
      const ownedTokens: bigint[] = [];

      const chunks = chunkArray(tokenIds, BALANCE_CHUNK);

      for (const chunk of chunks) {
        const results = await publicClient.multicall({
          allowFailure: true,
          contracts: chunk.map((tokenId) => ({
            ...astaverdeContractConfig,
            functionName: "balanceOf",
            args: [owner, tokenId],
          })),
        });

        results.forEach((res, idx) => {
          if (res.status === "success") {
            const tokenId = chunk[idx];
            const balance = BigInt(res.result ?? 0);
            balances[tokenId.toString()] = balance;

            if (balance > 0n) {
              for (let i = 0n; i < balance; i++) {
                ownedTokens.push(tokenId);
              }
            }
          }
        });

        await sleep(CHUNK_DELAY_MS);
      }

      return { ownedTokens, balances };
    },
    [astaverdeContractConfig, publicClient],
  );

  const fetchRedeemStatuses = useCallback(
    async (tokenIds: bigint[]) => {
      if (!publicClient || tokenIds.length === 0) return {} as RedeemStatus;

      const uniqueIds = Array.from(new Set(tokenIds));
      const chunks = chunkArray(uniqueIds, REDEEM_CHUNK);
      const statuses: RedeemStatus = {};

      for (const chunk of chunks) {
        const results = await publicClient.multicall({
          allowFailure: true,
          contracts: chunk.map((tokenId) => ({
            ...astaverdeContractConfig,
            functionName: "isRedeemed",
            args: [tokenId],
          })),
        });

        results.forEach((res, idx) => {
          if (res.status === "success") {
            statuses[chunk[idx].toString()] = Boolean(res.result);
          }
        });

        await sleep(CHUNK_DELAY_MS);
      }

      return statuses;
    },
    [astaverdeContractConfig, publicClient],
  );

  const fetchTokens = useCallback(async () => {
    if (fetchInFlightRef.current) {
      fetchPendingRef.current = true;
      return;
    }

    fetchInFlightRef.current = true;
    fetchPendingRef.current = false;

    setIsLoading(true);
    setError(null);

    try {
      if (!publicClient || !address) {
        setTokens([]);
        setVaultedTokens([]);
        setTokenBalances({});
        setRedeemStatus({});
        setBatchData(new Map());
        setIsLoading(false);
        return;
      }

      const [lastTokenID, lastBatchID] = await Promise.all([
        publicClient.readContract({
          ...astaverdeContractConfig,
          functionName: "lastTokenID",
        }),
        publicClient.readContract({
          ...astaverdeContractConfig,
          functionName: "lastBatchID",
        }),
      ]);

      const batches = await fetchBatchData(lastBatchID as bigint);
      setBatchData(batches);

      const { ownedTokens, balances } = await fetchBalances(address, lastTokenID as bigint);
      setTokens(ownedTokens);
      setTokenBalances(balances);

      let loans: bigint[] = [];
      try {
        loans = await getUserLoans();
      } catch {
        loans = [];
      }
      setVaultedTokens(loans);

      const redemptionStatuses = await fetchRedeemStatuses([...ownedTokens, ...loans]);
      setRedeemStatus(redemptionStatuses);
    } catch (err) {
      setError((err as Error)?.message || "Failed to fetch tokens");
    } finally {
      setIsLoading(false);
      fetchInFlightRef.current = false;
      if (fetchPendingRef.current) {
        fetchPendingRef.current = false;
        void fetchTokens();
      }
    }
  }, [address, astaverdeContractConfig, fetchBalances, fetchBatchData, fetchRedeemStatuses, getUserLoans, publicClient]);

  useEffect(() => {
    void fetchTokens();
  }, [fetchTokens]);

  return {
    tokens,
    tokenBalances,
    vaultedTokens,
    redeemStatus,
    batchData,
    isLoading,
    error,
    refetch: fetchTokens,
  };
}
