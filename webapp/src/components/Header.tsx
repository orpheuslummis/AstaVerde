"use client";

import { getUsdcContractConfig } from "../lib/contracts";
import { ConnectKitButton } from "./ConnectKitButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useContractRead } from "wagmi";
import { USDC_DECIMALS } from "../app.config";

interface HeaderProps {
	links: { name: string; url: string }[];
}

export function Header({ links }: HeaderProps) {
	const { address } = useAccount();
	const { data: balance } = useContractRead({
		...getUsdcContractConfig(),
		functionName: "balanceOf",
		enabled: !!address,
		args: [address || "0x"],
	} as any);

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const pathname = usePathname();

	const toggleMenu = () => {
		setIsMenuOpen((prev) => !prev);
	};

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
							<Link href={link.url}>
								<div
									className={`group hover:bg-white/20 rounded-lg px-4 py-2 transition duration-300 ease-in-out ${pathname === link.url ? "bg-white/20" : ""
										}`}
								>
									<span
										className={`text-white/90 hover:text-white transition-colors duration-300 ${pathname === link.url ? "text-white" : ""
											}`}
									>
										{link.name}
									</span>
								</div>
							</Link>
						</li>
					))}
					{address && (
						<li className="hidden lg:block border border-gray-300 rounded-md bg-blue-100 p-2">
							{formatUnits((balance as bigint) || BigInt(0), USDC_DECIMALS)?.toString() || 0} USDC
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
