"use client";

import { astaverdeContractConfig } from "../lib/contracts";
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
        <PlatformPercentageControl />
        <AuctionTimeThresholdsControl />
        <MaxBatchSizeControl />
        <PriceFloorControl />
        <BasePriceControl />
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
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetURI}
        >
          Set URI
        </button>
      </div>
      {currentURI && <div className="text-gray-500 mb-2">Current URI: {currentURI}</div>}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}

function PriceFloorControl() {
  const [priceFloor, setPriceFloor] = useState("");
  const { data: currentPriceFloor } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "priceFloor",
  });
  console.log("currentPriceFloor", currentPriceFloor);
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "setPriceFloor",
    args: [BigInt(priceFloor)],
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("setPriceFloor", { config, write, isLoading, isSuccess, error });

  const handleSetPriceFloor = () => {
    if (priceFloor) {
      write?.();
    }
  };

  return (
    <ControlContainer title="Set Price Floor">
      <div className="flex items-center mb-4">
        <input
          type="text"
          value={priceFloor}
          onChange={(e) => setPriceFloor(e.target.value)}
          placeholder="Enter Price Floor"
          className="px-4 py-2 mr-2 border border-gray-300 rounded"
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetPriceFloor}
        >
          Set Price Floor
        </button>
      </div>
      {currentPriceFloor !== undefined && (
        <div className="text-gray-500 mb-2">Current Price floor: {currentPriceFloor.toString()}</div>
      )}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}

function BasePriceControl() {
  const [basePrice, setBasePrice] = useState("");
  const { data: currentBasePrice } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "basePrice",
  });
  console.log("currentBasePrice", currentBasePrice);
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "setBasePrice",
    args: [BigInt(basePrice)],
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("setBasePrice", { config, write, isLoading, isSuccess, error });

  const handleSetBasePrice = () => {
    if (basePrice) {
      write?.();
    }
  };

  return (
    <ControlContainer title="Set Base Price">
      <div className="flex items-center mb-4">
        <input
          type="text"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          placeholder="Enter Base Price"
          className="px-4 py-2 mr-2 border border-gray-300 rounded"
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetBasePrice}
        >
          Set Base Price
        </button>
      </div>
      {currentBasePrice !== undefined && (
        <div className="text-gray-500 mb-2">Current Base Price: {currentBasePrice.toString()}</div>
      )}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}

function MaxBatchSizeControl() {
  const [maxMatchSize, setMaxMatchSize] = useState("");
  const { data: currentMaxMatchSize } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "maxBatchSize",
  });
  console.log("currentBasePrice", currentMaxMatchSize);
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "setMaxBatchSize",
    args: [BigInt(maxMatchSize)],
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("setMaxMatchSize", { config, write, isLoading, isSuccess, error });

  const handleSetMaxMatchSize = () => {
    if (maxMatchSize) {
      write?.();
    }
  };

  return (
    <ControlContainer title="Set Max Match Size">
      <div className="flex items-center mb-4">
        <input
          type="text"
          value={maxMatchSize}
          onChange={(e) => setMaxMatchSize(e.target.value)}
          placeholder="Enter Max Match Size"
          className="px-4 py-2 mr-2 border border-gray-300 rounded"
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetMaxMatchSize}
        >
          Set Max Match Size
        </button>
      </div>
      {currentMaxMatchSize !== undefined && (
        <div className="text-gray-500 mb-2">Current Max Match Size: {currentMaxMatchSize.toString()}</div>
      )}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}

function AuctionTimeThresholdsControl() {
  const [dayIncreaseThreshold, setDayIncreaseThreshold] = useState("");
  const [dayDecreaseThreshold, setDayDecreaseThreshold] = useState("");
  const { data: currentDayIncreaseThreshold } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "dayIncreaseThreshold",
  });
  const { data: currentDayDecreaseThreshold } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "dayDecreaseThreshold",
  });
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "setAuctionTimeThresholds",
    args: [BigInt(dayIncreaseThreshold), BigInt(dayDecreaseThreshold)],
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("setAuctionTimeThresholds", { config, write, isLoading, isSuccess, error });

  const handleSetMaxMatchSize = () => {
    if (dayIncreaseThreshold && dayDecreaseThreshold) {
      write?.();
    }
  };

  return (
    <ControlContainer title="Set Auction Threshold">
      <div className="flex items-center mb-4">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={dayIncreaseThreshold}
            onChange={(e) => setDayIncreaseThreshold(e.target.value)}
            placeholder="Enter Increase Days"
            className="px-4 py-2 mr-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            value={dayDecreaseThreshold}
            onChange={(e) => setDayDecreaseThreshold(e.target.value)}
            placeholder="Enter Decrease Days"
            className="px-4 py-2 mr-2 border border-gray-300 rounded"
          />
        </div>

        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetMaxMatchSize}
        >
          Set Auction Threshold
        </button>
      </div>

      {currentDayIncreaseThreshold !== undefined && (
        <div className="text-gray-500 mb-2">
          Current Day Increase Threshold: {currentDayIncreaseThreshold.toString()}
        </div>
      )}
      {currentDayDecreaseThreshold !== undefined && (
        <div className="text-gray-500 mb-2">
          Current Day Decrease Threshold: {currentDayDecreaseThreshold.toString()}
        </div>
      )}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}

function PlatformPercentageControl() {
  const [platformSharePercentage, setPlatformSharePercentage] = useState("");
  const { data: currentPlatformSharePercentage } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "platformSharePercentage",
  });
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName: "setPlatformSharePercentage",
    args: [BigInt(platformSharePercentage)],
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);
  console.log("setPlatformSharePercentage", { config, write, isLoading, isSuccess, error });

  const handleSetPlatformSharePercentage = () => {
    if (platformSharePercentage) {
      write?.();
    }
  };

  return (
    <ControlContainer title="Set Platform Share Percentage">
      <div className="flex items-center mb-4">
        <input
          type="text"
          value={platformSharePercentage}
          onChange={(e) => setPlatformSharePercentage(e.target.value)}
          placeholder="Enter Platform Share Percentage"
          className="px-4 py-2 mr-2 border border-gray-300 rounded"
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!write || isLoading}
          onClick={handleSetPlatformSharePercentage}
        >
          Set Platform Share Percentage
        </button>
      </div>
      {currentPlatformSharePercentage !== undefined && (
        <div className="text-gray-500 mb-2">
          Current Platform Share Percentage: {currentPlatformSharePercentage.toString()}
        </div>
      )}
      {isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {isSuccess && <div className="text-green-500">Transaction successful</div>}
      {error && <div className="text-red-500">Error: {error.message}</div>}
    </ControlContainer>
  );
}
