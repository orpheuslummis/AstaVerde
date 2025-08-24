"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { EXTERNAL_URL, IPFS_PREFIX } from "../../config/constants";
import { useAppContext } from "../../contexts/AppContext";
import { useWallet } from "../../contexts/WalletContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { customToast } from "../../shared/utils/customToast";
import { connectToSpace, initializeWeb3StorageClient, type TokenMetadata, uploadToIPFS } from "../../utils/ipfsHelper";

export default function MintPage() {
  const { isConnected, address } = useWallet();
  const { astaverdeContractConfig, isAdmin, refetchBatches } = useAppContext();
  const [tokens, setTokens] = useState<TokenMetadata[]>([
    { name: "", description: "", producer_address: "", image: null },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [email, setEmail] = useState("");
  const [lastTokenId, setLastTokenId] = useState<number | null>(null);
  const [uploadImages, setUploadImages] = useState(true);
  const [web3StorageClient, setWeb3StorageClient] = useState<unknown>(null);

  const { execute: mintBatch } = useContractInteraction(astaverdeContractConfig, "mintBatch");
  const { execute: getLastTokenId } = useContractInteraction(astaverdeContractConfig, "lastTokenID");

  useEffect(() => {
    initializeWeb3StorageClient()
      .then((client) => {
        setWeb3StorageClient(client);
        customToast.success("Web3Storage client initialized successfully");
      })
      .catch(() => {
        customToast.error("Failed to initialize Web3Storage client");
      });
  }, []);

  useEffect(() => {
    if (isConnected) {
      getLastTokenId()
        .then((id) => {
          setLastTokenId(Number(id));
          customToast.success(`Last token ID fetched: ${Number(id)}`);
        })
        .catch(() => {
          customToast.error("Failed to fetch last token ID");
        });
    }
  }, [isConnected, getLastTokenId]);

  const handleTokenChange = useCallback((index: number, field: keyof TokenMetadata, value: string) => {
    setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, [field]: value } : token)));
  }, []);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, image: file } : token)));
      customToast.success(`Image selected for token ${index + 1}`);
    }
  }, []);

  const handleMint = useCallback(async () => {
    if (!isConnected || !isAdmin || !email) {
      customToast.error("Please ensure you're connected, have admin rights, and provided an email.");
      return;
    }

    setIsUploading(true);
    const producers: string[] = [];
    const cids: string[] = [];

    try {
      const client = await connectToSpace(web3StorageClient, email, "astaverde-dev");
      customToast.success("Email verified and connected to Web3Storage space");

      for (const token of tokens) {
        try {
          const imageCid =
                        uploadImages && token.image ? await uploadToIPFS(client, token.image, token.image.type) : "";
          if (imageCid) customToast.success(`Image uploaded for token: ${token.name}`);

          const metadata = {
            name: token.name,
            description: token.description,
            external_url: `${EXTERNAL_URL}${lastTokenId ? lastTokenId + producers.length + 1 : ""}`,
            image: imageCid ? `${IPFS_PREFIX}${imageCid}` : "",
            properties: [{ trait_type: "Producer Address", value: token.producer_address }],
          };
          const metadataCid = await uploadToIPFS(client, JSON.stringify(metadata), "application/json");
          customToast.success(`Metadata uploaded for token: ${token.name}`);

          producers.push(token.producer_address);
          cids.push(metadataCid);
        } catch {
          customToast.error(`Failed to prepare token ${token.name}`);
        }
      }

      if (producers.length === 0 || cids.length === 0) {
        throw new Error("No tokens were successfully prepared for minting");
      }

      await mintBatch(producers, cids);
      customToast.success("Batch minted successfully");
      setTokens([{ name: "", description: "", producer_address: "", image: null }]);
      setLastTokenId((prev) => prev ? prev + tokens.length : null);
      await refetchBatches();
      customToast.success("Batch information updated");
    } catch (error) {
      customToast.error(`Failed to mint batch: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  }, [isConnected, isAdmin, email, web3StorageClient, uploadImages, tokens, lastTokenId, mintBatch, refetchBatches]);

  const addToken = useCallback(() => {
    setTokens((prev) => [...prev, { name: "", description: "", producer_address: "", image: null }]);
  }, []);

  if (!isConnected) {
    return <p>Please connect your wallet to mint tokens.</p>;
  }

  return (
    <div className="flex flex-col items-center space-y-8 p-4 bg-gray-100 dark:bg-gray-800 min-h-screen">
      <h1 className="text-3xl font-bold mb-4 text-emerald-700 dark:text-emerald-300">AstaVerde Minting Page</h1>
      <div className="flex flex-col items-center space-y-2 text-gray-800 dark:text-gray-200">
        <p>Connected Address: {address}</p>
        <p>Next Token ID: {lastTokenId !== null ? lastTokenId + 1 : "Loading..."}</p>
        <p className={isAdmin ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {isAdmin ? "You have admin privileges" : "You don't have admin privileges"}
        </p>
      </div>
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
  return (
    <div className="w-full max-w-md space-y-4 bg-white dark:bg-gray-700 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-emerald-700 dark:text-emerald-300">Mint New Tokens</h2>
      <input
        type="email"
        placeholder="Email for IPFS"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input"
      />
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
      >
                Add Another Token
      </button>
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={handleMint}
        disabled={isUploading}
      >
        {isUploading ? "Uploading..." : "Mint Batch"}
      </button>
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
  const handleInputChange = useCallback((field: keyof TokenMetadata, value: string) => {
    handleTokenChange(index, field, value);
  }, [index, handleTokenChange]);

  return (
    <div className="space-y-2 p-4 border rounded bg-gray-50 dark:bg-gray-600">
      <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">Token {lastTokenId !== null ? lastTokenId + index + 1 : "Loading..."}</h3>
      <InputField
        label="Token Name"
        value={token.name}
        onChange={(value) => handleInputChange("name", value)}
      />
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
      {uploadImages && (
        <div className="space-y-1">
          <label htmlFor={`tokenImage-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Token Image</label>
          <input
            id={`tokenImage-${index}`}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageChange(e, index)}
            className="input"
          />
        </div>
      )}
    </div>
  );
});

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
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
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
