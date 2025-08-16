"use client";

import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useBlockNumber } from "wagmi";
import { ENV } from "../config/environment";
import { getUsdcContractConfig, getSccContractConfig } from "../lib/contracts";

interface HeaderProps {
    links: readonly { readonly name: string; readonly url: string }[];
}

export function Header({ links }: HeaderProps) {
    const { address, isConnected } = useAccount();
    const usdcConfig = getUsdcContractConfig();
    const [showBalance, setShowBalance] = useState(false);
    const [isBalanceLoading, setIsBalanceLoading] = useState(true);
    const { data: usdcBalance, isLoading: isBalanceDataLoading, refetch: refetchUsdcBalance } = useBalance({
        address,
        token: usdcConfig.address,
        query: {
            enabled: isConnected && !!address,
            staleTime: 0,
            refetchOnWindowFocus: true,
        },
    });

    // SCC Balance (only if vault is available)
    const sccConfig = ENV.SCC_ADDRESS ? getSccContractConfig() : null;
    const { data: sccBalance, refetch: refetchSccBalance } = useBalance({
        address,
        token: sccConfig?.address,
        query: {
            enabled: isConnected && !!address && !!sccConfig,
            staleTime: 0,
            refetchOnWindowFocus: true,
        },
    });

    // Watch new blocks to keep balances fresh after on-chain actions
    const { data: blockNumber } = useBlockNumber({
        watch: true,
        query: { enabled: isConnected },
    });

    useEffect(() => {
        if (!isConnected || !blockNumber) return;
        void refetchUsdcBalance();
        if (sccConfig) void refetchSccBalance();
    }, [blockNumber, isConnected, sccConfig, refetchUsdcBalance, refetchSccBalance]);

    useEffect(() => {
        if (!isBalanceDataLoading) {
            setIsBalanceLoading(false);
        }
    }, [isBalanceDataLoading]);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const toggleMenu = () => {
        setIsMenuOpen((prev) => !prev);
    };

    const balanceClassName = "hidden lg:block border border-gray-300 rounded-md bg-blue-100 p-2";

    const usdcBalanceFormatted = useMemo(() => {
        if (!usdcBalance) return "0";
        return formatUnits(usdcBalance.value, ENV.USDC_DECIMALS);
    }, [usdcBalance]);

    const sccBalanceFormatted = useMemo(() => {
        if (!sccBalance) return "0";
        return formatUnits(sccBalance.value, 18); // SCC has 18 decimals
    }, [sccBalance]);

    return (
        <header className="w-full flex items-center justify-between bg-primary dark:bg-gray-800 p-4 shadow-md">
            <div className="flex items-center flex-shrink-0">
                <button
                    className="lg:hidden text-white dark:text-gray-200 text-2xl px-4 py-2"
                    onClick={toggleMenu}
                    aria-label="Toggle Menu"
                    type="button"
                >
                    ☰
                </button>
                <Link href="/" className="flex items-center">
                    <img src="/eco_tradezone.png" alt="Logo" className="w-10" />
                </Link>
            </div>

            <nav className={`${isMenuOpen ? "block" : "hidden"} lg:flex lg:items-center flex-grow`}>
                <ul className="flex flex-col lg:flex-row lg:space-x-2 space-y-2 lg:space-y-0 items-center lg:justify-center flex-grow">
                    {links.map((link) => (
                        <li key={link.url} className="lg:mr-4">
                            <span
                                className={`group hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg px-4 py-2 transition duration-300 ease-in-out ${
                                    pathname === link.url ? "bg-white/20 dark:bg-gray-700" : ""
                                }`}
                            >
                                {link.name === "My Eco Assets" ? (
                                    <button
                                        type="button"
                                        className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 ${
                                            pathname === link.url ? "text-white dark:text-white" : ""
                                        } ${isConnected ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (isConnected) {
                                                router.push("/mytokens");
                                            }
                                        }}
                                        disabled={!isConnected}
                                    >
                                        {link.name}
                                    </button>
                                ) : (
                                    <Link href={link.url}>
                                        <span
                                            className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 ${
                                                pathname === link.url ? "text-white dark:text-white" : ""
                                            }`}
                                        >
                                            {link.name}
                                        </span>
                                    </Link>
                                )}
                            </span>
                        </li>
                    ))}
                    {isConnected && (
                        <>
                            <li className="lg:ml-auto">
                                <div className="bg-white/10 dark:bg-gray-700 text-white dark:text-gray-200 rounded-lg px-2 py-1 text-xs" data-testid="usdc-balance">
                                    <span className="font-medium">USDC: </span>
                                    <span className="font-bold">{Number.parseFloat(usdcBalanceFormatted).toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                                </div>
                            </li>
                            {sccConfig && (
                                <li className="ml-2">
                                    <div className="bg-emerald-500/20 dark:bg-emerald-700 text-white dark:text-gray-200 rounded-lg px-2 py-1 text-xs" data-testid="scc-balance">
                                        <span className="font-medium">🏦 SCC: </span>
                                        <span className="font-bold">{Number.parseFloat(sccBalanceFormatted).toFixed(2)}</span>
                                    </div>
                                </li>
                            )}
                        </>
                    )}
                </ul>
            </nav>
            
            <div className="flex-shrink-0 ml-4" data-testid="connect-wallet">
                <ConnectKitButton />
            </div>
        </header>
    );
}
