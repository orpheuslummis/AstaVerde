import { useCallback, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { customToast } from "../../utils/customToast";
import type { RedeemTokensButtonProps } from "../../types";

// Maximum number of tokens to redeem in a single transaction
const BATCH_SIZE = 50; // Adjust this value based on gas limit and contract requirements

// Add this utility function at the top of the file, after imports
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * RedeemTokensButton component for redeeming selected tokens.
 * Handles batch redemption to avoid large transaction sizes.
 *
 * @param {RedeemTokensButtonProps} props - The component props.
 * @returns {JSX.Element} The rendered component.
 */
export default function RedeemTokensButton(
    { selectedTokens, onRedeemComplete, onSelectAll, allTokens, redeemStatus }:
        RedeemTokensButtonProps,
) {
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const { astaverdeContractConfig } = useAppContext();
    const { redeemToken } = useContractInteraction(
        astaverdeContractConfig,
        "redeemToken",
    );

    /**
     * Redeems tokens in batches to manage gas consumption.
     *
     * @param {bigint[]} tokens - Array of token IDs to redeem.
     */
    const redeemBatch = useCallback(async (tokens: bigint[]) => {
        const unredeemed = tokens.filter((tokenId) =>
            !redeemStatus[tokenId.toString()]
        );
        const batch = unredeemed.slice(0, BATCH_SIZE);
        const remaining = unredeemed.slice(BATCH_SIZE);

        if (batch.length === 0) {
            setStatusMessage("No unredeemed tokens in this batch");
            return;
        }

        setStatusMessage(`Redeeming batch of ${batch.length} tokens...`);
        try {
            // Redeem tokens one by one
            for (const tokenId of batch) {
                const receipt = await redeemToken(tokenId);
                if (receipt && receipt.status === "success") {
                    redeemStatus[tokenId.toString()] = true;
                    setProgress((prev) => prev + 1);
                    setStatusMessage(
                        `Token ${tokenId.toString()} redeemed successfully`,
                    );
                } else {
                    throw new Error(
                        `Failed to redeem token ${tokenId.toString()}`,
                    );
                }
            }

            if (remaining.length === 0) {
                await wait(2000);
                onRedeemComplete();
            } else {
                await redeemBatch(remaining);
            }
        } catch (error) {
            throw error;
        }
    }, [redeemToken, redeemStatus, onRedeemComplete]);

    /**
     * Handles the redemption process for selected tokens.
     * Initiates the batch redemption process and manages UI state.
     */
    const handleRedeem = useCallback(async () => {
        const unredeemedTokens = selectedTokens.filter((tokenId) =>
            !redeemStatus[tokenId.toString()]
        );

        if (unredeemedTokens.length === 0) {
            customToast.warning("No unredeemed tokens selected for redemption");
            return;
        }

        setIsRedeeming(true);
        setProgress(0);
        setStatusMessage("Initiating redemption process...");

        try {
            await redeemBatch(unredeemedTokens);
            customToast.success(
                "All selected unredeemed tokens redeemed successfully",
            );
            onRedeemComplete();
        } catch (error: unknown) {
            console.error("Error redeeming tokens:", error);
            if (error instanceof Error) {
                const errorMessage =
                    error.message.includes("Redemption transaction failed")
                        ? "Transaction failed. Please check your wallet for details."
                        : error.message;
                customToast.error(`Failed to redeem tokens: ${errorMessage}`);
                setStatusMessage(`Error: ${errorMessage}`);
            } else {
                customToast.error(
                    "An unknown error occurred while redeeming tokens",
                );
                setStatusMessage(
                    "An unknown error occurred during redemption.",
                );
            }
        } finally {
            setIsRedeeming(false);
            setProgress(0);
            setStatusMessage("");
        }
    }, [selectedTokens, onRedeemComplete, redeemBatch, redeemStatus]);

    const unredeemedSelectedTokens = selectedTokens.filter((tokenId) =>
        !redeemStatus[tokenId.toString()]
    );
    const progressPercentage = isRedeeming
        ? (progress / unredeemedSelectedTokens.length) * 100
        : 0;

    return (
        <div className="flex flex-col space-y-2">
            <div className="flex space-x-2">
                <button
                    onClick={handleRedeem}
                    disabled={isRedeeming ||
                        unredeemedSelectedTokens.length === 0}
                    className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
                    type="button"
                >
                    {isRedeeming
                        ? "Redeeming..."
                        : `Redeem Selected (${unredeemedSelectedTokens.length})`}
                </button>
                <button
                    onClick={onSelectAll}
                    disabled={isRedeeming ||
                        allTokens.length === selectedTokens.length}
                    className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                    type="button"
                >
                    Select All
                </button>
            </div>
            {isRedeeming && (
                <div className="w-full">
                    <div className="bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                    <p className="text-sm mt-1">{statusMessage}</p>
                    <p className="text-sm">
                        {`Progress: ${progress}/${unredeemedSelectedTokens.length} tokens redeemed`}
                    </p>
                </div>
            )}
        </div>
    );
}
