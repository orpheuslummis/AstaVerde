"use client";

import { useAccount } from "wagmi";

export function Connected({ children, childrenDisconnected }: { children: React.ReactNode, childrenDisconnected?: React.ReactNode }) {
  const { isConnected } = useAccount();

  if (!isConnected) return <>{childrenDisconnected || <div>Please connect to see this content.</div>}</>;
  return <>{children}</>;
}
