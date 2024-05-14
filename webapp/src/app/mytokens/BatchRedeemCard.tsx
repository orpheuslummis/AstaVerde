import { useAccount, useContractRead, usePrepareContractWrite, useContractWrite, useWaitForTransaction } from "wagmi";
import { useEffect, useState, useCallback } from "react";
import { astaverdeContractConfig } from "../../lib/contracts";
import RedeemableTokenNumber from "./RedeemableTokenNumber";

interface BatchProps {
    batch: {
        id: number;
        token_ids: number[];
        creationTime: number;
        price: number;
        remainingTokens: number;
    };
}

export default function BatchRedeemCard({ batch }: BatchProps) {
    const { address } = useAccount();
    const [sameAddresses, setSameAddresses] = useState<`0x${string}`[]>();
    const [redeemableTokens, setRedeemableTokens] = useState<bigint[]>([]);
    const [awaitedHash, setAwaitedHash] = useState<`0x${string}`>();
    const { data: txReceipt } = useWaitForTransaction({ hash: awaitedHash });

    useEffect(() => {
        if (address && batch) {
            const _sameAddresses: `0x${string}`[] = [];
            for (let i = 0; i < batch.token_ids.length; i++) {
                _sameAddresses.push(address);
            }
            setSameAddresses(_sameAddresses);
        }
    }, [batch, address]);

    const { data: ownedIndex } = useContractRead({
        ...astaverdeContractConfig,
        functionName: "balanceOfBatch",
        enabled: sameAddresses !== undefined,
        args: [sameAddresses || [], batch.token_ids as unknown as bigint[]],
    });

    const ownerTokens = useCallback(() => {
        if (ownedIndex && Array.isArray(ownedIndex)) {
            return batch.token_ids.filter((_, index) => +ownedIndex[index] === 1);
        }
        return [];
    }, [batch.token_ids, ownedIndex]);

    const { config } = usePrepareContractWrite({
        ...astaverdeContractConfig,
        functionName: "redeemTokens",
        enabled: redeemableTokens.length > 0,
        args: [redeemableTokens],
    });
    const { writeAsync: redeemTokens } = useContractWrite(config);

    if (ownerTokens().length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold">Batch {batch.id}</h2>
            {ownerTokens().map((redeemableToken) => (
                <RedeemableTokenNumber
                    key={redeemableToken}
                    txReceipt={txReceipt}
                    redeemableToken={redeemableToken}
                    setRedeemableTokens={setRedeemableTokens}
                />
            ))}
            <div className="w-full flex justify-between">
                <button
                    className={`mt-4 font-bold py-2 px-4 rounded text-white ${redeemTokens ? "bg-primary hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"
                        }`}
                    type="button"
                    disabled={!redeemTokens}
                    onClick={async () => {
                        if (redeemTokens) {
                            const result = await redeemTokens();
                            setAwaitedHash(result.hash);
                        }
                    }}
                >
                    Redeem
                </button>
            </div>
        </div>
    );
}
