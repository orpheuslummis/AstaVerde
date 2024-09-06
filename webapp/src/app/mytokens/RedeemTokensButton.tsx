import { useState } from "react";
import { usePublicClient } from "wagmi";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { customToast } from "../../utils/customToast";

interface RedeemTokensButtonProps {
    selectedTokens: bigint[];
    onRedeemComplete: () => void;
}

export default function RedeemTokensButton({ selectedTokens, onRedeemComplete }: RedeemTokensButtonProps) {
    const [isRedeeming, setIsRedeeming] = useState(false);
    const { astaverdeContractConfig } = useAppContext();
    const publicClient = usePublicClient();
    const { redeemTokens } = useContractInteraction(astaverdeContractConfig, "redeemTokens");

    const handleRedeem = async () => {
        if (selectedTokens.length === 0) {
            customToast.warning("No tokens selected for redemption");
            return;
        }

        try {
            setIsRedeeming(true);
            console.log("Attempting to redeem tokens:", selectedTokens);
            const result = await redeemTokens(selectedTokens.map(Number));
            console.log("Redemption result:", result);

            if (typeof result === "string") {
                customToast.info("Redemption transaction submitted");
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash: result as `0x${string}` });
                    customToast.success("Tokens redeemed successfully");
                    onRedeemComplete();
                } else {
                    throw new Error("Public client not available");
                }
            } else {
                throw new Error("Unexpected result from redeemTokens");
            }
        } catch (error) {
            console.error("Error redeeming tokens:", error);
            if (error instanceof Error) {
                customToast.error(`Failed to redeem tokens: ${error.message}`);
            } else {
                customToast.error("An unknown error occurred while redeeming tokens");
            }
        } finally {
            setIsRedeeming(false);
        }
    };

    return (
        <button
            onClick={handleRedeem}
            disabled={isRedeeming || selectedTokens.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
        >
            {isRedeeming ? "Redeeming..." : `Redeem Selected (${selectedTokens.length})`}
        </button>
    );
}
