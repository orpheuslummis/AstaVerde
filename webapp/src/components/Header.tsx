"use client";

import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { ENV } from "../config/environment";
import { getUsdcContract, getSccContract } from "../config/contracts";
import { useIsProducer } from "../hooks/useIsProducer";
import { useAppContext } from "../contexts/AppContext";
import { useAstaVerdeBalancesRefetch } from "../hooks/useGlobalEvent";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
    links: readonly { readonly name: string; readonly url: string }[];
}

export function Header({ links }: HeaderProps) {
  const { address, isConnected } = useAccount();
  const { isProducer, producerBalance } = useIsProducer();
  const { isAdmin } = useAppContext();
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

  const refreshInFlightRef = useRef(false);
  const refreshPendingRef = useRef(false);

  const refreshBalances = useCallback(async () => {
    if (!isConnected || !address) return;

    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    refreshPendingRef.current = false;

    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Refetch immediately, then retry a couple times to smooth over transient 429s/timeouts.
      const delays = [0, 1500, 3000];
      for (const delayMs of delays) {
        if (delayMs) await pause(delayMs);

        const usdcRes = await refetchUsdcBalance();
        const sccRes = sccConfig ? await refetchSccBalance() : undefined;

        const usdcOk = !usdcRes.isError;
        const sccOk = !sccConfig || !sccRes?.isError;

        if (usdcOk && sccOk) break;
      }
    } finally {
      refreshInFlightRef.current = false;
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        void refreshBalances();
      }
    }
  }, [address, isConnected, refetchSccBalance, refetchUsdcBalance, sccConfig]);

  // Initial load + whenever wallet/chain changes.
  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  // Refresh balances after successful txs (mint/buy/claim/vault ops, etc).
  useAstaVerdeBalancesRefetch(() => {
    void refreshBalances();
  }, [refreshBalances]);

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

      <nav className={`${isMenuOpen ? "block" : "hidden"} lg:flex lg:items-center`}>
        <ul className="flex flex-col lg:flex-row lg:gap-1 space-y-2 lg:space-y-0 items-center">
          {links.map((link, index) => (
            <React.Fragment key={link.url}>
              <li className="flex">
                {link.name === "My Eco Assets" ? (
                  <span
                    className={`hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg px-3 py-2 transition duration-300 ease-in-out whitespace-nowrap ${
                      pathname === link.url ? "bg-white/20 dark:bg-gray-700" : ""
                    } ${isConnected ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                    onClick={() => isConnected && router.push("/mytokens")}
                    onKeyDown={(e) => e.key === "Enter" && isConnected && router.push("/mytokens")}
                    role="button"
                    tabIndex={0}
                  >
                    <span
                      className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 ${
                        pathname === link.url ? "text-white dark:text-white" : ""
                      }`}
                    >
                      {link.name}
                    </span>
                  </span>
                ) : (
                  <Link
                    href={link.url}
                    className={`hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg px-3 py-2 transition duration-300 ease-in-out whitespace-nowrap ${
                      pathname === link.url ? "bg-white/20 dark:bg-gray-700" : ""
                    }`}
                  >
                    <span
                      className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 ${
                        pathname === link.url ? "text-white dark:text-white" : ""
                      }`}
                    >
                      {link.name}
                    </span>
                  </Link>
                )}
              </li>
              {/* Show Producer Dashboard after My Eco Assets if user is a producer */}
              {link.name === "My Eco Assets" && isProducer && (
                <li key="producer-dashboard" className="flex">
                  <Link
                    href="/producer"
                    className={`hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg px-3 py-2 transition duration-300 ease-in-out whitespace-nowrap flex items-center gap-1 ${
                      pathname === "/producer" ? "bg-white/20 dark:bg-gray-700" : ""
                    }`}
                  >
                    <span
                      className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 ${
                        pathname === "/producer" ? "text-white dark:text-white" : ""
                      }`}
                    >
                      Producer
                    </span>
                    {producerBalance && producerBalance > 0n && (
                      <span className="bg-emerald-500 text-white text-xs rounded-full px-2 py-0.5">
                        {formatUnits(producerBalance, 6)}
                      </span>
                    )}
                  </Link>
                </li>
              )}
              {/* Show Admin link if the connected user is admin */}
              {link.name === "About" && isAdmin && (
                <li key="admin-link" className="flex">
                  <Link
                    href="/admin"
                    className={`hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg px-3 py-2 transition duration-300 ease-in-out whitespace-nowrap ${
                      pathname === "/admin" ? "bg-white/20 dark:bg-gray-700" : ""
                    }`}
                  >
                    <span
                      className={`text-white/90 dark:text-gray-300 hover:text-white dark:hover:text-white transition-colors duration-300 ${
                        pathname === "/admin" ? "text-white dark:text-white" : ""
                      }`}
                    >
                      Admin
                    </span>
                  </Link>
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {isConnected && (
          <div className="flex flex-col items-end gap-0.5">
            <span className="bg-white/15 text-white text-xs font-medium rounded px-2 py-0.5 whitespace-nowrap" data-testid="usdc-balance">
              {Number.parseFloat(usdcBalanceFormatted).toLocaleString(undefined, {maximumFractionDigits: 0})} USDC
            </span>
            {sccConfig && (
              <span className="bg-white/15 text-white text-xs font-medium rounded px-2 py-0.5 whitespace-nowrap" data-testid="scc-balance">
                {Number.parseFloat(sccBalanceFormatted).toFixed(0)} SCC
              </span>
            )}
          </div>
        )}
        <ThemeToggle />
        <div data-testid="connect-wallet">
          <ConnectKitButton />
        </div>
      </div>
    </header>
  );
}
