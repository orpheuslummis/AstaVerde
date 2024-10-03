"use client";

import Link from "next/link";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { USDC_DECIMALS } from "../../app.config";
import { Connected } from "../../components/Connected";
import { useAppContext } from "../../contexts/AppContext";
import { astaverdeContractConfig } from "../../lib/contracts";
import { customToast } from "../../utils/customToast";

function AdminControls() {
    const { isAdmin, adminControls } = useAppContext();

    if (!isAdmin) {
        return <div>You do not have permission to access this page.</div>;
    }

    return (
        <Connected>
            <h2 className="text-2xl my-6 mx-6">Admin Controls</h2>
            <Link href="/mint" className="btn btn-primary m-6 shadow-md hover:shadow-lg">
                Go to Minting Page
            </Link>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                <ClaimPlatformFunds />
                <PauseContractControl />
                <PriceFloorControl />
                <BasePriceControl />
                <UpdateBasePriceControl />
                <AuctionTimeThresholdsControl />
                <PlatformPercentageControl />
                <MaxBatchSizeControl />
                <SetURI />
            </div>
        </Connected>
    );
}

function ControlContainer({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <div className="card bg-primary-light p-6 rounded-lg shadow-md">
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
            <button
                className="btn btn-primary m-2 shadow-md hover:shadow-lg"
                disabled={isContractPaused as boolean}
                onClick={handlePause}
            >
                Pause
            </button>
            <button
                className="btn btn-secondary m-2 shadow-md hover:shadow-lg"
                disabled={!isContractPaused}
                onClick={handleUnpause}
            >
                Unpause
            </button>
        </ControlContainer>
    );
}

function ClaimPlatformFunds() {
    const { address } = useAccount();
    const { adminControls } = useAppContext();

    const handleClaim = async () => {
        if (address) {
            try {
                await adminControls.claimPlatformFunds(address);
                customToast.success("Platform funds claimed successfully");
            } catch (error) {
                console.error("Error claiming platform funds:", error);
                customToast.error("Failed to claim platform funds");
            }
        }
    };

    return (
        <ControlContainer title="Claim Platform Funds">
            <button className="btn btn-secondary m-2 shadow-md hover:shadow-lg" onClick={handleClaim}>
                Claim
            </button>
        </ControlContainer>
    );
}

// change decrease rate



// function SetURI() {
//     const { adminControls } = useAppContext();
//     const [uri, setURI] = useState("");
//     const { data: currentURI, refetch: refetchCurrentURI } = useReadContract({
//         ...astaverdeContractConfig,
//         functionName: "uri",
//     });

//     const handleSetURI = async () => {
//         if (uri) {
//             try {
//                 await adminControls.setURI(uri);
//                 customToast.success("URI updated successfully");
//                 refetchCurrentURI();
//             } catch (error) {
//                 console.error("Error setting URI:", error);
//                 customToast.error("Failed to update URI");
//             }
//         }
//     };

//     return (
//         <ControlContainer title="Set URI">
//             <div className="flex items-center mb-4">
//                 <input
//                     type="text"
//                     value={uri}
//                     onChange={(e) => setURI(e.target.value)}
//                     placeholder="Enter URI"
//                     className="px-4 py-2 mr-2 border border-gray-300 rounded"
//                 />
//                 <button
//                     className="btn btn-secondary m-2 shadow-md hover:shadow-lg disabled:opacity-50"
//                     disabled={!uri}
//                     onClick={handleSetURI}
//                 >
//                     Set URI
//                 </button>
//             </div>
//             {typeof currentURI === "string" && <div className="text-gray-500 mb-2">Current URI: {currentURI}</div>}
//         </ControlContainer>
//     );
// }

function PriceFloorControl() {
    const { adminControls } = useAppContext();
    const [priceFloor, setPriceFloor] = useState("");
    const { data: currentPriceFloor, refetch: refetchCurrentPriceFloor } = useReadContract({
        ...astaverdeContractConfig,
        functionName: "priceFloor",
    });

    const handleSetPriceFloor = async () => {
        if (priceFloor) {
            try {
                const priceFloorInWei = parseUnits(priceFloor, USDC_DECIMALS);
                await adminControls.setPriceFloor(priceFloorInWei.toString());
                customToast.success("Price floor updated successfully");
                refetchCurrentPriceFloor();
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
                    className="px-4 py-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary shadow-md hover:shadow-lg disabled:opacity-50"
                    disabled={!priceFloor}
                    onClick={handleSetPriceFloor}
                >
                    Set Price Floor
                </button>
            </div>
            {typeof currentPriceFloor === "bigint" && (
                <div className="text-gray-500 mt-4">
                    Current Price Floor: {formatUnits(currentPriceFloor, USDC_DECIMALS)} USDC
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
                const basePriceInWei = parseUnits(basePrice, USDC_DECIMALS);
                await adminControls.setBasePrice(basePriceInWei.toString());
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
                    className="px-4 py-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary shadow-md hover:shadow-lg disabled:opacity-50"
                    disabled={!basePrice}
                    onClick={handleSetBasePrice}
                >
                    Set Base Price
                </button>
            </div>
            {typeof currentBasePrice === "bigint" && (
                <div className="text-gray-500 mt-4">
                    Current Base Price: {formatUnits(currentBasePrice, USDC_DECIMALS)} USDC
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
                await adminControls.setMaxBatchSize(maxBatchSize);
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
                    className="px-4 py-2 border border-gray-300 rounded"
                />
                <button
                    className="btn btn-secondary shadow-md hover:shadow-lg disabled:opacity-50"
                    disabled={!maxBatchSize}
                    onClick={handleSetMaxBatchSize}
                >
                    Set Max Batch Size
                </button>
            </div>
            {typeof currentMaxBatchSize === "bigint" && (
                <div className="text-gray-500 mt-4">Current Max Batch Size: {currentMaxBatchSize.toString()}</div>
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
                    className="btn btn-secondary shadow-md hover:shadow-lg disabled:opacity-50"
                    disabled={!dayIncreaseThreshold || !dayDecreaseThreshold}
                    onClick={handleSetAuctionTimeThresholds}
                >
                    Set Auction Time Thresholds
                </button>
            </div>
            {typeof currentDayIncreaseThreshold === "bigint" && (
                <div className="text-gray-500 mt-4">
                    Current Day Increase Threshold: {currentDayIncreaseThreshold.toString()}
                </div>
            )}
            {typeof currentDayDecreaseThreshold === "bigint" && (
                <div className="text-gray-500 mt-4">
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
                    className="px-4 py-2 border border-gray-300 rounded"
                    min="0"
                    max="100"
                />
                <button
                    className="btn btn-secondary shadow-md hover:shadow-lg disabled:opacity-50"
                    disabled={!platformSharePercentage}
                    onClick={handleSetPlatformSharePercentage}
                >
                    Set Platform Share Percentage
                </button>
            </div>
            {typeof currentPlatformSharePercentage === "bigint" && (
                <div className="text-gray-500 mt-4">
                    Current Platform Share Percentage: {currentPlatformSharePercentage.toString()}%
                </div>
            )}
        </ControlContainer>
    );
}

function UpdateBasePriceControl() {
    const { adminControls } = useAppContext();

    const handleUpdateBasePrice = async () => {
        try {
            await adminControls.updateBasePrice();
            customToast.success("Base price updated successfully");
        } catch (error) {
            console.error("Error updating base price:", error);
            customToast.error("Failed to update base price");
        }
    };

    return (
        <ControlContainer title="Update Base Price">
            <button className="btn btn-secondary m-2 shadow-md hover:shadow-lg" onClick={handleUpdateBasePrice}>
                Update Base Price
            </button>
        </ControlContainer>
    );
}

export default function Page() {
    return <AdminControls />;
}
