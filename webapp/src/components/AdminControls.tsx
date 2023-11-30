"use client";

import { astaverdeContractConfig } from "../components/contracts";
// import { useState } from "react";
// import { BaseError } from "viem";
import { useContractWrite, usePrepareContractWrite } from "wagmi";

export function AdminControls() {
  return (
    <div>
      {/* <ClaimPlatformFunds />
        <PlatformPercentageControl />
        <PriceFloorControl />
        <BasePriceControl />
        <MaxBatchSizeControl />
        <PriceFloorControl /> */}
      <PauseContractControl />
    </div>
  );
}

function PauseContractControl() {
  const { config: pauseConfig } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "pause",
  });
  const {
    data: pauseData,
    isLoading: pauseLoading,
    isSuccess: pauseSuccess,
    write: pauseWrite,
  } = useContractWrite(pauseConfig);

  const { config: unpauseConfig } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "unpause",
  });
  const {
    data: unpauseData,
    isLoading: unpauseLoading,
    isSuccess: unpauseSuccess,
    write: unpauseWrite,
  } = useContractWrite(unpauseConfig);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 bg-light-blue-200 p-4 rounded-lg">
      <h2 className="text-2xl mb-4">Pause / Unpause</h2>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={!pauseWrite}
        onClick={() => pauseWrite?.()}
      >
        Pause Contract
      </button>
      {pauseLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {pauseSuccess && <div className="text-green-500">Transaction successful: {JSON.stringify(pauseData)}</div>}
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={!unpauseWrite}
        onClick={() => unpauseWrite?.()}
      >
        Unpause Contract
      </button>
      {unpauseLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {unpauseSuccess && <div className="text-green-500">Transaction successful: {JSON.stringify(unpauseData)}</div>}
    </div>
  );
}

// ---------------

/*
function TotalSupply() {
  const { data, isRefetching, refetch } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "totalSupply",
  });

  return (
    <div>
      Total Supply: {data?.toString()}
      <button disabled={isRefetching} onClick={() => refetch()} style={{ marginLeft: 4 }}>
        {isRefetching ? "loading..." : "refetch"}
      </button>
    </div>
  );
}

function BalanceOf() {
  const [address, setAddress] = useState<Address>("0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC");
  const { data, error, isLoading, isSuccess } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "balanceOf",
    args: [address],
    enabled: Boolean(address),
  });

  const [value, setValue] = useState<string>(address);

  return (
    <div>
      Token balance: {isSuccess && data?.toString()}
      <input
        onChange={(e) => setValue(e.target.value)}
        placeholder="wallet address"
        style={{ marginLeft: 4 }}
        value={value}
      />
      <button onClick={() => setAddress(value as Address)}>{isLoading ? "fetching..." : "fetch"}</button>
      {error && <div>{(error as BaseError).shortMessage}</div>}
    </div>
  );
}

*/
