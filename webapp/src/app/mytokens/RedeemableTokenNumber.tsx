import Link from "next/link";
import { ChangeEvent, Dispatch, SetStateAction, useEffect } from "react";
import { TransactionReceipt } from "viem";
import { useReadContract } from "wagmi";
import { astaverdeContractConfig } from "../../lib/contracts";

interface RedeemableTokenNumberProps {
    txReceipt: TransactionReceipt | undefined;
    redeemableToken: number;
    setRedeemableTokens: Dispatch<SetStateAction<bigint[]>>;
}

export default function RedeemableTokenNumber({
    txReceipt,
    redeemableToken,
    setRedeemableTokens,
}: RedeemableTokenNumberProps) {
    const { data: tokenInfo, refetch: refreshTokenInfo, error } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "tokens",
        args: [BigInt(redeemableToken)],
    });

    if (error) {
        console.error('Error fetching token info:', error);
        return null;
    }

    useEffect(() => {
        if (txReceipt) {
            void refreshTokenInfo();
        }
    }, [txReceipt, refreshTokenInfo]);

    const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
        const isChecked = event.target.checked;
        if (isChecked) {
            setRedeemableTokens((prev) => [...prev, BigInt(redeemableToken)]);
        } else {
            setRedeemableTokens((prev) => prev.filter((n) => n !== BigInt(redeemableToken)));
        }
    };

    if (!tokenInfo) {
        return null;
    }

    const tokenInfoArray = tokenInfo as [bigint, string, boolean, boolean];

    return (
        <div>
            <Link href={`/token/${tokenInfoArray[0].toString()}`}>Token {tokenInfoArray[0].toString()}</Link>
            : {tokenInfoArray[3] === false ? "Not redeemed" : "Redeemed"}
            {tokenInfoArray[3] === false && (
                <input
                    className="ml-2"
                    type="checkbox"
                    value="1"
                    onChange={(e) => handleCheckboxChange(e)}
                />
            )}
        </div>
    );
}