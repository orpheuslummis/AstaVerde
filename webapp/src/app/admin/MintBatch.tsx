"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXTERNAL_URL, IPFS_PREFIX } from "@/config/constants";
import { useAppContext } from "@/contexts/AppContext";
import { useWallet } from "@/contexts/WalletContext";
import { useContractInteraction } from "@/hooks/useContractInteraction";
import { customToast } from "@/utils/customToast";
import { connectToSpace, initializeWeb3StorageClient, type TokenMetadata, uploadToIPFS } from "@/utils/ipfsHelper";

export default function MintBatch() {
  const { isConnected, address } = useWallet();
  const { astaverdeContractConfig, isAdmin, refetchBatches } = useAppContext();
  const [tokens, setTokens] = useState<TokenMetadata[]>([
    { name: "", description: "", producer_address: "", image: null },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  type MintStep =
    | "idle"
    | "validating"
    | "login"
    | "waitingEmail"
    | "provision"
    | "upload"
    | "prepareTx"
    | "awaitWallet"
    | "txPending"
    | "done"
    | "error";
  const [step, setStep] = useState<MintStep>("idle");
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [email, setEmail] = useState("");
  const [lastTokenId, setLastTokenId] = useState<number | null>(null);
  const [uploadImages, setUploadImages] = useState(true);
  const [web3StorageClient, setWeb3StorageClient] = useState<unknown>(null);

  const { execute: mintBatch } = useContractInteraction(astaverdeContractConfig, "mintBatch");
  const { execute: getLastTokenId } = useContractInteraction(astaverdeContractConfig, "lastTokenID");

  // One-time init (guarded for React Strict Mode) and safe state update
  const didInitRef = useRef(false);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    if (!didInitRef.current) {
      didInitRef.current = true;
      initializeWeb3StorageClient()
        .then((client) => {
          if (isMountedRef.current) setWeb3StorageClient(client);
        })
        .catch(() => {
          customToast.error("Failed to initialize Web3Storage client");
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
    if (!isConnected || !isAdmin || !email) {
      customToast.error("Please ensure you're connected, have admin rights, and provided an email.");
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

    // Small helper to timeout long steps and surface guidance
    const withTimeout = async <T,>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> => {
      return await Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => {
            onTimeout();
            // Reject to exit current await; caller may retry
            reject(new Error("Timed out waiting for confirmation"));
          }, ms),
        ),
      ]);
    };

    try {
      // 1) Connect/login to Web3.Storage
      if (!web3StorageClient) {
        throw new Error("Web3.Storage client not ready yet — try again in a moment");
      }
      setStep("login");
      setStatus(`Connecting to Web3.Storage and emailing ${email}…`);
      customToast.info(`If prompted, check your inbox at ${email} to authorize Web3.Storage`);

      let timedOut = false;
      let connected = false;
      await withTimeout(
        connectToSpace(web3StorageClient, email, "astaverde-dev").then(() => {
          connected = true;
        }),
        20000,
        () => {
          timedOut = true;
          setStep("waitingEmail");
          setStatus("Waiting for email confirmation… Click the link in your inbox, then hit Continue.");
        },
      ).catch((err) => {
        if (!timedOut) throw err;
      });

      // If we timed out waiting for the email link, stop here.
      // User can click Continue after confirming the email to retry this flow.
      if (timedOut && !connected) {
        setIsUploading(false);
        return;
      }

      // 2) Upload assets + metadata
      const total = tokens.length;
      setProgress({ current: 0, total });
      setStep("upload");
      for (let i = 0; i < tokens.length; i++) {
        if (cancelRequested) throw new Error("Mint cancelled");
        const token = tokens[i];
        setStatus(`Preparing token ${i + 1} of ${total}…`);
        try {
          const imageCid = uploadImages && token.image ? await uploadToIPFS(web3StorageClient, token.image, token.image.type) : "";
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
          const metadataCid = await uploadToIPFS(web3StorageClient, JSON.stringify(metadata), "application/json");
          producers.push(token.producer_address);
          cids.push(metadataCid);
          setProgress({ current: i + 1, total });
        } catch (err) {
          const msg = (err as Error)?.message || String(err);
          if (msg.toLowerCase().includes("missing current space")) {
            setStep("waitingEmail");
            setStatus("Web3.Storage session not ready. Confirm the email link, then click Continue.");
            setIsUploading(false);
            return;
          }
          customToast.error(`Failed to prepare token ${token.name || i + 1}`);
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
      setEmail("");
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
      } else if (msg.includes("Timed out")) {
        customToast.info("Still waiting for email authorization. After confirming, click Continue.");
      } else if (msg.includes("cancelled")) {
        customToast.info("Mint cancelled");
      } else {
        setStatus(msg);
        customToast.error(msg);
      }
    } finally {
      setIsUploading(false);
    }
  }, [isConnected, isAdmin, email, web3StorageClient, tokens, uploadImages, lastTokenId, mintBatch, refetchBatches, cancelRequested, step]);

  const addToken = useCallback(() => {
    setTokens((prev) => [...prev, { name: "", description: "", producer_address: "", image: null }]);
  }, []);

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
      </div>
      <MintProgressPanel
        step={step}
        status={status}
        progress={progress}
        busy={isUploading}
        onContinue={() => {
          // Restart the flow; if email has been confirmed, it will proceed
          if (!isUploading) {
            setIsUploading(true);
          }
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
          email={email}
          setEmail={setEmail}
          uploadImages={uploadImages}
          setUploadImages={setUploadImages}
          tokens={tokens}
          lastTokenId={lastTokenId}
          handleTokenChange={handleTokenChange}
          handleImageChange={handleImageChange}
          addToken={addToken}
          handleMint={handleMint}
          isUploading={isUploading}
        />
      )}
    </div>
  );
}

interface MintFormProps {
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  uploadImages: boolean;
  setUploadImages: React.Dispatch<React.SetStateAction<boolean>>;
  tokens: TokenMetadata[];
  lastTokenId: number | null;
  handleTokenChange: (index: number, field: keyof TokenMetadata, value: string) => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  addToken: () => void;
  handleMint: () => Promise<void>;
  isUploading: boolean;
}

function MintForm({
  email,
  setEmail,
  uploadImages,
  setUploadImages,
  tokens,
  lastTokenId,
  handleTokenChange,
  handleImageChange,
  addToken,
  handleMint,
  isUploading,
}: MintFormProps) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="w-full max-w-md space-y-4 bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">Mint New Tokens</h2>
      <input type="email" placeholder="Email for Web3.Storage login" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
      <p className="text-xs text-gray-500">You may receive a one-time email to authorize uploads.</p>
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
      <button type="button" className="btn btn-secondary w-full" onClick={addToken}>
        Add Another Token
      </button>
      <button type="button" className="btn btn-primary w-full" onClick={handleMint} disabled={isUploading}>
        {isUploading ? "Uploading..." : "Mint Batch"}
      </button>
      {isUploading && (
        <div className="mt-3 space-y-2 text-sm">
          <button type="button" className="underline text-gray-600 dark:text-gray-300" onClick={() => setShowHelp(!showHelp)}>
            {showHelp ? "Hide details" : "What’s happening?"}
          </button>
          {showHelp && (
            <ul className="list-disc pl-5 text-gray-700 dark:text-gray-200 space-y-1">
              <li>We may email you to authorize Web3.Storage uploads.</li>
              <li>Then we upload images and metadata for each token.</li>
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

const TokenForm = React.memo<TokenFormProps>(({ token, index, lastTokenId, handleTokenChange, handleImageChange, uploadImages }) => {
  const handleInputChange = useCallback(
    (field: keyof TokenMetadata, value: string) => {
      handleTokenChange(index, field, value);
    },
    [index, handleTokenChange],
  );

  return (
    <div className="space-y-2 p-4 border rounded bg-gray-50 dark:bg-gray-600">
      <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">Token {lastTokenId !== null ? lastTokenId + index + 1 : "Loading..."}</h3>
      <InputField label="Token Name" value={token.name} onChange={(value) => handleInputChange("name", value)} />
      <InputField label="Description" value={token.description} onChange={(value) => handleInputChange("description", value)} />
      <InputField label="Producer Address" value={token.producer_address} onChange={(value) => handleInputChange("producer_address", value)} />
      {uploadImages ? (
        <div className="space-y-1">
          <label htmlFor={`tokenImage-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Token Image
          </label>
          <input id={`tokenImage-${index}`} type="file" accept="image/*" onChange={(e) => handleImageChange(e, index)} className="input" />
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">No image will be uploaded. A placeholder will be shown.</p>
      )}
    </div>
  );
});

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
  step: "idle" | "validating" | "login" | "waitingEmail" | "provision" | "upload" | "prepareTx" | "awaitWallet" | "txPending" | "done" | "error";
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

  const isWaitingEmail = step === "waitingEmail";

  return (
    <div className="mt-4 p-4 rounded border bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-800 dark:text-gray-100">Mint Progress</div>
        {isWaitingEmail ? (
          <div className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Action required</div>
        ) : (
          <div className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">{step}</div>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{status || "Working…"}</p>
      {step === "upload" && (
        <div className="mt-3">
          <div className="bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">{progress.current}/{progress.total}</p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {isWaitingEmail && (
          <button type="button" className="btn btn-primary" onClick={onContinue} disabled={busy}>
            Continue
          </button>
        )}
        {(["validating", "login", "provision", "upload", "prepareTx", "awaitWallet"] as const).includes(step) && (
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
      <input id={id} ref={inputRef} type="text" value={localValue} onChange={handleChange} onBlur={handleBlur} className="input" />
    </div>
  );
});

InputField.displayName = "InputField";
