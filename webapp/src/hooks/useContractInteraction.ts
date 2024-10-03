import { multicall } from "@wagmi/core";
import { useCallback, useMemo, useState } from "react";
import { formatUnits } from "viem";
import {
    useBalance,
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

const READ_ONLY_FUNCTIONS = [
    "uri",
    "balanceOf",
    "lastTokenID",
    "tokens",
    "getCurrentBatchPrice",
    "getBatchInfo",
    "lastBatchID",
    "platformShareAccumulated",
    "basePrice",
    "priceFloor",
    "priceDelta",
    "priceDecreaseRate",
    "dayIncreaseThreshold",
    "dayDecreaseThreshold",
    "lastPriceChangeTime",
    "pricingInfo",
    "maxBatchSize",
    "platformSharePercentage",
    "supportsInterface",
    "balanceOf",
    "tokenOfOwnerByIndex",
    "lastTokenID",
];

const WRITE_FUNCTIONS = [
    "updateBasePrice",
    "mintBatch",
    "buyBatch",
    "redeemTokens",
    "claimPlatformFunds",
    "pause",
    "unpause",
    "setURI",
    "setPriceFloor",
    "setBasePrice",
    "setMaxBatchSize",
    "setAuctionDayThresholds",
    "setPlatformSharePercentage",
    "mint",
    "setPriceDecreaseRate",
];

type ExecuteFunction = (...args: unknown[]) => Promise<any>;

type ContractError = Error | null;

export function useContractInteraction(contractConfig: any, functionName: string) {
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

    const isReadOnlyFunction = READ_ONLY_FUNCTIONS.includes(functionName);
    const isWriteFunction = WRITE_FUNCTIONS.includes(functionName);

    const execute: ExecuteFunction = useCallback(
        async (...args: unknown[]) => {
            if (!publicClient || !contractConfig) return;

            try {
                let result;
                if (isReadOnlyFunction) {
                    result = await publicClient.readContract({
                        ...contractConfig,
                        functionName,
                        args,
                    });
                } else if (isWriteFunction) {
                    if (!walletClient) throw new Error("Wallet not connected");
                    
                    // Simulate the transaction first
                    const { request } = await publicClient.simulateContract({
                        ...contractConfig,
                        functionName,
                        args,
                        account: walletClient.account,
                    });
                    
                    // If simulation is successful, send the actual transaction
                    const hash = await writeContractAsync(request);
                    result = await publicClient.waitForTransactionReceipt({ hash });
                } else {
                    throw new Error(`Unknown function: ${functionName}`);
                }
                return result;
            } catch (error) {
                console.error(`Error in ${functionName} interaction:`, error);
                throw error;
            }
        },
        [
            publicClient,
            walletClient,
            contractConfig,
            functionName,
            isReadOnlyFunction,
            isWriteFunction,
            writeContractAsync,
        ],
    );

    const mintBatch = useCallback(
        async (producers: string[], cids: string[]) => {
            console.log("mintBatch called with producers:", producers, "and cids:", cids);
            return execute(producers, cids);
        },
        [execute],
    );

    const buyBatch = useCallback(
        async (batchID: number, usdcAmount: bigint, tokenAmount: number) => {
            return execute(batchID, usdcAmount, tokenAmount);
        },
        [execute],
    );

    const claimPlatformFunds = useCallback(
        async (to: string) => {
            return execute(to);
        },
        [execute],
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
                const ownedTokens: number[] = [];

                for (let i = 0; i < batches; i++) {
                    const start = i * batchSize + 1;
                    const end = Math.min((i + 1) * batchSize, Number(lastTokenID));

                    const calls = Array.from({ length: end - start + 1 }, (_, index) => ({
                        ...contractConfig,
                        functionName: "balanceOf",
                        args: [ownerAddress, BigInt(start + index)],
                    }));

                    const results = await multicall(config, {
                        contracts: calls as any[],
                        allowFailure: true,
                    });

                    results.forEach((result, index) => {
                        if (result.status === "success" && typeof result.result === "bigint" && result.result > 0n) {
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

    const getCurrentBatchPrice = useCallback(
        async (batchId: number) => {
            try {
                if (!publicClient) {
                    throw new Error("Public client not available");
                }

                const price = await publicClient.readContract({
                    ...contractConfig,
                    functionName: "getCurrentBatchPrice",
                    args: [BigInt(batchId)],
                });

                console.log(`Current price for batch ${batchId}:`, price);
                return price;
            } catch (error) {
                console.error("Error in getCurrentBatchPrice:", error);
                throw error;
            }
        },
        [publicClient, contractConfig],
    );

    const getRevertReason = (error: any): string => {
        if (error.data && error.data.message) {
            return error.data.message;
        } else if (error.message) {
            return error.message;
        } else {
            return "Transaction failed without a reason.";
        }
    };

    const redeemTokens = useCallback(
        async (tokenIds: number[]) => {
            try {
                if (!walletClient) {
                    throw new Error("Wallet not connected");
                }
                console.log("Redeeming tokens:", tokenIds);
                const result = await execute(tokenIds.map((id) => BigInt(id)));
                console.log("Redeem tokens result:", result);
                return result;
            } catch (error: any) {
                console.error("Error in redeemTokens:", error);
                const revertReason = getRevertReason(error);
                throw new Error(`Failed to redeem tokens: ${revertReason}`);
            }
        },
        [execute, walletClient],
    );

    const getBatchInfo = useCallback(
        async (batchId: number) => {
            console.log(`Fetching info for batch ${batchId}`);
            try {
                if (!publicClient) {
                    throw new Error("Public client is not available");
                }

                const result = await execute(batchId);
                console.log(`Raw batch ${batchId} info:`, result);

                if (Array.isArray(result) && result.length === 5) {
                    return result;
                } else {
                    throw new Error(`Unexpected format for batch ${batchId} info`);
                }
            } catch (error) {
                console.error(`Error fetching batch ${batchId} info:`, error);
                throw error;
            }
        },
        [execute, publicClient],
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
        getCurrentBatchPrice,
        redeemTokens,
        mintBatch,
        buyBatch,
        claimPlatformFunds,
        getBatchInfo,
    };
}

export function useBatchOperations(batchId: bigint, totalPrice: bigint) {
    const { astaverdeContractConfig, getUsdcContractConfig } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        ...getUsdcContractConfig(),
        functionName: "allowance",
        args: [walletClient?.account.address, astaverdeContractConfig.address],
    });

    const { data: usdcBalance } = useBalance({
        address: walletClient?.account.address,
        token: getUsdcContractConfig().address,
    });

    const hasEnoughUSDC = useMemo(() => {
        if (!usdcBalance) return false;
        return BigInt(usdcBalance.value) >= totalPrice;
    }, [usdcBalance, totalPrice]);

    const handleApproveAndBuy = useCallback(
        async (tokenAmount: bigint, usdcAmount: bigint) => {
            if (!walletClient) throw new Error("Wallet not connected");
            if (!publicClient) throw new Error("Public client not available");
            setIsLoading(true);
            try {
                const currentAllowance = allowance ? BigInt(allowance.toString()) : 0n;
                const needsApproval = currentAllowance < usdcAmount;

                if (needsApproval) {
                    // Fetch the current max batch size from the contract
                    const maxBatchSize = await publicClient.readContract({
                        ...astaverdeContractConfig,
                        functionName: "maxBatchSize",
                    });

                    // Safely convert maxBatchSize to a bigint
                    let maxBatchSizeBigInt: bigint;
                    if (typeof maxBatchSize === "bigint") {
                        maxBatchSizeBigInt = maxBatchSize;
                    } else if (typeof maxBatchSize === "number") {
                        maxBatchSizeBigInt = BigInt(maxBatchSize);
                    } else if (typeof maxBatchSize === "string") {
                        maxBatchSizeBigInt = BigInt(maxBatchSize);
                    } else {
                        throw new Error("Unexpected type for maxBatchSize");
                    }

                    // Calculate a reasonable approval amount
                    const pricePerUnit = BigInt(usdcAmount) / BigInt(tokenAmount);
                    const bufferFactor = 100n; // Adjust this as needed
                    const approvalAmount = maxBatchSizeBigInt * pricePerUnit * bufferFactor;

                    console.log("Calculated approval amount:", formatUnits(approvalAmount, USDC_DECIMALS));

                    const approveTx = await walletClient.writeContract({
                        ...getUsdcContractConfig(),
                        functionName: "approve",
                        args: [astaverdeContractConfig.address, approvalAmount],
                    });
                    customToast.info("Approval transaction submitted");
                    await publicClient.waitForTransactionReceipt({
                        hash: approveTx,
                    });
                    customToast.success("Approval confirmed");
                    await refetchAllowance();
                }

                // Prepare the arguments for the buyBatch function
                const buyBatchArgs = [batchId, usdcAmount, tokenAmount];

                // Estimate gas for the buy transaction
                const gasEstimate = await publicClient.estimateContractGas({
                    ...astaverdeContractConfig,
                    functionName: "buyBatch",
                    args: buyBatchArgs,
                    account: walletClient.account.address,
                });

                // Add a buffer to the estimated gas (e.g., 20% more)
                const estimatedGas = (gasEstimate * 120n) / 100n;

                console.log("Estimated gas:", formatUnits(estimatedGas, 0));

                const { request } = await publicClient.simulateContract({
                    ...astaverdeContractConfig,
                    functionName: "buyBatch",
                    args: buyBatchArgs,
                    account: walletClient.account.address,
                    gas: estimatedGas,
                });

                const buyTx = await walletClient.writeContract(request);
                customToast.info("Buy transaction submitted");
                await publicClient.waitForTransactionReceipt({ hash: buyTx });
                customToast.success("Purchase confirmed");
            } catch (error) {
                console.error("Error in approve and buy process:", error);
                if (error instanceof Error) {
                    if (error.message.includes("Insufficient funds sent")) {
                        customToast.error("Insufficient USDC balance for this purchase.");
                    } else {
                        customToast.error("Transaction failed: " + error.message);
                    }
                } else {
                    customToast.error("An unknown error occurred during the transaction.");
                }
            } finally {
                setIsLoading(false);
            }
        },
        [
            walletClient,
            publicClient,
            allowance,
            batchId,
            astaverdeContractConfig,
            getUsdcContractConfig,
            refetchAllowance,
        ],
    );

    return { handleApproveAndBuy, isLoading, hasEnoughUSDC };
}