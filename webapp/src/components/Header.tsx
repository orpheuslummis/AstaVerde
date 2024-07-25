"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { getUsdcContractConfig } from "../lib/contracts";
import { ConnectKitButton } from "./ConnectKitButton";

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
		watch: true,
		enabled: isConnected && !!address,
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
							<span className={`group hover:bg-white/20 rounded-lg px-4 py-2 transition duration-300 ease-in-out ${pathname === link.url ? "bg-white/20" : ""}`}>
								{link.name === "My EcoAssets" ? (
									<span
										className={`text-white/90 hover:text-white transition-colors duration-300 ${pathname === link.url ? "text-white" : ""} ${isConnected ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
										onClick={(e) => {
											e.preventDefault();
											if (isConnected) {
												router.push('/mytokens');
											}
										}}
									>
										{link.name}
									</span>
								) : (
									<Link href={link.url}>
										<span className={`text-white/90 hover:text-white transition-colors duration-300 ${pathname === link.url ? "text-white" : ""}`}>
											{link.name}
										</span>
									</Link>
								)}
							</span>
						</li>
					))}
					{showBalance && (
						<li className={balanceClassName}>
							{isBalanceLoading ? (
								"Loading..."
							) : usdcBalance ? (
								`${parseFloat(usdcBalance.formatted).toFixed(2)} ${usdcBalance.symbol}`
							) : (
								"N/A"
							)}
						</li>
					)}
					<li>
						{isConnected ? (
							<span className="text-white">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
						) : (
							<ConnectKitButton />
						)}
					</li>
				</ul>
			</nav>
		</header>
	);
}