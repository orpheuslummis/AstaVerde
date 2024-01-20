"use client";

import { astaverdeContractConfig } from "../../../lib/contracts";
import { Connected } from "./Connected";
import { useEffect, useState } from "react";
import { useContractWrite, usePrepareContractWrite, useContractRead, useAccount } from "wagmi";

/*
TBD docs
*/
export function AdminControls() {
  return (
    <Connected>
      <h2 className="text-2xl my-6 mx-6">Admin controls</h2>
      <div>
        {/*
        TODO
        <PlatformPercentageControl />
          setPlatformSharePercentage
        <PriceFloorControl />
          setPriceFloor
        <BasePriceControl />
          setBasePrice
        <MaxBatchSizeControl />
          setMaxBatchSize
        */}
        <ClaimPlatformFunds />
        <PauseContractControl />
        <SetURI />
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
        className="px-4 py-2 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={isContractPaused || pauseLoading}
        onClick={pauseWrite}
      >
        Pause
      </button>
      {pauseLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {pauseSuccess && <div className="text-primary">Transaction successful: {JSON.stringify(pauseData)}</div>}
      {pauseError && <div className="text-red-500">Error: {pauseError.message}</div>}

      <button
        className="px-4 py-2 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={!isContractPaused || unpauseLoading}
        onClick={unpauseWrite}
      >
        Unpause
      </button>
      {unpauseLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {unpauseSuccess && <div className="text-primary">Transaction successful: {JSON.stringify(unpauseData)}</div>}
      {unpauseError && <div className="text-red-500">Error: {unpauseError.message}</div>}
    </ControlContainer>
  );
}

// TBD confirm correctness once we have funds going on
function ClaimPlatformFunds() {
  const { address } = useAccount();
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "claimPlatformFunds",
    enabled: false,
    args: [address!],
  });
  const { write, data, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("claimPlatformFunds", { config, write, data, isLoading, isSuccess, error });
  return (
    <ControlContainer title="Claim platform funds">
      <button
        className="px-4 py-2 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={!write}
        onClick={() => write?.()}
      // disabled={isLoading}
      // onClick={write({ args: [address] })}
      >
        Claim
      </button>
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-primary">Transaction successful: {JSON.stringify(data)}</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}

function SetURI() {
  const [uri, setURI] = useState("");
  const { data: currentURI } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "uri",
  });
  console.log("currentURI", currentURI);
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "setURI",
    args: [uri],
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("setURI", { config, write, isLoading, isSuccess, error });

  const handleSetURI = () => {
    if (uri) {
      write?.();
    }
  };

  return (
    <ControlContainer title="Set URI">
      <div className="flex items-center mb-4">
        <input
          type="text"
          value={uri}
          onChange={(e) => setURI(e.target.value)}
          placeholder="Enter URI"
          className="px-4 py-2 mr-2 border border-gray-300 rounded"
        />
        <button
          className="px-4 py-2 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetURI}
        >
          Set URI
        </button>
      </div>
      {currentURI && <div className="text-gray-500 mb-2">Current URI: {currentURI}</div>}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-primary">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}
