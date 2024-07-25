import { useCallback, useState } from 'react';
import { useContractContext } from '../contexts/ContractContext';

export function useBuyBatch(batch) {
    const { useSimulateContract, useWriteContract, astaverdeContractConfig } = useContractContext();
    const [isSimulating, setIsSimulating] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const { data: simulationData, error: simulationError } = useSimulateContract({
        ...astaverdeContractConfig,
        functionName: 'buyBatch',
        args: [BigInt(batch.id)],
    });

    const { writeContract } = useWriteContract();

    const handleBuy = useCallback(async () => {
        if (isSimulating || !simulationData?.request) return;
        setIsPending(true);
        try {
            const result = await writeContract(simulationData.request);
            return result;
        } catch (error) {
            console.error('Error in buying:', error);
            throw error;
        } finally {
            setIsPending(false);
        }
    }, [isSimulating, simulationData, writeContract]);

    return {
        handleBuy,
        isSimulating,
        isPending,
        simulationError,
    };
}