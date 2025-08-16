"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ENV } from "../../config/environment";
import { Connected } from "../../components/Connected";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { astaverdeContractConfig } from "../../lib/contracts";
import { customToast } from "../../utils/customToast";

function AdminControls() {
    const { isAdmin } = useAppContext();

    if (!isAdmin) {
        return <div>You do not have permission to access this page.</div>;
    }

    return (
        <Connected>
            <h2 className="text-2xl my-10 mx-10 text-emerald-800 dark:text-emerald-300">Admin Controls</h2>
            <Link href="/mint" className="btn btn-primary mx-6 mb-4 inline-block">
                Go to Minting Page
            </Link>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                <ClaimPlatformFunds />
                <PauseContractControl />
                <PriceFloorControl />
                <BasePriceControl />
                <AuctionTimeThresholdsControl />
                <PlatformPercentageControl />
                <MaxBatchSizeControl />
                <DailyPriceDecayControl />
                <PriceAdjustDeltaControl
                />
            </div>
        </Connected>
    );
}

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
            <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{title}</h2>
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

    const handlePause = async () => {
        try {
            await adminControls.pauseContract();
            customToast.success("Contract paused successfully");
            refetchIsContractPaused();
        } catch (error) {
            console.error("Error pausing contract:", error);
            customToast.error("Failed to pause contract");
        }
    };

    const handleUnpause = async () => {
        try {
            await adminControls.unpauseContract();
            customToast.success("Contract unpaused successfully");
            refetchIsContractPaused();
        } catch (error) {
            console.error("Error unpausing contract:", error);
            customToast.error("Failed to unpause contract");
        }
    };

    return (
        <ControlContainer title="Pause / Unpause">
            <div className="flex gap-4">
                <button
                    type="button"
                    className="btn btn-primary flex-1"
                    disabled={isContractPaused as boolean}
                    onClick={handlePause}
                >
                    Pause
                </button>
                <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={!isContractPaused}
                    onClick={handleUnpause}
                >
                    Unpause
                </button>
            </div>
        </ControlContainer>
    );
}

function ClaimPlatformFunds() {
    const { address } = useAccount();
    const { adminControls } = useAppContext();
    const { data: platformFunds } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "platformShareAccumulated",
    });

    const handleClaim = async () => {
        if (!address || !platformFunds || platformFunds === 0n) return;

        try {
            await adminControls.claimPlatformFunds(address);
            customToast.success("Platform funds claimed successfully");
        } catch (error) {
            console.error("Error claiming platform funds:", error);
            customToast.error("Failed to claim platform funds");
        }
    };

    return (
        <ControlContainer title="Claim Platform Funds">
            <div className="flex flex-col gap-4">
                {typeof platformFunds === "bigint" && (
                    <div className="text-gray-600 dark:text-gray-300">
                        Available Funds: {formatUnits(platformFunds, ENV.USDC_DECIMALS)} USDC
                    </div>
                )}
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={handleClaim}
                    disabled={!platformFunds || platformFunds === 0n}
                >
                    Claim Platform Funds
                </button>
            </div>
        </ControlContainer>
    );
}

function PriceFloorControl() {
    const { adminControls } = useAppContext();
    const [priceFloor, setPriceFloor] = useState("");
    const { execute: getPriceFloor } = useContractInteraction(
        astaverdeContractConfig,
        "priceFloor"
    );

    const [currentValue, setCurrentValue] = useState<bigint>();

    useEffect(() => {
        getPriceFloor().then((value) => {
            setCurrentValue(value as bigint);
        });
    }, [getPriceFloor]);

    const handleSetPriceFloor = async () => {
        if (priceFloor) {
            try {
                const priceFloorInWei = parseUnits(priceFloor, ENV.USDC_DECIMALS);
                await adminControls.setPriceFloor(priceFloorInWei.toString());
                const newValue = await getPriceFloor();
                setCurrentValue(newValue as bigint);
                customToast.success("Price floor updated successfully");
            } catch (error) {
                console.error("Error setting price floor:", error);
                customToast.error("Failed to update price floor");
            }
        }
    };

    return (
        <ControlContainer title="Set Price Floor">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={priceFloor}
                    onChange={(e) => setPriceFloor(e.target.value)}
                    placeholder="Enter Price Floor (USDC)"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!priceFloor}
                    onClick={handleSetPriceFloor}
                >
                    Set Price Floor
                </button>
            </div>
            {typeof currentValue === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Price Floor: {formatUnits(currentValue, ENV.USDC_DECIMALS)} USDC
                </div>
            )}
        </ControlContainer>
    );
}

function BasePriceControl() {
    const { adminControls } = useAppContext();
    const [basePrice, setBasePrice] = useState("");
    const { data: currentBasePrice, refetch: refetchCurrentBasePrice } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "basePrice",
    });

    const handleSetBasePrice = async () => {
        if (basePrice) {
            try {
                // Convert the input value to wei (considering USDC decimals)
                const basePriceInWei = parseUnits(basePrice, ENV.USDC_DECIMALS);
                await adminControls.setBasePrice(basePriceInWei);
                customToast.success("Base price updated successfully");
                refetchCurrentBasePrice();
            } catch (error) {
                console.error("Error setting base price:", error);
                customToast.error("Failed to update base price");
            }
        }
    };

    return (
        <ControlContainer title="Set Base Price">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="Enter Base Price (USDC)"
                    step="0.000001" // Allow for 6 decimal places (USDC precision)
                    min="0"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!basePrice}
                    onClick={handleSetBasePrice}
                >
                    Set Base Price
                </button>
            </div>
            {typeof currentBasePrice === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Base Price: {Number(formatUnits(currentBasePrice, ENV.USDC_DECIMALS)).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                    })} USDC
                </div>
            )}
        </ControlContainer>
    );
}

function MaxBatchSizeControl() {
    const { adminControls } = useAppContext();
    const [maxBatchSize, setMaxBatchSize] = useState("");
    const { data: currentMaxBatchSize, refetch: refetchCurrentMaxBatchSize } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "maxBatchSize",
    });

    const handleSetMaxBatchSize = async () => {
        if (maxBatchSize) {
            try {
                const maxBatchSizeBigInt = BigInt(maxBatchSize); // Convert string to bigint
                await adminControls.setMaxBatchSize(maxBatchSizeBigInt);
                customToast.success("Max batch size updated successfully");
                refetchCurrentMaxBatchSize();
            } catch (error) {
                console.error("Error setting max batch size:", error);
                customToast.error("Failed to update max batch size");
            }
        }
    };

    return (
        <ControlContainer title="Set Max Batch Size">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={maxBatchSize}
                    onChange={(e) => setMaxBatchSize(e.target.value)}
                    placeholder="Enter Max Batch Size"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!maxBatchSize}
                    onClick={handleSetMaxBatchSize}
                >
                    Set Max Batch Size
                </button>
            </div>
            {typeof currentMaxBatchSize === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">Current Max Batch Size: {currentMaxBatchSize.toString()}</div>
            )}
        </ControlContainer>
    );
}

function AuctionTimeThresholdsControl() {
    const { adminControls } = useAppContext();
    const [dayIncreaseThreshold, setDayIncreaseThreshold] = useState("");
    const [dayDecreaseThreshold, setDayDecreaseThreshold] = useState("");
    const { data: currentDayIncreaseThreshold, refetch: refetchCurrentDayIncreaseThreshold } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "dayIncreaseThreshold",
    });
    const { data: currentDayDecreaseThreshold, refetch: refetchCurrentDayDecreaseThreshold } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "dayDecreaseThreshold",
    });

    const handleSetAuctionTimeThresholds = async () => {
        if (
            dayIncreaseThreshold &&
            dayDecreaseThreshold &&
            BigInt(dayIncreaseThreshold) < BigInt(dayDecreaseThreshold)
        ) {
            try {
                await adminControls.setAuctionDayThresholds(dayIncreaseThreshold, dayDecreaseThreshold);
                customToast.success("Auction time thresholds updated successfully");
                refetchCurrentDayIncreaseThreshold();
                refetchCurrentDayDecreaseThreshold();
            } catch (error) {
                console.error("Error setting auction time thresholds:", error);
                customToast.error("Failed to update auction time thresholds");
            }
        } else {
            customToast.error("Increase threshold must be lower than decrease threshold");
        }
    };

    return (
        <ControlContainer title="Set Auction Time Thresholds">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={dayIncreaseThreshold}
                    onChange={(e) => setDayIncreaseThreshold(e.target.value)}
                    placeholder="Enter Increase Days"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <input
                    type="number"
                    value={dayDecreaseThreshold}
                    onChange={(e) => setDayDecreaseThreshold(e.target.value)}
                    placeholder="Enter Decrease Days"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!dayIncreaseThreshold || !dayDecreaseThreshold}
                    onClick={handleSetAuctionTimeThresholds}
                >
                    Set Time Thresholds
                </button>
            </div>
            {typeof currentDayIncreaseThreshold === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Day Increase Threshold: {currentDayIncreaseThreshold.toString()}
                </div>
            )}
            {typeof currentDayDecreaseThreshold === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Day Decrease Threshold: {currentDayDecreaseThreshold.toString()}
                </div>
            )}
        </ControlContainer>
    );
}

function PlatformPercentageControl() {
    const { adminControls } = useAppContext();
    const [platformSharePercentage, setPlatformSharePercentage] = useState("");
    const { data: currentPlatformSharePercentage, refetch: refetchCurrentPlatformSharePercentage } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "platformSharePercentage",
    });

    const handleSetPlatformSharePercentage = async () => {
        if (platformSharePercentage) {
            try {
                await adminControls.setPlatformSharePercentage(platformSharePercentage);
                customToast.success("Platform share percentage updated successfully");
                refetchCurrentPlatformSharePercentage();
            } catch (error) {
                console.error("Error setting platform share percentage:", error);
                customToast.error("Failed to update platform share percentage");
            }
        }
    };

    return (
        <ControlContainer title="Set Platform Share Percentage">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={platformSharePercentage}
                    onChange={(e) => setPlatformSharePercentage(e.target.value)}
                    placeholder="Enter Platform Share Percentage (0-100)"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                    min="0"
                    max="100"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!platformSharePercentage}
                    onClick={handleSetPlatformSharePercentage}
                >
                    Set Platform Share
                </button>
            </div>
            {typeof currentPlatformSharePercentage === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Platform Share Percentage: {currentPlatformSharePercentage.toString()}%
                </div>
            )}
        </ControlContainer>
    );
}

function DailyPriceDecayControl() {
    const { adminControls } = useAppContext();
    const [dailyPriceDecay, setDailyPriceDecay] = useState("");
    const { execute: getDailyPriceDecay } = useContractInteraction(
        astaverdeContractConfig,
        "dailyPriceDecay"
    );

    const [currentValue, setCurrentValue] = useState<bigint>();

    useEffect(() => {
        const fetchValue = async () => {
            try {
                const value = await getDailyPriceDecay();
                setCurrentValue(value as bigint);
            } catch (error) {
                console.error("Error fetching daily price decay:", error);
            }
        };
        fetchValue();
    }, [getDailyPriceDecay]);

    const handleSetDailyPriceDecay = async () => {
        if (dailyPriceDecay) {
            try {
                const decayInWei = parseUnits(dailyPriceDecay, ENV.USDC_DECIMALS);
                await adminControls.setDailyPriceDecay(decayInWei);
                const newValue = await getDailyPriceDecay();
                setCurrentValue(newValue as bigint);
                customToast.success("Daily price decay updated successfully");
            } catch (error) {
                console.error("Error setting daily price decay:", error);
                customToast.error("Failed to update daily price decay");
            }
        }
    };

    return (
        <ControlContainer title="Set Daily Price Decay">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={dailyPriceDecay}
                    onChange={(e) => setDailyPriceDecay(e.target.value)}
                    placeholder="Enter Daily Price Decay (USDC/day)"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!dailyPriceDecay}
                    onClick={handleSetDailyPriceDecay}
                >
                    Set Daily Price Decay
                </button>
            </div>
            {typeof currentValue === "bigint" && (
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                    Current: {formatUnits(currentValue, ENV.USDC_DECIMALS)} USDC/day
                </div>
            )}
        </ControlContainer>
    );
}

function PriceAdjustDeltaControl() {
    const { adminControls } = useAppContext();
    const [priceAdjustDelta, setPriceAdjustDelta] = useState("");
    const { execute: getPriceAdjustDelta } = useContractInteraction(
        astaverdeContractConfig,
        "priceAdjustDelta"
    );

    const handleSetPriceAdjustDelta = async () => {
        if (priceAdjustDelta) {
            try {
                const deltaInWei = parseUnits(priceAdjustDelta, ENV.USDC_DECIMALS);
                await adminControls.setPriceDelta(deltaInWei);
                const newValue = await getPriceAdjustDelta();
                setCurrentValue(newValue as bigint);
                customToast.success("Price adjustment delta updated successfully");
            } catch (error) {
                console.error("Error setting price adjustment delta:", error);
                customToast.error("Failed to update price adjustment delta");
            }
        }
    };

    const [currentValue, setCurrentValue] = useState<bigint>();

    useEffect(() => {
        getPriceAdjustDelta().then((value) => {
            setCurrentValue(value as bigint);
        });
    }, [getPriceAdjustDelta]);

    return (
        <ControlContainer title="Set Price Adjustment Delta">
            <div className="flex flex-col gap-4">
                <input
                    type="number"
                    value={priceAdjustDelta}
                    onChange={(e) => setPriceAdjustDelta(e.target.value)}
                    placeholder="Enter Price Adjustment Delta (USDC)"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 
                             focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             dark:border-gray-600 dark:bg-gray-700 dark:text-white 
                             transition-all duration-200"
                />
                <button
                    type="button"
                    className="btn btn-primary w-full"
                    disabled={!priceAdjustDelta}
                    onClick={handleSetPriceAdjustDelta}
                >
                    Set Price Delta
                </button>
            </div>
            {typeof currentValue === "bigint" && (
                <div className="text-gray-600 dark:text-gray-300 mt-4">
                    Current Price Adjustment Delta: {formatUnits(currentValue, ENV.USDC_DECIMALS)} USDC
                </div>
            )}
        </ControlContainer>
    );
}

export default function Page() {
    return <AdminControls />;
}
