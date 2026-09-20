"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReadContract, useSignMessage } from "wagmi";
import { EXTERNAL_URL, IPFS_PREFIX } from "@/config/constants";
import { useAppContext } from "@/contexts/AppContext";
import { useWallet } from "@/contexts/WalletContext";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { customToast } from "@/utils/customToast";
import {
  createUploadAuthorizationMessage,
  fetchUploadKeyStatus,
  type TokenMetadata,
  type UploadAuthorization,
  type UploadKeyStatus,
  uploadToIPFS,
} from "@/utils/ipfsHelper";

export default function MintBatch() {
  const { isConnected, address, chainId } = useWallet();
  const { astaverdeContractConfig, isAdmin, refetchBatches } = useAppContext();
  const [tokens, setTokens] = useState<TokenMetadata[]>([
    { name: "", description: "", producer_address: "", image: null },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  type MintStep =
    | "idle"
    | "validating"
    | "authorize"
    | "upload"
    | "prepareTx"
    | "awaitWallet"
    | "txPending"
    | "done"
    | "error";
  const [step, setStep] = useState<MintStep>("idle");
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [lastTokenId, setLastTokenId] = useState<number | null>(null);
  const [uploadImages, setUploadImages] = useState(true);
  const [keyStatus, setKeyStatus] = useState<UploadKeyStatus | null>(null);
  const { signMessageAsync } = useSignMessage();

  // The contract reverts a mintBatch above maxBatchSize (owner-settable), so cap
  // the form at it. If the read fails the cap is null and behaviour is unchanged.
  const { data: maxBatchSizeData } = useReadContract({
    ...astaverdeContractConfig,
    functionName: "maxBatchSize",
  });
  const maxBatchSize = typeof maxBatchSizeData === "bigint" ? Number(maxBatchSizeData) : null;

  const { execute: mintBatch } = useContractInteraction(astaverdeContractConfig, "mintBatch");
  const { execute: getLastTokenId } = useContractInteraction(astaverdeContractConfig, "lastTokenID");

  // One-time check (guarded for React Strict Mode): is uploading configured on
  // this deployment, and until when does the storage key last.
  const didInitRef = useRef(false);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    if (!didInitRef.current) {
      didInitRef.current = true;
      fetchUploadKeyStatus()
        .then((status) => {
          if (isMountedRef.current) setKeyStatus(status);
        })
        .catch(() => {
          if (isMountedRef.current) setKeyStatus({ configured: false, expiresAt: null, gateway: null });
        });
    }
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (isConnected) {
      getLastTokenId()
        .then((id) => {
          if (!cancelled) setLastTokenId(Number(id));
        })
        .catch(() => {
          if (!cancelled) customToast.error("Failed to fetch last token ID");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [isConnected, getLastTokenId]);

  const handleTokenChange = useCallback((index: number, field: keyof TokenMetadata, value: string) => {
    setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, [field]: value } : token)));
  }, []);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, image: file } : token)));
      // Quiet success: selection is visible in the form
    }
  }, []);

  const handleMint = useCallback(async () => {
    if (!isConnected || !isAdmin || !address) {
      customToast.error("Connect the owner wallet to mint.");
      return;
    }
    if (keyStatus && !keyStatus.configured) {
      customToast.error("Uploads are not configured on this deployment (storage key missing).");
      return;
    }

    // Basic input validation for UX
    setStep("validating");
    for (const [i, t] of tokens.entries()) {
      if (!t.name || !t.producer_address) {
        setStep("error");
        customToast.error(`Token ${i + 1}: name and producer address are required`);
        return;
      }
    }

    setCancelRequested(false);
    setIsUploading(true);
    const producers: string[] = [];
    const cids: string[] = [];

    try {
      // 1) Prove ownership once per mint: sign a short-lived authorization the
      //    upload route verifies against owner() on-chain.
      setStep("authorize");
      setStatus("Please sign the upload authorization in your wallet…");
      const message = createUploadAuthorizationMessage(chainId ?? 0, astaverdeContractConfig.address as string);
      const signature = await signMessageAsync({ message });
      const auth: UploadAuthorization = { address, message, signature };

      // 2) Upload assets + metadata
      const total = tokens.length;
      setProgress({ current: 0, total });
      setStep("upload");
      for (let i = 0; i < tokens.length; i++) {
        if (cancelRequested) throw new Error("Mint cancelled");
        const token = tokens[i];
        setStatus(`Preparing token ${i + 1} of ${total}…`);
        try {
          const tokenNumber = lastTokenId ? lastTokenId + i + 1 : i + 1;
          const imageCid =
            uploadImages && token.image
              ? await uploadToIPFS(auth, token.image, token.image.type, `astaverde-token-${tokenNumber}-image`)
              : "";
          const metadata: Record<string, unknown> = {
            name: token.name,
            description: token.description,
            external_url: `${EXTERNAL_URL}${lastTokenId ? lastTokenId + i + 1 : ""}`,
            attributes: [
              { trait_type: "Type", value: "Carbon Offset" },
              { trait_type: "Producer Address", value: token.producer_address },
            ],
            // Keep properties for backward-compat with older metadata expectations
            properties: [{ trait_type: "Producer Address", value: token.producer_address }],
          };
          if (imageCid) {
            metadata.image = `${IPFS_PREFIX}${imageCid}`;
          }
          const metadataCid = await uploadToIPFS(
            auth,
            JSON.stringify(metadata),
            "application/json",
            `astaverde-token-${tokenNumber}-metadata.json`,
          );
          producers.push(token.producer_address);
          cids.push(metadataCid);
          setProgress({ current: i + 1, total });
        } catch (err) {
          const msg = (err as Error)?.message || String(err);
          customToast.error(`Failed to prepare token ${token.name || i + 1}: ${msg}`);
        }
      }

      if (producers.length === 0 || cids.length === 0) {
        throw new Error("No tokens were successfully prepared for minting");
      }

      // 3) On-chain mint
      setStep("prepareTx");
      setStatus("Preparing transaction…");
      customToast.transaction("Please confirm the mint in your wallet");
      setStep("awaitWallet");
      const receipt = await mintBatch(producers, cids);
      setStep("txPending");
      setStatus("Transaction submitted. Waiting for confirmations…");

      if (receipt && receipt.status === "success") {
        setStep("done");
        setStatus("Batch minted successfully");
        customToast.success("Batch minted successfully");
      }

      setTokens([{ name: "", description: "", producer_address: "", image: null }]);
      setUploadImages(true);
      await refetchBatches();
    } catch (e) {
      setStep("error");
      const msg = (e as Error).message || "Failed to mint batch";
      // Friendly guidance for common wallet/extension issues
      if (/tab is not active|ResourceUnavailableRpcError/i.test(msg)) {
        setStatus(
          "Wallet blocked the transaction: browser tab not active. Bring this tab & your wallet prompt to the foreground, close duplicate AstaVerde tabs, then click Continue to retry.",
        );
        customToast.info(
          "Focus this tab and your wallet, close duplicate tabs, then retry. If using Brave/Coinbase wallet, try MetaMask.",
        );
      } else if (/User rejected|denied/i.test(msg)) {
        setStatus("Signature or transaction rejected in the wallet.");
        customToast.info("Cancelled in wallet");
      } else if (msg.includes("cancelled")) {
        customToast.info("Mint cancelled");
      } else {
        setStatus(msg);
        customToast.error(msg);
      }
    } finally {
      setIsUploading(false);
    }
  }, [
    isConnected,
    isAdmin,
    address,
    keyStatus,
    chainId,
    astaverdeContractConfig.address,
    signMessageAsync,
    tokens,
    uploadImages,
    lastTokenId,
    mintBatch,
    refetchBatches,
    cancelRequested,
  ]);

  const addToken = useCallback(() => {
    setTokens((prev) =>
      maxBatchSize !== null && prev.length >= maxBatchSize
        ? prev
        : [...prev, { name: "", description: "", producer_address: "", image: null }],
    );
  }, [maxBatchSize]);

  if (!isAdmin) {
    return <div>You do not have permission to access this page.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 p-4 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
        <h1 className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">Mint</h1>
        <p className="text-sm">Connected as: {address}</p>
        <p>Next Token ID: {lastTokenId !== null ? lastTokenId + 1 : "Loading..."}</p>
        <p className={isAdmin ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {isAdmin ? "You have admin privileges" : "You don't have admin privileges"}
        </p>
        <UploadKeyStatusLine status={keyStatus} />
      </div>
      <MintProgressPanel
        step={step}
        status={status}
        progress={progress}
        busy={isUploading}
        onContinue={() => {
          void handleMint();
        }}
        onCancel={() => {
          setCancelRequested(true);
          setIsUploading(false);
          setStep("idle");
          setStatus("");
          setProgress({ current: 0, total: 0 });
          customToast.info("Cancelled");
        }}
        onClose={() => {
          setStep("idle");
          setStatus("");
          setProgress({ current: 0, total: 0 });
        }}
      />
      {isAdmin && (
        <MintForm
          uploadImages={uploadImages}
          setUploadImages={setUploadImages}
          tokens={tokens}
          lastTokenId={lastTokenId}
          handleTokenChange={handleTokenChange}
          handleImageChange={handleImageChange}
          addToken={addToken}
          handleMint={handleMint}
          isUploading={isUploading}
          maxBatchSize={maxBatchSize}
        />
      )}
    </div>
  );
}

interface MintFormProps {
  uploadImages: boolean;
  setUploadImages: React.Dispatch<React.SetStateAction<boolean>>;
  tokens: TokenMetadata[];
  lastTokenId: number | null;
  handleTokenChange: (index: number, field: keyof TokenMetadata, value: string) => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  addToken: () => void;
  handleMint: () => Promise<void>;
  isUploading: boolean;
  maxBatchSize: number | null;
}

function MintForm({
  uploadImages,
  setUploadImages,
  tokens,
  lastTokenId,
  handleTokenChange,
  handleImageChange,
  addToken,
  handleMint,
  isUploading,
  maxBatchSize,
}: MintFormProps) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="w-full max-w-md space-y-4 bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">Mint New Tokens</h2>
      <p className="text-xs text-gray-500">
        Files are uploaded to IPFS through the marketplace&apos;s storage account. Your wallet will ask for one
        signature to authorize the uploads, then one transaction to mint.
      </p>
      <div className="flex items-center space-x-2 text-gray-800 dark:text-gray-200">
        <input
          type="checkbox"
          id="uploadImages"
          checked={uploadImages}
          onChange={() => setUploadImages(!uploadImages)}
          className="form-checkbox h-5 w-5 text-emerald-600 dark:text-emerald-400 rounded"
        />
        <label htmlFor="uploadImages">Upload Images</label>
      </div>
      {tokens.map((token, index) => (
        <TokenForm
          key={`token-${token.name}-${index}`}
          token={token}
          index={index}
          lastTokenId={lastTokenId}
          handleTokenChange={handleTokenChange}
          handleImageChange={handleImageChange}
          uploadImages={uploadImages}
        />
      ))}
      <button
        type="button"
        className="btn btn-secondary w-full"
        onClick={addToken}
        disabled={maxBatchSize !== null && tokens.length >= maxBatchSize}
      >
        Add Another Token
      </button>
      {maxBatchSize !== null && tokens.length >= maxBatchSize && (
        <p className="text-xs text-gray-500">
          Batch limit reached: the contract allows {maxBatchSize} tokens per mint.
        </p>
      )}
      <button type="button" className="btn btn-primary w-full" onClick={handleMint} disabled={isUploading}>
        {isUploading ? "Uploading..." : "Mint Batch"}
      </button>
      {isUploading && (
        <div className="mt-3 space-y-2 text-sm">
          <button
            type="button"
            className="underline text-gray-600 dark:text-gray-300"
            onClick={() => setShowHelp(!showHelp)}
          >
            {showHelp ? "Hide details" : "What’s happening?"}
          </button>
          {showHelp && (
            <ul className="list-disc pl-5 text-gray-700 dark:text-gray-200 space-y-1">
              <li>Your wallet signs a short-lived upload authorization (no transaction).</li>
              <li>Then we upload images and metadata for each token to IPFS.</li>
              <li>You’ll be asked to confirm the mint in your wallet.</li>
              <li>We’ll refresh Admin data when it’s done.</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface TokenFormProps {
  token: TokenMetadata;
  index: number;
  lastTokenId: number | null;
  handleTokenChange: (index: number, field: keyof TokenMetadata, value: string) => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  uploadImages: boolean;
}

const TokenForm = React.memo<TokenFormProps>(
  ({ token, index, lastTokenId, handleTokenChange, handleImageChange, uploadImages }) => {
    const handleInputChange = useCallback(
      (field: keyof TokenMetadata, value: string) => {
        handleTokenChange(index, field, value);
      },
      [index, handleTokenChange],
    );

    return (
      <div className="space-y-2 p-4 border rounded bg-gray-50 dark:bg-gray-600">
        <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">
          Token {lastTokenId !== null ? lastTokenId + index + 1 : "Loading..."}
        </h3>
        <InputField label="Token Name" value={token.name} onChange={(value) => handleInputChange("name", value)} />
        <InputField
          label="Description"
          value={token.description}
          onChange={(value) => handleInputChange("description", value)}
        />
        <InputField
          label="Producer Address"
          value={token.producer_address}
          onChange={(value) => handleInputChange("producer_address", value)}
        />
        {uploadImages ? (
          <div className="space-y-1">
            <label
              htmlFor={`tokenImage-${index}`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Token Image
            </label>
            <input
              id={`tokenImage-${index}`}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageChange(e, index)}
              className="input"
            />
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No image will be uploaded. A placeholder will be shown.</p>
        )}
      </div>
    );
  },
);

// Inline progress panel for admin mint flow
function MintProgressPanel({
  step,
  status,
  progress,
  onContinue,
  onCancel,
  onClose,
  busy,
}: {
  step: "idle" | "validating" | "authorize" | "upload" | "prepareTx" | "awaitWallet" | "txPending" | "done" | "error";
  status: string;
  progress: { current: number; total: number };
  onContinue: () => void;
  onCancel: () => void;
  onClose?: () => void;
  busy: boolean;
}) {
  const pct = useMemo(() => {
    if (progress.total === 0) return 0;
    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  }, [progress]);

  if (step === "idle") return null;

  return (
    <div className="mt-4 p-4 rounded border bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-800 dark:text-gray-100">Mint Progress</div>
        <div className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
          {step}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{status || "Working…"}</p>
      {step === "upload" && (
        <div className="mt-3">
          <div className="bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {progress.current}/{progress.total}
          </p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {step === "error" && (
          <button type="button" className="btn btn-primary" onClick={onContinue} disabled={busy}>
            Retry
          </button>
        )}
        {(["validating", "authorize", "upload", "prepareTx", "awaitWallet"] as readonly string[]).includes(step) && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        {(step === "done" || step === "error") && (
          <button type="button" className="btn btn-secondary" onClick={onClose || onCancel}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

TokenForm.displayName = "TokenForm";

// Tells the operator whether uploads work on this deployment and when the
// storage key runs out, so a rotation is never a surprise.
function UploadKeyStatusLine({ status }: { status: UploadKeyStatus | null }) {
  if (!status) return <p className="text-xs text-gray-500">Checking upload configuration…</p>;
  if (!status.configured) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Uploads are not configured on this deployment (storage key missing).
      </p>
    );
  }
  if (!status.expiresAt) return <p className="text-xs text-gray-500">Uploads configured.</p>;
  const expires = new Date(status.expiresAt);
  const daysLeft = Math.floor((expires.getTime() - Date.now()) / 86_400_000);
  const soon = daysLeft <= 60;
  return (
    <p className={soon ? "text-sm text-amber-700 dark:text-amber-300" : "text-xs text-gray-500"}>
      Storage upload key expires {expires.toLocaleDateString()}
      {soon ? ` (${daysLeft} days left: create a new key in the storage account and update PINATA_JWT)` : ""}.
    </p>
  );
}

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const InputField = React.memo<InputFieldProps>(({ label, value: propValue, onChange }) => {
  const [localValue, setLocalValue] = useState(propValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = `input-${label.toLowerCase().replace(/\s+/g, "-")}`;

  useEffect(() => {
    setLocalValue(propValue);
  }, [propValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
  }, []);

  const handleBlur = useCallback(() => {
    onChange(localValue);
  }, [onChange, localValue]);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="input"
      />
    </div>
  );
});

InputField.displayName = "InputField";
