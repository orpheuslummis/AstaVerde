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
    "dailyPriceDecay",
    "priceAdjustDelta",
];

const WRITE_FUNCTIONS = [
    "updateBasePrice",
    "mintBatch",
    "buyBatch",
    "redeemToken",
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
    "setPriceDelta",
    "setDailyPriceDecay",
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

    const isReadOnlyFunction = READ_ONLY_FUNCTIONS.includes(functionName);
    const isWriteFunction = WRITE_FUNCTIONS.includes(functionName);

    const { data: readData, refetch: refetchReadData } = useReadContract({
        ...contractConfig,
        functionName,
        query: {
            enabled: isReadOnlyFunction, // Only query if it's a read function
        },
    });

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
                    result = await publicClient.waitForTransactionReceipt({
                        hash,
                    });
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

    const redeemToken = useCallback(
        async (tokenId: bigint) => {
            try {
                if (!walletClient) {
                    throw new Error("Wallet not connected");
                }
                console.log("Redeeming token:", tokenId);
                const result = await execute(tokenId);
                console.log("Redeem token result:", result);
                return result;
            } catch (error: any) {
                console.error("Error in redeemToken:", error);

                // Check if user rejected the transaction
                if (
                    error.message?.includes("User rejected") ||
                    error.message?.includes("User denied") ||
                    error.code === 4001 ||
                    error.cause?.code === 4001
                ) {
                    throw new Error("Transaction cancelled by user");
                }

                const revertReason = getRevertReason(error);
                throw new Error(`Failed to redeem token: ${revertReason}`);
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
        redeemToken,
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
                // Always fetch the up-to-date unit price at the moment of purchase
                const currentUnitPrice = await publicClient.readContract({
                    ...astaverdeContractConfig,
                    functionName: "getCurrentBatchPrice",
                    args: [batchId],
                });

                // Compute the exact total cost based on the fresh price
                const exactTotalCost = (currentUnitPrice as bigint) * tokenAmount;

                const currentAllowance = allowance ? BigInt(allowance.toString()) : 0n;
                const needsApproval = currentAllowance < exactTotalCost;

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
                    // Approve for 10 tokens worth to avoid multiple approvals
                    const pricePerUnit = currentUnitPrice as bigint;
                    const approvalForMultiplePurchases = 10n; // Approve for up to 10 tokens
                    const approvalAmount = pricePerUnit * approvalForMultiplePurchases;

                    console.log("Calculated approval amount:", formatUnits(approvalAmount, USDC_DECIMALS));
                    console.log("Approval details:", {
                        spender: astaverdeContractConfig.address,
                        amount: approvalAmount.toString(),
                        usdcAddress: getUsdcContractConfig().address,
                    });

                    console.log("Attempting approve with:", {
                        contract: getUsdcContractConfig().address,
                        spender: astaverdeContractConfig.address,
                        amount: approvalAmount.toString(),
                        account: walletClient.account.address,
                        chainId: walletClient.chain?.id,
                    });

                    try {
                        const approveTx = await walletClient.writeContract({
                            ...getUsdcContractConfig(),
                            functionName: "approve",
                            args: [astaverdeContractConfig.address as `0x${string}`, approvalAmount],
                            account: walletClient.account,
                            chain: walletClient.chain,
                            gas: 100000n, // Use fixed gas limit for local network
                        });
                        customToast.info("Approval transaction submitted");
                        await publicClient.waitForTransactionReceipt({
                            hash: approveTx,
                        });
                        customToast.success("Approval confirmed");
                        await refetchAllowance();
                    } catch (approveError: any) {
                        console.error("Approval transaction failed:", approveError);
                        // Try without gas limit as fallback
                        const approveTx = await walletClient.writeContract({
                            ...getUsdcContractConfig(),
                            functionName: "approve",
                            args: [astaverdeContractConfig.address as `0x${string}`, approvalAmount],
                            account: walletClient.account,
                            chain: walletClient.chain,
                        });
                        customToast.info("Approval transaction submitted (retry)");
                        await publicClient.waitForTransactionReceipt({
                            hash: approveTx,
                        });
                        customToast.success("Approval confirmed");
                        await refetchAllowance();
                    }
                }

                // Prepare the arguments for the buyBatch function
                const buyBatchArgs = [batchId, exactTotalCost, tokenAmount];

                // Skip gas estimation for local network, use a fixed high gas limit
                let gasLimit: bigint;
                try {
                    const gasEstimate = await publicClient.estimateContractGas({
                        ...astaverdeContractConfig,
                        functionName: "buyBatch",
                        args: buyBatchArgs,
                        account: walletClient.account,
                    });
                    gasLimit = (gasEstimate * 150n) / 100n;
                    console.log("Estimated gas:", formatUnits(gasLimit, 0));
                } catch (gasError) {
                    console.warn("Gas estimation failed, using default:", gasError);
                    gasLimit = 500000n; // Use a safe default for local network
                }

                const { request } = await publicClient.simulateContract({
                    ...astaverdeContractConfig,
                    functionName: "buyBatch",
                    args: buyBatchArgs,
                    account: walletClient.account,
                    gas: gasLimit,
                });

                const buyTx = await walletClient.writeContract(request);
                customToast.info("Buy transaction submitted");

                // Add timeout and retry logic for transaction confirmation
                const maxRetries = 3;
                let retryCount = 0;
                let receiptConfirmed = false;

                while (retryCount < maxRetries && !receiptConfirmed) {
                    try {
                        const receipt = await publicClient.waitForTransactionReceipt({
                            hash: buyTx,
                            timeout: 30_000, // 30 second timeout per attempt
                            confirmations: 1, // Wait for 1 confirmation (faster for local dev)
                        });

                        if (receipt.status === "success") {
                            customToast.success("Purchase confirmed");
                            receiptConfirmed = true;
                        } else {
                            throw new Error("Transaction failed");
                        }
                        break;
                    } catch (error: any) {
                        retryCount++;
                        console.log(`Transaction confirmation attempt ${retryCount} failed:`, error.message);

                        if (retryCount === maxRetries) {
                            // Check one more time if the transaction was actually successful
                            try {
                                const receipt = await publicClient.getTransactionReceipt({
                                    hash: buyTx,
                                });
                                if (receipt && receipt.status === "success") {
                                    customToast.success("Purchase confirmed");
                                    receiptConfirmed = true;
                                } else {
                                    throw new Error(
                                        "Transaction confirmation timed out. Please refresh the page to see if your purchase completed.",
                                    );
                                }
                            } catch {
                                throw new Error(
                                    "Transaction confirmation timed out. Please refresh the page to see if your purchase completed.",
                                );
                            }
                        } else {
                            // Wait 5 seconds before retrying
                            await new Promise((resolve) => setTimeout(resolve, 5000));
                        }
                    }
                }
            } catch (error: any) {
                // Don't log user rejections to console - it's normal behavior
                if (
                    error?.cause?.name === "UserRejectedRequestError" ||
                    error?.message?.includes("User rejected") ||
                    error?.message?.includes("User denied")
                ) {
                    customToast.info("Transaction cancelled");
                } else {
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
