"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useAppContext } from "../contexts/AppContext";
import { astaverdeContractConfig } from "../lib/contracts";
import { Connected } from "./Connected";

export function AdminControls() {
    const { adminControls } = useAppContext();

    return (
        <Connected>
            <h2 className="text-2xl my-6 mx-6">Admin Controls</h2>
            <div>
                <PauseContractControl />
                <SetURI />
                <PriceFloorControl />
                <BasePriceControl />
                <MaxBatchSizeControl />
                <AuctionTimeThresholdsControl />
                <PlatformPercentageControl />
                <UpdateBasePriceControl />
                <ClaimPlatformFunds />
            </div>
        </Connected>
    );
}

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <div className="card mx-auto max-w-sm my-6 bg-primary-light">
            <h2 className="text-xl font-bold mb-4">{title}</h2>
            {children}
        </div>
    );
}

function PauseContractControl() {
    const { adminControls } = useAppContext();
    const { data: isContractPaused, refetch: refetchIsContractPaused } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "paused",
    });

    return (
        <ControlContainer title="Pause / Unpause">
            <button
                className="btn btn-secondary hover-lift disabled:opacity-50"
                disabled={isContractPaused as boolean}
                onClick={adminControls.pauseContract}
            >
                Pause
            </button>
            <button
                className="btn btn-secondary hover-lift disabled:opacity-50"
                disabled={!isContractPaused}
                onClick={adminControls.unpauseContract}
            >
                Unpause
            </button>
        </ControlContainer>
    );
}

function ClaimPlatformFunds() {
    const { address } = useAccount();
    const { adminControls } = useAppContext();

    return (
        <ControlContainer title="Claim Platform Funds">
            <button
                className="btn btn-secondary hover-lift"
                onClick={() => address && adminControls.claimPlatformFunds(address)}
            >
                Claim
            </button>
        </ControlContainer>
    );
}

function SetURI() {
    const { adminControls } = useAppContext();
    const [uri, setURI] = useState("");
    const { data: currentURI } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "uri",
    });

    const handleSetURI = () => {
        if (uri) {
            adminControls.setURI(uri);
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
                    className="btn btn-secondary hover-lift disabled:opacity-50"
                    disabled={!uri}
                    onClick={handleSetURI}
                >
                    Set URI
                </button>
            </div>
            {typeof currentURI === "string" && <div className="text-gray-500 mb-2">Current URI: {currentURI}</div>}
        </ControlContainer>
    );
}

function PriceFloorControl() {
    const { adminControls } = useAppContext();
    const [priceFloor, setPriceFloor] = useState("");
    const { data: currentPriceFloor } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "priceFloor",
    });

    const handleSetPriceFloor = () => {
        if (priceFloor) {
            adminControls.setPriceFloor(priceFloor);
        }
    };

    return (
        <ControlContainer title="Set Price Floor">
            <div className="flex items-center mb-4">
                <input
                    type="number"
                    value={priceFloor}
                    onChange={(e) => setPriceFloor(e.target.value)}
                    placeholder="Enter Price Floor"
                    className="px-4 py-2 mr-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary hover-lift disabled:opacity-50"
                    disabled={!priceFloor}
                    onClick={handleSetPriceFloor}
                >
                    Set Price Floor
                </button>
            </div>
            {typeof currentPriceFloor === "bigint" && (
                <div className="text-gray-500 mb-2">Current Price Floor: {currentPriceFloor.toString()}</div>
            )}
        </ControlContainer>
    );
}

function BasePriceControl() {
    const { adminControls } = useAppContext();
    const [basePrice, setBasePrice] = useState("");
    const { data: currentBasePrice } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "basePrice",
    });

    const handleSetBasePrice = () => {
        if (basePrice) {
            adminControls.setBasePrice(basePrice);
        }
    };

    return (
        <ControlContainer title="Set Base Price">
            <div className="flex items-center mb-4">
                <input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="Enter Base Price"
                    className="px-4 py-2 mr-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary hover-lift disabled:opacity-50"
                    disabled={!basePrice}
                    onClick={handleSetBasePrice}
                >
                    Set Base Price
                </button>
            </div>
            {typeof currentBasePrice === "bigint" && (
                <div className="text-gray-500 mb-2">Current Base Price: {currentBasePrice.toString()}</div>
            )}
        </ControlContainer>
    );
}

function MaxBatchSizeControl() {
    const { adminControls } = useAppContext();
    const [maxBatchSize, setMaxBatchSize] = useState("");
    const { data: currentMaxBatchSize } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "maxBatchSize",
    });

    const handleSetMaxBatchSize = () => {
        if (maxBatchSize) {
            adminControls.setMaxBatchSize(maxBatchSize);
        }
    };

    return (
        <ControlContainer title="Set Max Batch Size">
            <div className="flex items-center mb-4">
                <input
                    type="number"
                    value={maxBatchSize}
                    onChange={(e) => setMaxBatchSize(e.target.value)}
                    placeholder="Enter Max Batch Size"
                    className="px-4 py-2 mr-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary hover-lift disabled:opacity-50"
                    disabled={!maxBatchSize}
                    onClick={handleSetMaxBatchSize}
                >
                    Set Max Batch Size
                </button>
            </div>
            {typeof currentMaxBatchSize === "bigint" && (
                <div className="text-gray-500 mb-2">Current Max Batch Size: {currentMaxBatchSize.toString()}</div>
            )}
        </ControlContainer>
    );
}

function AuctionTimeThresholdsControl() {
    const { adminControls } = useAppContext();
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

    const handleSetAuctionTimeThresholds = () => {
        if (
            dayIncreaseThreshold &&
            dayDecreaseThreshold &&
            BigInt(dayIncreaseThreshold) < BigInt(dayDecreaseThreshold)
        ) {
            adminControls.setAuctionTimeThresholds(dayIncreaseThreshold, dayDecreaseThreshold);
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
                    disabled={!dayIncreaseThreshold || !dayDecreaseThreshold}
                    onClick={handleSetAuctionTimeThresholds}
                >
                    Set Auction Time Thresholds
                </button>
            </div>
            {typeof currentDayIncreaseThreshold === "bigint" && (
                <div className="text-gray-500 mb-2">
                    Current Day Increase Threshold: {currentDayIncreaseThreshold.toString()}
                </div>
            )}
            {typeof currentDayDecreaseThreshold === "bigint" && (
                <div className="text-gray-500 mb-2">
                    Current Day Decrease Threshold: {currentDayDecreaseThreshold.toString()}
                </div>
            )}
        </ControlContainer>
    );
}

function PlatformPercentageControl() {
    const { adminControls } = useAppContext();
    const [platformSharePercentage, setPlatformSharePercentage] = useState("");
    const { data: currentPlatformSharePercentage } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "platformSharePercentage",
    });

    const handleSetPlatformSharePercentage = () => {
        if (platformSharePercentage) {
            adminControls.setPlatformSharePercentage(platformSharePercentage);
        }
    };

    return (
        <ControlContainer title="Set Platform Share Percentage">
            <div className="flex items-center mb-4">
                <input
                    type="number"
                    value={platformSharePercentage}
                    onChange={(e) => setPlatformSharePercentage(e.target.value)}
                    placeholder="Enter Platform Share Percentage"
                    className="px-4 py-2 mr-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary hover-lift disabled:opacity-50"
                    disabled={!platformSharePercentage}
                    onClick={handleSetPlatformSharePercentage}
                >
                    Set Platform Share Percentage
                </button>
            </div>
            {typeof currentPlatformSharePercentage === "bigint" && (
                <div className="text-gray-500 mb-2">
                    Current Platform Share Percentage: {currentPlatformSharePercentage.toString()}
                </div>
            )}
        </ControlContainer>
    );
}

function UpdateBasePriceControl() {
    const { adminControls } = useAppContext();

    return (
        <ControlContainer title="Update Base Price">
            <button className="btn btn-secondary hover-lift" onClick={adminControls.updateBasePrice}>
                Update Base Price
            </button>
        </ControlContainer>
    );
}

import React from "react";

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
