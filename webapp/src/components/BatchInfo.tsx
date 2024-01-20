"use client";

import React from "react";
import { useState } from "react";
import { paginatedIndexesConfig, useContractInfiniteReads, useContractRead } from "wagmi";
import { astaverdeContractConfig } from "../../../lib/contracts";
import { Batch } from "../lib/batch";

export default function BatchInfo({ batchID }: { batchID: bigint }) {
    const { data: batchData, isError, isLoading, error: lastBatchIDError } = useContractRead({
        ...astaverdeContractConfig,
        functionName: 'getBatchInfo',
        args: [batchID] as const,
    });

    console.log("BatchInfo batch for ID", batchID, batchData);
    return (
        <>
        </>
    )
}