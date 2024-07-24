"use client";

import { useState } from "react";
import { useAccount, useReadContract, useSimulateContract } from "wagmi";
import { useAppContext } from '../contexts/AppContext';
import { astaverdeContractConfig } from "../lib/contracts";
import { Connected } from "./Connected";

export function AdminControls() {
  const { adminControls } = useAppContext();

  return (
    <Connected>
      <h2 className="text-2xl my-6 mx-6">Admin Controls</h2>
      <div>
        <ControlContainer title="Pause / Unpause">
          <InteractionButton title="Pause" onClick={adminControls.pauseContract} />
          <InteractionButton title="Unpause" onClick={adminControls.unpauseContract} />
        </ControlContainer>
        <ControlContainer title="Set URI">
          <URIInput onSubmit={adminControls.setURI} />
        </ControlContainer>
        <ControlContainer title="Set Price Floor">
          <NumberInput onSubmit={adminControls.setPriceFloor} placeholder="Enter Price Floor" />
        </ControlContainer>
        <ControlContainer title="Set Base Price">
          <NumberInput onSubmit={adminControls.setBasePrice} placeholder="Enter Base Price" />
        </ControlContainer>
        <ControlContainer title="Set Max Batch Size">
          <NumberInput onSubmit={adminControls.setMaxBatchSize} placeholder="Enter Max Batch Size" />
        </ControlContainer>
        <ControlContainer title="Set Auction Time Thresholds">
          <AuctionTimeThresholdsInput onSubmit={adminControls.setAuctionTimeThresholds} />
        </ControlContainer>
        <ControlContainer title="Set Platform Share Percentage">
          <NumberInput onSubmit={adminControls.setPlatformSharePercentage} placeholder="Enter Platform Share Percentage" />
        </ControlContainer>
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
    <div className="card mx-auto max-w-sm my-6 bg-primary-light">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
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
  const { data: simulateResult } = useSimulateContract({
    ...astaverdeContractConfig,
    functionName,
    args,
  });

  const { writeContract, isLoading, isSuccess, error } = useWriteContract();

  const write = React.useCallback(() => {
    if (simulateResult?.request) {
      writeContract(simulateResult.request)
    }
  }, [simulateResult, writeContract]);

  React.useEffect(() => {
    if (isSuccess && onSuccessCallback) {
      onSuccessCallback();
    }
  }, [isSuccess, onSuccessCallback]);

  return { write, isLoading, isSuccess, error };
}

function PauseContractControl() {
  const { data: isContractPaused, refetch: refetchIsContractPaused } = useReadContract({
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
  const { data: currentURI } = useReadContract({
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
  const { data: currentPriceFloor } = useReadContract({
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
  const { data: currentBasePrice } = useReadContract({
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
  const { data: currentMaxBatchSize } = useReadContract({
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
  const { data: currentDayIncreaseThreshold } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "dayIncreaseThreshold",
  });
  const { data: currentDayDecreaseThreshold } = useReadContract({
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
          className="btn btn-secondary hover-lift disabled:opacity-50"
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
  const { data: currentPlatformSharePercentage } = useReadContract({
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
      className="btn btn-secondary hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={disabled || !interaction.write || interaction.isLoading}
      onClick={interaction.write}
    >
      {title}
    </button>
  );
}

import React from 'react';

interface ControlProps {
  title: string;
  children: React.ReactNode;
}

export const Control: React.FC<ControlProps> = ({ title, children }) => {
  return (
    <div className="card mx-auto max-w-sm my-6 bg-primary-light">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {children}
    </div>
  );
};