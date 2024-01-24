"use client";

import React, { useEffect, useState } from "react";
import { useContractRead } from "wagmi";
import { astaverdeContractConfig } from "../../../lib/contracts";

export default function Page({ params }: { params: { id: bigint } }) {

  const {
    data,
    isError,
    isLoading,
    error: lastBatchIDError,
  } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "tokens",
    args: [params.id],
  });


  if (isLoading) {
    return <p>Loading...</p>;
  } else if (isError) {
    return <p>Error: {lastBatchIDError && lastBatchIDError.message}</p>;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <div style={{ backgroundColor: "#f0f0f0", padding: "20px", borderRadius: "5px" }}>
        <h1>Token: {params.id.toString()}</h1>
        <p>tokenId: {data && data[0].toString()}</p>
        <p>producer: {data && data[1]}</p>
        <p>cid: {data && data[2]}</p>
        <p>isRedeemed: {data && data[3]}</p>
      </div>
    </div>
  );
} 