"use client";

import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance, useBlockNumber } from "wagmi";
import { ENV } from "../config/environment";
import { getUsdcContract, getSccContract } from "../config/contracts";
import { useIsProducer } from "../hooks/useIsProducer";
import { useDebounce } from "../hooks/useDebounce";

interface HeaderProps {
    links: readonly { readonly name: string; readonly url: string }[];
}

export function Header({ links }: HeaderProps) {
  const { address, isConnected } = useAccount();
  const { isProducer, producerBalance } = useIsProducer();
  const usdcConfig = getUsdcContract();
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
  const sccConfig = ENV.SCC_ADDRESS ? getSccContract() : null;
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
  // Use debouncing to avoid excessive refetches
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    query: { enabled: isConnected },
  });

  // Debounce block number changes by 5 seconds to reduce refetch frequency
  const debouncedBlockNumber = useDebounce(blockNumber, 5000);

  useEffect(() => {
    if (!isConnected || !debouncedBlockNumber) return;
    void refetchUsdcBalance();
    if (sccConfig) void refetchSccBalance();
  }, [debouncedBlockNumber, isConnected, sccConfig, refetchUsdcBalance, refetchSccBalance]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  // Keep a CSS var with the current header height so the toast container
  // (and any other overlays) can offset from the top bar.
  useEffect(() => {
    const el = headerRef.current;
    const setVar = () => {
      const height = el?.offsetHeight ?? 64;
      // Set on :root to make it available app-wide
      document.documentElement.style.setProperty("--header-height", `${height}px`);
    };
    setVar();
    // Update on resize
    window.addEventListener("resize", setVar);
    return () => window.removeEventListener("resize", setVar);
  }, []);

  // Recalculate when the mobile menu opens/closes (height changes)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // Next paint to capture expanded height
    const id = requestAnimationFrame(() => {
      const height = el.offsetHeight || 64;
      document.documentElement.style.setProperty("--header-height", `${height}px`);
    });
    return () => cancelAnimationFrame(id);
  }, [isMenuOpen]);

  const usdcBalanceFormatted = useMemo(() => {
    if (!usdcBalance) return "0";
    return formatUnits(usdcBalance.value, ENV.USDC_DECIMALS);
  }, [usdcBalance]);

  const sccBalanceFormatted = useMemo(() => {
    if (!sccBalance) return "0";
    return formatUnits(sccBalance.value, 18); // SCC has 18 decimals
  }, [sccBalance]);

  return (
    <header ref={headerRef} className="w-full flex items-center justify-between bg-primary dark:bg-gray-800 p-4 shadow-md">
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
          <Image src="/eco_tradezone.png" alt="Logo" width={40} height={40} className="w-10 h-10" />
        </Link>
      </div>

      <nav className={`${isMenuOpen ? "block" : "hidden"} lg:flex lg:items-center flex-grow`}>
        <ul className="flex flex-col lg:flex-row lg:space-x-2 space-y-2 lg:space-y-0 items-center lg:justify-center flex-grow">
          {links.map((link, index) => (
            <React.Fragment key={link.url}>
              <li className="lg:mr-4">
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
              {/* Show Producer Dashboard after My Eco Assets if user is a producer */}
              {link.name === "My Eco Assets" && isProducer && (
                <li key="producer-dashboard" className="lg:mr-4">
                  <span
                    className={`group hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg px-4 py-2 transition duration-300 ease-in-out ${
                      pathname === "/producer" ? "bg-white/20 dark:bg-gray-700" : ""
                    }`}
                  >
                    <Link href="/producer">
                      <span
                        className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 flex items-center gap-1 ${
                          pathname === "/producer" ? "text-white dark:text-white" : ""
                        }`}
                      >
                        <span>💰</span> Producer Dashboard
                        {producerBalance && producerBalance > 0n && (
                          <span className="ml-1 bg-emerald-500 text-white text-xs rounded-full px-2 py-0.5">
                            {formatUnits(producerBalance, 6)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </span>
                </li>
              )}
            </React.Fragment>
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
