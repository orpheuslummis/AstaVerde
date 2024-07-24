"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider } from "connectkit";
import * as React from "react";
import { ErrorBoundary } from 'react-error-boundary';
import { WagmiProvider } from "wagmi";
import { AppProvider } from '../contexts/AppContext';
import { WalletProvider } from "../contexts/WalletContext";
import { config } from "../wagmi";

function ErrorFallback({ error }: { error: Error }) {
	return (
		<div role="alert">
			<p>Something went wrong:</p>
			<pre>{error.message}</pre>
		</div>
	)
}

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ErrorBoundary FallbackComponent={ErrorFallback}>
			<WagmiProvider config={config}>
				<QueryClientProvider client={queryClient}>
					<ConnectKitProvider>
						<AppProvider>
							<WalletProvider>{children}</WalletProvider>
						</AppProvider>
					</ConnectKitProvider>
				</QueryClientProvider>
			</WagmiProvider>
		</ErrorBoundary>
	);
}