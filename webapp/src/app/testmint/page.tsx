"use client";

import { parseUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { USDC_DECIMALS } from "../../app.config";
// import { useAppContext } from "../../contexts/AppContext"
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { astaverdeContractConfig, getUsdcContractConfig } from "../../lib/contracts";
import { customToast } from "../../utils/customToast";

export default function Page() {
    const { address, isConnected } = useAccount();
    // const { adminControls } = useAppContext();
    // const [producers, setProducers] = useState<string[]>([""]);
    // const [cids, setCids] = useState<string[]>([""]);

    const usdcContractConfig = getUsdcContractConfig();
    const { data: usdcBalance } = useBalance({
        address,
        token: usdcContractConfig.address,
    });

    const { execute: approveUSDC } = useContractInteraction(usdcContractConfig, "approve");
    const { execute: mintUSDC } = useContractInteraction(usdcContractConfig, "mint");

    const handleMintUSDC = async () => {
        if (!address) return;
        try {
            const amount = parseUnits("10000", USDC_DECIMALS);
            await mintUSDC(address, amount); 
            customToast.success("Successfully minted 10000 USDC");
        } catch (error) {
            console.error("Error minting USDC:", error);
            customToast.error("Failed to mint USDC");
        }
    };

    const handleApproveUSDC = async () => {
        if (!address) return;
        try {
            const amount = parseUnits("10000", USDC_DECIMALS);
            await approveUSDC(astaverdeContractConfig.address, amount);
            customToast.success("Successfully approved USDC");
        } catch (error) {
            console.error("Error approving USDC:", error);
            customToast.error("Failed to approve USDC");
        }
    };

    // Comment out or remove the following functions:
    // const handleMintBatch = async () => { ... };
    // const addProducerCid = () => { ... };
    // const updateProducer = (index: number, value: string) => { ... };
    // const updateCid = (index: number, value: string) => { ... };

    return (
        <div className="flex flex-col items-center space-y-8 p-4">
            <h1 className="text-3xl font-bold mb-4">AstaVerde Test Minting Page</h1>

            {isConnected ? (
                <div className="flex flex-col items-center space-y-2">
                    <p>Connected Address: {address}</p>
                    <p>
                        Your USDC Balance: {usdcBalance ? Number.parseFloat(usdcBalance.formatted).toFixed(2) : "Loading..."}{" "}
                        USDC
                    </p>
                </div>
            ) : (
                <p>Please connect your wallet to use this page.</p>
            )}

            <div className="w-full max-w-md space-y-4">
                <h2 className="text-2xl font-semibold">USDC Operations</h2>
                <button
                    type="button"
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleMintUSDC}
                    disabled={!address}
                >
                    Mint 10000 Test USDC
                </button>

                <button
                    type="button"
                    className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleApproveUSDC}
                    disabled={!address}
                >
                    Approve USDC for AstaVerde
                </button>
            </div>

            {/* Remove or comment out the "Mint New Batch" section */}
        </div>
    );
}
