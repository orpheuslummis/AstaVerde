import { useCallback, useState } from 'react';
import { useSimulateContract, useWriteContract } from 'wagmi';

export function useContractInteraction(config) {
    const [isSimulating, setIsSimulating] = useState(false);
    const { data: simulationData, error: simulationError } = useSimulateContract(config);
    const { writeContract, data, error, isPending, isSuccess } = useWriteContract();

    const write = useCallback(async () => {
        if (isSimulating) {
            console.log('Simulation is still in progress');
            return;
        }
        setIsSimulating(true);
        try {
            if (simulationError) {
                throw new Error(`Simulation failed: ${simulationError.message}`);
            }
            if (!simulationData?.request) {
                throw new Error('Simulation data is not available');
            }
            const result = await writeContract(simulationData.request);
            return result;
        } catch (error) {
            console.error('Error in contract interaction:', error);
            throw error;
        } finally {
            setIsSimulating(false);
        }
    }, [simulationData, simulationError, writeContract, isSimulating]);

    return {
        write,
        isSimulating,
        isPending,
        isSuccess,
        error,
    };
}