"use client";

import { astaverdeContractConfig } from "../components/contracts";
import { Connected } from "./Connected";
import { useEffect } from "react";
import { useContractWrite, usePrepareContractWrite, useContractRead, useAccount } from "wagmi";

/*
TBD docs
*/
export function AdminControls() {
  return (
    <Connected>
      <div>
        {/*
        TODO
        <PlatformPercentageControl />
        <PriceFloorControl />
        <BasePriceControl />
        <MaxBatchSizeControl />
        <PriceFloorControl />
      */}
        <ClaimPlatformFunds />
        <PauseContractControl />
      </div>
    </Connected>
  );
}

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    // {/* <div className="flex flex-col items-center justify-center space-y-4 bg-light-blue-200 p-4 rounded-lg"> */}
    <div className="mx-auto max-w-sm my-6 bg-cyan-100 flex flex-col items-center justify-center space-y-4 bg-light-blue-200 p-4 rounded-lg">
      <h2 className="text-xl mb-2">{title}</h2>
      {children}
    </div>
  );
}

function PauseContractControl() {
  const { data: isContractPaused, refetch: refetchIsContractPaused } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "paused",
  });

  const { config: pauseConfig } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "pause",
    enabled: false,
  });
  const {
    write: pauseWrite,
    data: pauseData,
    isLoading: pauseLoading,
    isSuccess: pauseSuccess,
    error: pauseError,
  } = useContractWrite(pauseConfig);

  const { config: unpauseConfig } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "unpause",
    enabled: false,
  });
  const {
    write: unpauseWrite,
    data: unpauseData,
    isLoading: unpauseLoading,
    isSuccess: unpauseSuccess,
    error: unpauseError,
  } = useContractWrite(unpauseConfig);

  useEffect(() => {
    if (pauseSuccess || unpauseSuccess) {
      setTimeout(() => {
        void refetchIsContractPaused();
      }, 5000);
    }
  }, [pauseSuccess, unpauseSuccess, refetchIsContractPaused]);

  return (
    <ControlContainer title="Pause / Unpause">
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={isContractPaused || pauseLoading}
        onClick={pauseWrite}
      >
        Pause
      </button>
      {pauseLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {pauseSuccess && <div className="text-green-500">Transaction successful: {JSON.stringify(pauseData)}</div>}
      {pauseError && <div className="text-red-500">Error: {pauseError.message}</div>}

      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={!isContractPaused || unpauseLoading}
        onClick={unpauseWrite}
      >
        Unpause
      </button>
      {unpauseLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {unpauseSuccess && <div className="text-green-500">Transaction successful: {JSON.stringify(unpauseData)}</div>}
      {unpauseError && <div className="text-red-500">Error: {unpauseError.message}</div>}
    </ControlContainer>
  );
}

// TBD confirm correctnes once we have funds going on
function ClaimPlatformFunds() {
  const { address } = useAccount();
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "claimPlatformFunds",
    // enabled: false,
    args: [address!],
  });
  const { write, data, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("claimPlatformFunds", { config, write, data, isLoading, isSuccess, error });
  return (
    <ControlContainer title="Claim platform funds">
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={!write}
        onClick={() => write?.()}
        // disabled={isLoading}
        // onClick={write({ args: [address] })}
      >
        Claim
      </button>
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful: {JSON.stringify(data)}</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}
