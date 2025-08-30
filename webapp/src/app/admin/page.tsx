"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { formatUnits, parseUnits, isAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ENV } from "../../config/environment";
import { Connected } from "../../components/Connected";
import { useAppContext } from "../../contexts/AppContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { getAstaVerdeContract, getUsdcContract } from "../../config/contracts";
import { customToast } from "../../utils/customToast";
import { MaxPriceUpdateIterationsControl, RecoverSurplusUSDCControl } from "./GasOptimizationControls";
import { ContractStatus, OwnershipTransfer } from "./OwnershipAndStatus";
import { TabNav } from "./TabNav";

const MintBatch = dynamic(() => import("./MintBatch"), {
  ssr: false,
  loading: () => <div className="p-6">Loading Mint…</div>,
});

function AdminControls() {
  const { isAdmin } = useAppContext();

  if (!isAdmin) {
    return <div>You do not have permission to access this page.</div>;
  }

  return (
    <Connected>
      <h2 className="text-2xl my-10 mx-10 text-emerald-800 dark:text-emerald-300">Admin Controls</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        <ContractStatus />
        <OwnershipTransfer />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        <ClaimPlatformFunds />
        <PauseContractControl />
        <PriceFloorControl />
        <BasePriceControl />
        <AuctionTimeThresholdsControl />
        <PlatformPercentageControl />
        <MaxBatchSizeControl />
        <DailyPriceDecayControl />
        <PriceAdjustDeltaControl />
        <MaxPriceUpdateIterationsControl />
        <RecoverSurplusUSDCControl />
        <MintUSDCControl />
      </div>
    </Connected>
  );
}

function MintUSDCControl() {
  const { isAdmin } = useAppContext();
  const { address } = useAccount();
  const [to, setTo] = useState<string>(address ?? "");
  const [amount, setAmount] = useState<string>("1000");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTestEnv = ENV.CHAIN_SELECTION === "base_sepolia" || ENV.CHAIN_SELECTION === "local";
  const usdcContractConfig = getUsdcContract();
  const { execute } = useContractInteraction(usdcContractConfig, "mint");

  const onMint = async () => {
    if (!isTestEnv) return;
    if (!to || !isAddress(to)) {
      customToast.error("Enter a valid recipient address");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      customToast.error("Enter a positive amount");
      return;
    }
    try {
      setIsSubmitting(true);
      const value = parseUnits(amount, ENV.USDC_DECIMALS);
      await execute(to, value);
      customToast.success(`Minted ${amount} USDC to ${to.slice(0, 6)}…${to.slice(-4)}`);
    } catch (err) {
      console.error("Mint USDC error:", err);
      customToast.error("Mint failed. Are you on Base Sepolia/local?");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ControlContainer title="Mint Testnet USDC" id="mint-usdc">
      {!isTestEnv ? (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          Hidden on mainnet. Switch to Base Sepolia or local to use the test faucet.
        </div>
      ) : !isAdmin ? (
        <div className="text-sm text-gray-500">Admin only.</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Calls MockUSDC.mint on {ENV.CHAIN_SELECTION.replace("_", " ")} (decimals {ENV.USDC_DECIMALS}).
          </div>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipient address (0x…)"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (USDC)"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={onMint}
              disabled={!isTestEnv || isSubmitting}
            >
              {isSubmitting ? "Minting…" : "Mint"}
            </button>
          </div>
        </div>
      )}
    </ControlContainer>
  );
}

function ControlContainer({ children, title, id }: { children: React.ReactNode; title: string; id?: string }) {
  return (
    <section id={id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function PauseContractControl() {
  const { adminControls } = useAppContext();
  const astaverdeContractConfig = getAstaVerdeContract();
  const { data: isContractPaused, refetch: refetchIsContractPaused } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "paused",
  });

  const handlePause = async () => {
    try {
      if (!window.confirm("Pause the marketplace? Buyers will be unable to purchase during pause.")) return;
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
      if (!window.confirm("Unpause the marketplace and resume operations?")) return;
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
  const astaverdeContractConfig = getAstaVerdeContract();
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
  const astaverdeContractConfig = getAstaVerdeContract();
  const { execute: getPriceFloor } = useContractInteraction(
    astaverdeContractConfig,
    "priceFloor",
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
  const astaverdeContractConfig = getAstaVerdeContract();
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
            maximumFractionDigits: 6,
          })} USDC
        </div>
      )}
    </ControlContainer>
  );
}

function MaxBatchSizeControl() {
  const { adminControls } = useAppContext();
  const [maxBatchSize, setMaxBatchSize] = useState("");
  const astaverdeContractConfig = getAstaVerdeContract();
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
  const astaverdeContractConfig = getAstaVerdeContract();
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
  const astaverdeContractConfig = getAstaVerdeContract();
  const { data: currentPlatformSharePercentage, refetch: refetchCurrentPlatformSharePercentage } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "platformSharePercentage",
  });

  const handleSetPlatformSharePercentage = async () => {
    if (platformSharePercentage) {
      const percentage = Number(platformSharePercentage);
      if (percentage < 0 || percentage > 50) {
        customToast.error("Platform share percentage must be between 0 and 50");
        return;
      }
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
          placeholder="Enter Platform Share Percentage (0-50)"
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
  const astaverdeContractConfig = getAstaVerdeContract();
  const { execute: getDailyPriceDecay } = useContractInteraction(
    astaverdeContractConfig,
    "dailyPriceDecay",
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
  const astaverdeContractConfig = getAstaVerdeContract();
  const { execute: getPriceAdjustDelta } = useContractInteraction(
    astaverdeContractConfig,
    "priceAdjustDelta",
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
  const params = useSearchParams();
  const activeTab = (params.get("tab") ?? "controls").toString();
  return (
    <div className="pb-4">
      <TabNav />
      {activeTab === "mint" ? <MintBatch /> : <AdminControls />}
    </div>
  );
}
