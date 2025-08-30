"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUSDCWithUnit } from "@/shared/utils/format";
import { ENV } from "@/config/environment";
import {
  getAstaVerdeContract,
  getEcoStabilizerContract,
  getSccContract,
  contractAddresses,
} from "@/config/contracts";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { customToast } from "@/shared/utils/customToast";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
      <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{title}</h2>
      {children}
    </div>
  );
}

export function ContractStatus() {
  const astaverde = getAstaVerdeContract();
  const vault = getEcoStabilizerContract();
  const scc = getSccContract();

  // Owners
  const { data: astaOwner } = useReadContract({ ...astaverde, functionName: "owner" });
  const { data: vaultOwner } = useReadContract({ ...vault, functionName: "owner" });

  // Paused flags
  const { data: astaPaused } = useReadContract({ ...astaverde, functionName: "paused" });
  const { data: vaultPaused } = useReadContract({ ...vault, functionName: "paused" });

  // Platform funds
  const { data: platformFunds } = useReadContract({
    ...astaverde,
    functionName: "platformShareAccumulated",
  });

  // SCC roles
  const { data: DEFAULT_ADMIN_ROLE } = useReadContract({ ...scc, functionName: "DEFAULT_ADMIN_ROLE" });
  const { data: MINTER_ROLE } = useReadContract({ ...scc, functionName: "MINTER_ROLE" });

  const { data: vaultIsMinter } = useReadContract({
    ...scc,
    functionName: "hasRole",
    args: [MINTER_ROLE as `0x${string}`, contractAddresses.ecoStabilizer as `0x${string}`],
    query: { enabled: !!MINTER_ROLE && !!contractAddresses.ecoStabilizer },
  });

  const { address } = useAccount();
  const { data: youAreSccAdmin } = useReadContract({
    ...scc,
    functionName: "hasRole",
    args: [DEFAULT_ADMIN_ROLE as `0x${string}`, (address || "0x0000000000000000000000000000000000000000") as `0x${string}`],
    query: { enabled: !!DEFAULT_ADMIN_ROLE && !!address },
  });

  const sccMinterInvariant = useMemo(() => {
    if (typeof vaultIsMinter !== "boolean") return { ok: null as null | boolean, note: "checking…" };
    return {
      ok: vaultIsMinter,
      note: vaultIsMinter
        ? "Vault has MINTER_ROLE (cannot enumerate others with non-enumerable AccessControl)."
        : "Vault missing MINTER_ROLE — minting will fail.",
    };
  }, [vaultIsMinter]);

  return (
    <Card title="Contract Status">
      <div className="text-sm space-y-2">
        <div>
          <div className="font-semibold">Addresses</div>
          <div>AstaVerde: {contractAddresses.astaverde}</div>
          <div>EcoStabilizer: {contractAddresses.ecoStabilizer || "(not configured)"}</div>
          <div>SCC: {contractAddresses.scc || "(not configured)"}</div>
          <div>USDC: {contractAddresses.usdc}</div>
        </div>
        <div className="mt-3">
          <div className="font-semibold">Ownership</div>
          <div>Marketplace owner: {typeof astaOwner === "string" ? astaOwner : "…"}</div>
          <div>Vault owner: {typeof vaultOwner === "string" ? vaultOwner : "…"}</div>
        </div>
        <div className="mt-3">
          <div className="font-semibold">Pause</div>
          <div>AstaVerde paused: {String(astaPaused ?? "…")}</div>
          <div>EcoStabilizer paused: {String(vaultPaused ?? "…")}</div>
        </div>
        <div className="mt-3">
          <div className="font-semibold">Platform Funds</div>
          <div>
            Accrued: {typeof platformFunds === "bigint" ? formatUSDCWithUnit(platformFunds) : "…"}
          </div>
        </div>
        <div className="mt-3">
          <div className="font-semibold">SCC Roles</div>
          <div>
            Vault is MINTER: {typeof vaultIsMinter === "boolean" ? String(vaultIsMinter) : "…"}
            {" "}
            <span className="text-xs text-gray-500">— {sccMinterInvariant.note}</span>
          </div>
          <div>Your wallet is SCC admin: {typeof youAreSccAdmin === "boolean" ? String(youAreSccAdmin) : "…"}</div>
        </div>
      </div>
    </Card>
  );
}

export function OwnershipTransfer() {
  const astaverde = getAstaVerdeContract();
  const vault = getEcoStabilizerContract();

  const { address } = useAccount();

  const { data: astaOwner } = useReadContract({ ...astaverde, functionName: "owner" });
  const { data: vaultOwner } = useReadContract({ ...vault, functionName: "owner" });

  const { execute: transferAsta } = useContractInteraction(astaverde, "transferOwnership");
  const { execute: transferVault } = useContractInteraction(vault, "transferOwnership");

  const [target, setTarget] = useState("");
  const isAddr = /^0x[a-fA-F0-9]{40}$/.test(target);

  const canTransferAsta = typeof astaOwner === "string" && address && address.toLowerCase() === astaOwner.toLowerCase();
  const canTransferVault = typeof vaultOwner === "string" && address && address.toLowerCase() === vaultOwner.toLowerCase();

  const doTransfer = async (which: "asta" | "vault") => {
    if (!isAddr) return customToast.error("Enter a valid 0x address");
    const label = which === "asta" ? "AstaVerde" : "EcoStabilizer";
    const confirm = window.confirm(`Transfer ${label} ownership to ${target}? This cannot be undone.`);
    if (!confirm) return;
    try {
      if (which === "asta") await transferAsta(target);
      else await transferVault(target);
      customToast.success(`${label} ownership transferred`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      customToast.error(`Failed to transfer ${label} ownership`);
    }
  };

  return (
    <Card title="Ownership Transfer (QA/Test)">
      <div className="space-y-3 text-sm">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value.trim())}
          placeholder="0xClientAddress"
          className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
        />
        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => doTransfer("asta")}
            disabled={!isAddr || !canTransferAsta}
            title={canTransferAsta ? "" : "Connect as current AstaVerde owner"}
          >
            Transfer AstaVerde Ownership
          </button>
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => doTransfer("vault")}
            disabled={!isAddr || !canTransferVault}
            title={canTransferVault ? "" : "Connect as current Vault owner"}
          >
            Transfer Vault Ownership
          </button>
        </div>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          For production, transfer to a Gnosis Safe. This UI is intended for test/QA only.
        </p>
      </div>
    </Card>
  );
}
