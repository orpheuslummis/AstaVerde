"use client";

import { config } from "../wagmi";
import { ConnectKitProvider } from "connectkit";
import * as React from "react";
import { WagmiConfig } from "wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);
	return (
		<WagmiConfig config={config}>
			<ConnectKitProvider>{mounted && children}</ConnectKitProvider>
		</WagmiConfig>
	);
}
