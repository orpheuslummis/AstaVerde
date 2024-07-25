"use client";

import { formatUnits } from "viem";
import { USDC_DECIMALS } from "../app.config";

interface BatchInfoProps {
    batchData: [bigint, bigint[], bigint, bigint, bigint];
}

export default function BatchInfo({ batchData }: BatchInfoProps) {
    const [, tokenIds, creationTime, price, remainingTokens] = batchData;

    return (
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="font-semibold">Creation Time:</p>
                <p>{new Date(Number(creationTime) * 1000).toLocaleString()}</p>
            </div>
            <div>
                <p className="font-semibold">Price:</p>
                <p>{formatUnits(price, USDC_DECIMALS)} USDC</p>
            </div>
            <div>
                <p className="font-semibold">Total Tokens:</p>
                <p>{tokenIds.length}</p>
            </div>
            <div>
                <p className="font-semibold">Remaining Tokens:</p>
                <p>{remainingTokens.toString()}</p>
            </div>
        </div>
    );
}