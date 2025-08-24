'use client';

import { useAccount, useReadContract } from 'wagmi';
import { astaverdeContractConfig } from '@/lib/contracts';
import { useMemo } from 'react';

/**
 * Hook to determine if the connected wallet is a producer
 * A wallet is considered a producer if it has a non-zero claimable balance
 */
export function useIsProducer() {
  const { address, isConnected } = useAccount();

  // Check producer balance
  const { data: producerBalance, isLoading, refetch } = useReadContract({
    ...astaverdeContractConfig,
    functionName: 'producerBalances',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const isProducer = useMemo(() => {
    if (!isConnected || !address || isLoading) return false;
    // A wallet is a producer if it has any balance (current or historical)
    return producerBalance !== undefined && producerBalance > 0n;
  }, [isConnected, address, isLoading, producerBalance]);

  return {
    isProducer,
    producerBalance,
    isLoading,
    refetch,
  };
}