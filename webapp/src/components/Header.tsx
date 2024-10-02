"use client";

import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { USDC_DECIMALS } from "../app.config";
import { getUsdcContractConfig } from "../lib/contracts";

interface HeaderProps {
    links: { name: string; url: string }[];
}

export function Header({ links }: HeaderProps) {
    const { address, isConnected } = useAccount();
    const usdcConfig = getUsdcContractConfig();
    const [showBalance, setShowBalance] = useState(false);
    const [isBalanceLoading, setIsBalanceLoading] = useState(true);
    const { data: usdcBalance, isLoading: isBalanceDataLoading } = useBalance({
        address,
        token: usdcConfig.address,
        query: {
            enabled: isConnected && !!address,
        },
    });

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
        return formatUnits(usdcBalance.value, USDC_DECIMALS);
    }, [usdcBalance]);

    return (
        <header className="w-full flex flex-wrap items-center justify-between bg-primary p-4 shadow-md">
            <div className="flex items-center">
                <button
                    className="lg:hidden text-white text-2xl px-4 py-2"
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

            <nav className={`${isMenuOpen ? "block" : "hidden"} lg:flex lg:items-center`}>
                <ul className="flex flex-col lg:flex-row lg:space-x-4 space-y-2 lg:space-y-0 items-center">
                    {links.map((link, index) => (
                        <li key={index} className="lg:mr-4">
                            <span
                                className={`group hover:bg-white/20 rounded-lg px-4 py-2 transition duration-300 ease-in-out ${pathname === link.url ? "bg-white/20" : ""}`}
                            >
                                {link.name === "My Eco Assets" ? (
                                    <span
                                        className={`text-white/90 hover:text-white transition-colors duration-300 ${pathname === link.url ? "text-white" : ""} ${isConnected ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (isConnected) {
                                                router.push("/mytokens");
                                            }
                                        }}
                                    >
                                        {link.name}
                                    </span>
                                ) : (
                                    <Link href={link.url}>
                                        <span
                                            className={`text-white/90 hover:text-white transition-colors duration-300 ${pathname === link.url ? "text-white" : ""}`}
                                        >
                                            {link.name}
                                        </span>
                                    </Link>
                                )}
                            </span>
                        </li>
                    ))}
                    {isConnected && (
                        <li className="mr-4">
                            <div className="bg-white/10 text-white rounded-lg px-3 py-2">
                                <span className="text-sm font-medium">USDC Balance: </span>
                                <span className="text-sm font-bold">{Number.parseFloat(usdcBalanceFormatted).toFixed(2)}</span>
                            </div>
                        </li>
                    )}
                    <li>
                        <ConnectKitButton />
                    </li>
                </ul>
            </nav>
        </header>
    );
}
