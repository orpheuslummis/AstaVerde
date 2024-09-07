"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { EXTERNAL_URL, IPFS_PREFIX } from "../../app.config";
import { useAppContext } from "../../contexts/AppContext";
import { useWallet } from "../../contexts/WalletContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { customToast } from "../../utils/customToast";
import { connectToSpace, initializeWeb3StorageClient, TokenMetadata, uploadToIPFS } from "../../utils/ipfsHelper";

export default function MintPage() {
    const { isConnected, address } = useWallet();
    const { astaverdeContractConfig, isAdmin, refetchBatches } = useAppContext();
    const { address: accountAddress } = useAccount();
    const [tokens, setTokens] = useState<TokenMetadata[]>([
        { name: "", description: "", producer_address: "", image: null },
    ]);
    const [isUploading, setIsUploading] = useState(false);
    const [email, setEmail] = useState("");
    const [lastTokenId, setLastTokenId] = useState<number | null>(null);
    const [uploadImages, setUploadImages] = useState(true);
    const [web3StorageClient, setWeb3StorageClient] = useState<any>(null);

    const { execute: mintBatch } = useContractInteraction(astaverdeContractConfig, "mintBatch");
    const { execute: getLastTokenId } = useContractInteraction(astaverdeContractConfig, "lastTokenID");
    const { execute: getBatchInfo } = useContractInteraction(astaverdeContractConfig, "getBatchInfo");

    useEffect(() => {
        initializeWeb3StorageClient()
            .then((client) => {
                setWeb3StorageClient(client);
                customToast.success("Web3Storage client initialized successfully");
            })
            .catch((error) => {
                console.error("Failed to initialize Web3Storage client:", error);
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
                .catch((error) => {
                    console.error("Error fetching last token ID:", error);
                    customToast.error("Failed to fetch last token ID");
                });
        }
    }, [isConnected, getLastTokenId]);

    const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, image: file } : token)));
            customToast.success(`Image selected for token ${index + 1}`);
        }
    }, []);

    const handleTokenChange = useCallback((index: number, field: keyof TokenMetadata, value: string) => {
        setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, [field]: value } : token)));
    }, []);

    const handleMint = useCallback(async () => {
        if (!isConnected || !isAdmin || !email) {
            customToast.error("Please ensure you're connected, have admin rights, and provided an email.");
            return;
        }

        setIsUploading(true);
        customToast.info("Starting batch minting process...");
        const producers: string[] = [];
        const cids: string[] = [];

        try {
            const client = await connectToSpace(web3StorageClient, email, "astaverde-dev");
            customToast.success("Connected to Web3Storage space");

            for (const token of tokens) {
                try {
                    let imageCid =
                        uploadImages && token.image ? await uploadToIPFS(client, token.image, token.image.type) : "";
                    if (imageCid) customToast.success(`Image uploaded for token: ${token.name}`);

                    const metadata = {
                        name: token.name,
                        description: token.description,
                        external_url: `${EXTERNAL_URL}${lastTokenId! + producers.length + 1}`,
                        image: imageCid ? `${IPFS_PREFIX}${imageCid}` : "",
                        properties: [{ trait_type: "Producer Address", value: token.producer_address }],
                    };
                    const metadataCid = await uploadToIPFS(client, JSON.stringify(metadata), "application/json");
                    customToast.success(`Metadata uploaded for token: ${token.name}`);

                    producers.push(token.producer_address);
                    cids.push(metadataCid);
                    console.log(`Prepared token ${token.name} with metadata CID: ${metadataCid}`);
                } catch (error) {
                    console.error(`Error preparing token ${token.name}:`, error);
                    customToast.error(`Failed to prepare token ${token.name}`);
                }
            }

            if (producers.length === 0 || cids.length === 0) {
                throw new Error("No tokens were successfully prepared for minting");
            }

            console.log("Minting batch of tokens", { producers, cids });
            customToast.info("Submitting transaction to mint batch...");
            await mintBatch(producers, cids);
            customToast.success("Batch minting transaction confirmed");

            customToast.success("Batch minted successfully");
            setTokens([{ name: "", description: "", producer_address: "", image: null }]);
            setLastTokenId((prev) => prev! + tokens.length);
            await refetchBatches();
            customToast.success("Batch information updated");
        } catch (error) {
            console.error("Error minting batch:", error);
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
        <div className="flex flex-col items-center space-y-8 p-4">
            <h1 className="text-3xl font-bold mb-4">AstaVerde Minting Page</h1>
            <div className="flex flex-col items-center space-y-2">
                <p>Connected Address: {address}</p>
                <p>Next Token ID: {lastTokenId !== null ? lastTokenId + 1 : "Loading..."}</p>
                <p className={isAdmin ? "text-green-500" : "text-red-500"}>
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
        <div className="w-full max-w-md space-y-4">
            <h2 className="text-2xl font-semibold">Mint New Tokens</h2>
            <input
                type="email"
                placeholder="Email for IPFS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border rounded px-2 py-1 w-full"
            />
            <div className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    id="uploadImages"
                    checked={uploadImages}
                    onChange={() => setUploadImages(!uploadImages)}
                />
                <label htmlFor="uploadImages">Upload Images</label>
            </div>
            {tokens.map((token, index) => (
                <TokenForm
                    key={index}
                    token={token}
                    index={index}
                    lastTokenId={lastTokenId}
                    handleTokenChange={handleTokenChange}
                    handleImageChange={handleImageChange}
                    uploadImages={uploadImages}
                />
            ))}
            <button
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
                onClick={addToken}
            >
                Add Another Token
            </button>
            <button
                className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded w-full"
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

function TokenForm({ token, index, lastTokenId, handleTokenChange, handleImageChange, uploadImages }: TokenFormProps) {
    return (
        <div className="space-y-2 p-4 border rounded">
            <h3 className="font-semibold">Token {lastTokenId !== null ? lastTokenId + index + 1 : "Loading..."}</h3>
            <InputField
                label="Token Name"
                value={token.name}
                onChange={(e) => handleTokenChange(index, "name", e.target.value)}
            />
            <InputField
                label="Description"
                value={token.description}
                onChange={(e) => handleTokenChange(index, "description", e.target.value)}
            />
            <InputField
                label="Producer Address"
                value={token.producer_address}
                onChange={(e) => handleTokenChange(index, "producer_address", e.target.value)}
            />
            {uploadImages && (
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Token Image</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageChange(e, index)}
                        className="border rounded px-2 py-1 w-full"
                    />
                </div>
            )}
        </div>
    );
}

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function InputField({ label, value, onChange }: InputFieldProps) {
    return (
        <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input type="text" value={value} onChange={onChange} className="border rounded px-2 py-1 w-full" />
        </div>
    );
}
