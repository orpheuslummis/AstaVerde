import { multicall } from "@wagmi/core";
import { useCallback, useState } from "react";
import { parseUnits } from "viem";
import {
    usePublicClient,
    useReadContract,
    useSimulateContract,
    useWalletClient,
    useWriteContract,
} from "wagmi";
import { USDC_DECIMALS } from "../app.config";
import { useAppContext } from "../contexts/AppContext";
import { customToast } from "../utils/customToast";
import { config } from "../wagmi";

const READ_ONLY_FUNCTIONS = ["uri", "balanceOf", "lastTokenID", "tokens"];

type ExecuteFunction = (...args: any[]) => Promise<any>;

type ContractError = Error | null;

export function useContractInteraction(
    contractConfig: any,
    functionName: string,
) {
    const [isSimulating, setIsSimulating] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<ContractError>(null);
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();
    const { writeContractAsync } = useWriteContract();
    const {
        data: simulationData,
        error: simulationError,
        refetch: refetchSimulation,
    } = useSimulateContract({
        ...contractConfig,
        functionName,
        enabled: false, // Disable automatic simulation
    });

    const { data: readData, refetch: refetchReadData } = useReadContract({
        ...contractConfig,
        functionName,
    });

    const isReadOnlyFunction =
        READ_ONLY_FUNCTIONS.includes(functionName) || contractConfig.readOnly;

    const execute: ExecuteFunction = useCallback(
        async (...executionArgs) => {
            setIsSimulating(true);
            setError(null);
            try {
                console.log(
                    `Executing ${functionName} with args:`,
                    executionArgs,
                );
                console.log("Contract config:", contractConfig);

                if (!publicClient) {
                    throw new Error("Public client not available");
                }

                if (isReadOnlyFunction) {
                    const result = await publicClient.readContract({
                        ...contractConfig,
                        functionName,
                        args: executionArgs,
                    });
                    console.log(`${functionName} result:`, result);
                    return result;
                }

                if (!walletClient) {
                    throw new Error("Wallet client not available");
                }

                const { request } = await publicClient.simulateContract({
                    ...contractConfig,
                    functionName,
                    args: executionArgs,
                    account: walletClient.account,
                });

                setIsPending(true);
                console.log(
                    "Executing writeContractAsync with request:",
                    request,
                );
                const hash = await writeContractAsync(request);
                console.log(`${functionName} transaction hash:`, hash);
                return hash;
            } catch (error) {
                console.error(`Error in ${functionName} interaction:`, error);
                setError(
                    error instanceof Error
                        ? error
                        : new Error("An unknown error occurred"),
                );
                throw error;
            } finally {
                setIsSimulating(false);
                setIsPending(false);
            }
        },
        [
            publicClient,
            functionName,
            walletClient,
            writeContractAsync,
            contractConfig,
            isReadOnlyFunction,
        ],
    );

    const getTokensOfOwner = useCallback(
        async (ownerAddress: string) => {
            try {
                if (!publicClient) {
                    throw new Error("Public client not available");
                }

                const lastTokenID = await publicClient.readContract({
                    ...contractConfig,
                    functionName: "lastTokenID",
                });

                console.log("Last Token ID:", lastTokenID);

                const batchSize = 500; // Adjust based on your needs and RPC provider limits
                const batches = Math.ceil(Number(lastTokenID) / batchSize);
                let ownedTokens: number[] = [];

                for (let i = 0; i < batches; i++) {
                    const start = i * batchSize + 1;
                    const end = Math.min(
                        (i + 1) * batchSize,
                        Number(lastTokenID),
                    );

                    const calls = Array.from(
                        { length: end - start + 1 },
                        (_, index) => ({
                            ...contractConfig,
                            functionName: "balanceOf",
                            args: [ownerAddress, BigInt(start + index)],
                        }),
                    );

                    const results = await multicall(config, {
                        contracts: calls as any[],
                        allowFailure: true,
                    });

                    results.forEach((result, index) => {
                        if (
                            result.status === "success" &&
                            typeof result.result === "bigint" &&
                            result.result > 0n
                        ) {
                            ownedTokens.push(start + index);
                        }
                    });
                }

                console.log("Owned tokens:", ownedTokens);
                return ownedTokens;
            } catch (error) {
                console.error("Error in getTokensOfOwner:", error);
                throw error;
            }
        },
        [publicClient, contractConfig, config],
    );

    return {
        execute,
        isSimulating,
        isPending,
        error,
        simulationError,
        readData,
        refetchReadData,
        refetchSimulation,
        getTokensOfOwner,
    };
}

export function useBatchOperations(batchId: number, totalPrice: number) {
    const { astaverdeContractConfig, getUsdcContractConfig, refetchBatches } =
        useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        ...getUsdcContractConfig(),
        functionName: "allowance",
        args: [walletClient?.account.address, astaverdeContractConfig.address],
    });

    const handleApproveAndBuy = useCallback(
        async (tokenAmount: number, price: number) => {
            if (!walletClient) throw new Error("Wallet not connected");
            if (!publicClient) throw new Error("Public client not available");
            setIsLoading(true);
            try {
                const approveAmount = parseUnits(
                    totalPrice.toString(),
                    USDC_DECIMALS,
                );
                const currentAllowance = allowance
                    ? BigInt(allowance.toString())
                    : 0n;
                const needsApproval = currentAllowance < approveAmount;

                if (needsApproval) {
                    const approveTx = await walletClient.writeContract({
                        ...getUsdcContractConfig(),
                        functionName: "approve",
                        args: [astaverdeContractConfig.address, approveAmount],
                    });
                    customToast.info("Approval transaction submitted");
                    await publicClient.waitForTransactionReceipt({
                        hash: approveTx,
                    });
                    customToast.success("Approval confirmed");
                    await refetchAllowance();
                }

                const buyTx = await walletClient.writeContract({
                    ...astaverdeContractConfig,
                    functionName: "buyBatch",
                    args: [
                        BigInt(batchId),
                        parseUnits(price.toString(), USDC_DECIMALS),
                        BigInt(tokenAmount),
                    ],
                });
                customToast.info("Buy transaction submitted");
                await publicClient.waitForTransactionReceipt({ hash: buyTx });
                customToast.success("Purchase confirmed");
                await refetchBatches();
            } catch (error) {
                console.error("Error in approve and buy process:", error);
                customToast.error("Transaction failed");
            } finally {
                setIsLoading(false);
            }
        },
        [
            walletClient,
            publicClient,
            allowance,
            totalPrice,
            batchId,
            astaverdeContractConfig,
            getUsdcContractConfig,
            refetchAllowance,
            refetchBatches,
        ],
    );

    return { handleApproveAndBuy, isLoading };
}
