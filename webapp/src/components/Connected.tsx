"use client";

import { useAccount } from "wagmi";

interface ConnectedProps {
  children: React.ReactNode;
  childrenDisconnected?: React.ReactNode;
}

export function Connected({ children, childrenDisconnected }: ConnectedProps) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return <>{childrenDisconnected || <div>Please connect to see this content.</div>}</>;
  }
  return <>{children}</>;
}
