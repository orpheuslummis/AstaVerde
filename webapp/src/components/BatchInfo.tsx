"use client";

import React from "react";
import { useContractRead } from "wagmi";
import { astaverdeContractConfig } from "../lib/contracts";

interface BatchInfoProps {
    batchID: bigint;
}

export default function BatchInfo({ batchID }: BatchInfoProps) {
    const { data: batchData, isError, isLoading, error } = useContractRead({
        ...astaverdeContractConfig,
        functionName: 'getBatchInfo',
        args: [batchID] as const,
    });

    if (isLoading) {
        return <div>Loading batch information...</div>;
    }

    if (isError) {
        return <div>Error loading batch information: {error?.message}</div>;
    }

    if (!batchData) {
        return <div>No batch information found for ID {batchID.toString()}</div>;
    }

    console.log("BatchInfo batch for ID", batchID, batchData);

    return (
        <div>
            <h3>Batch Information for ID: {batchID.toString()}</h3>
            {/* Render batchData details here */}
            <pre>{JSON.stringify(batchData, null, 2)}</pre>
        </div>
    );
}
