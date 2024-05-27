"use client";

import { useState, useEffect } from "react";
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from "wagmi";
import { astaverdeContractConfig } from "../lib/contracts";
import { Connected } from "./Connected";

export function AdminControls() {
  return (
    <Connected>
      <h2 className="text-2xl my-6 mx-6">Admin Controls</h2>
      <div>
        {controls.map((Control, index) => (
          <Control key={index} />
        ))}
      </div>
    </Connected>
  );
}

const controls = [
  PlatformPercentageControl,
  AuctionTimeThresholdsControl,
  MaxBatchSizeControl,
  PriceFloorControl,
  BasePriceControl,
  ClaimPlatformFunds,
  PauseContractControl,
  SetURI,
];

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="mx-auto max-w-sm my-6 bg-cyan-100 p-4 rounded-lg shadow-md">
      <h2 className="text-xl mb-2">{title}</h2>
      {children}
    </div>
  );
}

function useContractInteraction({
  functionName,
  args = [],
  onSuccessCallback,
}: {
  functionName: string;
  args?: any[];
  onSuccessCallback?: () => void;
}) {
  const { config } = usePrepareContractWrite({
    ...astaverdeContractConfig,
    functionName,
    args,
  });
  const { write, isLoading, isSuccess, error } = useContractWrite(config);

  useEffect(() => {
    if (isSuccess && onSuccessCallback) {
      onSuccessCallback();
    }
  }, [isSuccess, onSuccessCallback]);

  return { write, isLoading, isSuccess, error };
}

function PauseContractControl() {
  const { data: isContractPaused, refetch: refetchIsContractPaused } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "paused",
  });

  const pauseInteraction = useContractInteraction({
    functionName: "pause",
    onSuccessCallback: refetchIsContractPaused,
  });

  const unpauseInteraction = useContractInteraction({
    functionName: "unpause",
    onSuccessCallback: refetchIsContractPaused,
  });

  return (
    <ControlContainer title="Pause / Unpause">
      <InteractionButton
        title="Pause"
        interaction={pauseInteraction}
        disabled={isContractPaused as boolean}
      />
      <InteractionButton
        title="Unpause"
        interaction={unpauseInteraction}
        disabled={!isContractPaused}
      />
    </ControlContainer>
  );
}

function ClaimPlatformFunds() {
  const { address } = useAccount();
  const interaction = useContractInteraction({
    functionName: "claimPlatformFunds",
    args: [address],
  });

  return (
    <ControlContainer title="Claim Platform Funds">
      <InteractionButton title="Claim" interaction={interaction} />
    </ControlContainer>
  );
}

function SetURI() {
  const [uri, setURI] = useState("");
  const { data: currentURI } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "uri",
  });

  const interaction = useContractInteraction({
    functionName: "setURI",
    args: [uri],
  });

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
        <InteractionButton title="Set URI" interaction={interaction} disabled={!uri} />
      </div>
      {typeof currentURI === 'string' && <div className="text-gray-500 mb-2">Current URI: {currentURI}</div>}
    </ControlContainer>
  );
}

function PriceFloorControl() {
  const [priceFloor, setPriceFloor] = useState("");
  const { data: currentPriceFloor } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "priceFloor",
  });

  const interaction = useContractInteraction({
    functionName: "setPriceFloor",
    args: [BigInt(priceFloor)],
  });

  return (
    <ControlContainer title="Set Price Floor">
      <NumberInput
        value={priceFloor}
        setValue={setPriceFloor}
        placeholder="Enter Price Floor"
        interaction={interaction}
        current={currentPriceFloor}
      />
    </ControlContainer>
  );
}

function BasePriceControl() {
  const [basePrice, setBasePrice] = useState("");
  const { data: currentBasePrice } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "basePrice",
  });

  const interaction = useContractInteraction({
    functionName: "setBasePrice",
    args: [BigInt(basePrice)],
  });

  return (
    <ControlContainer title="Set Base Price">
      <NumberInput
        value={basePrice}
        setValue={setBasePrice}
        placeholder="Enter Base Price"
        interaction={interaction}
        current={currentBasePrice}
      />
    </ControlContainer>
  );
}

function MaxBatchSizeControl() {
  const [maxBatchSize, setMaxBatchSize] = useState("");
  const { data: currentMaxBatchSize } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "maxBatchSize",
  });

  const interaction = useContractInteraction({
    functionName: "setMaxBatchSize",
    args: [BigInt(maxBatchSize)],
  });

  return (
    <ControlContainer title="Set Max Batch Size">
      <NumberInput
        value={maxBatchSize}
        setValue={setMaxBatchSize}
        placeholder="Enter Max Batch Size"
        interaction={interaction}
        current={currentMaxBatchSize}
      />
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

  const interaction = useContractInteraction({
    functionName: "setAuctionTimeThresholds",
    args: [BigInt(dayIncreaseThreshold), BigInt(dayDecreaseThreshold)],
  });

  const handleSetAuctionTimeThresholds = () => {
    if (
      dayIncreaseThreshold &&
      dayDecreaseThreshold &&
      BigInt(dayIncreaseThreshold) < BigInt(dayDecreaseThreshold)
    ) {
      interaction.write?.();
    } else {
      alert("Increase threshold must be lower than decrease threshold");
    }
  };

  return (
    <ControlContainer title="Set Auction Time Thresholds">
      <div className="flex flex-col gap-2 mb-4">
        <input
          type="number"
          value={dayIncreaseThreshold}
          onChange={(e) => setDayIncreaseThreshold(e.target.value)}
          placeholder="Enter Increase Days"
          className="px-4 py-2 border border-gray-300 rounded"
        />
        <input
          type="number"
          value={dayDecreaseThreshold}
          onChange={(e) => setDayDecreaseThreshold(e.target.value)}
          placeholder="Enter Decrease Days"
          className="px-4 py-2 border border-gray-300 rounded"
        />
        <button
          className="px-4 py-2 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!interaction.write || interaction.isLoading}
          onClick={handleSetAuctionTimeThresholds}
        >
          Set Auction Time Thresholds
        </button>
      </div>
      {typeof currentDayIncreaseThreshold === 'bigint' && (
        <div className="text-gray-500 mb-2">Current Day Increase Threshold: {currentDayIncreaseThreshold.toString()}</div>
      )}
      {typeof currentDayDecreaseThreshold === 'bigint' && (
        <div className="text-gray-500 mb-2">Current Day Decrease Threshold: {currentDayDecreaseThreshold.toString()}</div>
      )}
      {interaction.isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {interaction.isSuccess && <div className="text-primary">Transaction successful</div>}
      {interaction.error && <div className="text-red-500">Error: {interaction.error.message}</div>}
    </ControlContainer>
  );
}

function PlatformPercentageControl() {
  const [platformSharePercentage, setPlatformSharePercentage] = useState("");
  const { data: currentPlatformSharePercentage } = useContractRead({
    ...astaverdeContractConfig,
    functionName: "platformSharePercentage",
  });

  const interaction = useContractInteraction({
    functionName: "setPlatformSharePercentage",
    args: [BigInt(platformSharePercentage)],
  });

  return (
    <ControlContainer title="Set Platform Share Percentage">
      <NumberInput
        value={platformSharePercentage}
        setValue={setPlatformSharePercentage}
        placeholder="Enter Platform Share Percentage"
        interaction={interaction}
        current={currentPlatformSharePercentage}
      />
    </ControlContainer>
  );
}

function NumberInput({
  value,
  setValue,
  placeholder,
  interaction,
  current,
}: {
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
  interaction: ReturnType<typeof useContractInteraction>;
  current: any;
}) {
  return (
    <>
      <div className="flex items-center mb-4">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="px-4 py-2 mr-2 border border-gray-300 rounded"
        />
        <InteractionButton title={placeholder} interaction={interaction} disabled={!value} />
      </div>
      {current !== undefined && current !== null && (
        <div className="text-gray-500 mb-2">Current: {current.toString()}</div>
      )}
      {interaction.isLoading && <div className="text-gray-500">Processing... Please check your wallet.</div>}
      {interaction.isSuccess && <div className="text-primary">Transaction successful</div>}
      {interaction.error && <div className="text-red-500">Error: {interaction.error.message}</div>}
    </>
  );
}

function InteractionButton({
  title,
  interaction,
  disabled,
}: {
  title: string;
  interaction: ReturnType<typeof useContractInteraction>;
  disabled?: boolean;
}) {
  return (
    <button
      className="px-4 py-2 bg-secondary text-white rounded hover:bg-blue-700 disabled:opacity-50"
      disabled={disabled || !interaction.write || interaction.isLoading}
      onClick={interaction.write}
    >
      {title}
    </button>
  );
}
