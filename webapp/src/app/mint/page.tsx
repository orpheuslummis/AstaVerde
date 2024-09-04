"use client";

import { ethers, Log } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useAppContext } from "../../contexts/AppContext";
import { useWallet } from "../../contexts/WalletContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { customToast } from "../../utils/customToast";

const IPFS_PREFIX = "ipfs://";
const EXTERNAL_URL = "https://marketplace.ecotradezone.com/token/";

interface TokenMetadata {
    name: string;
    description: string;
    producer_address: string;
    image: File | null;
}

export default function MintPage() {
    const { isConnected, address } = useWallet();
    const { adminControls, astaverdeContractConfig, isAdmin, refetchBatches } = useAppContext();
    const { address: accountAddress } = useAccount();
    const [tokens, setTokens] = useState<TokenMetadata[]>([
        {
            name: "",
            description: "",
            producer_address: "",
            image: null,
        },
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
        const loadWeb3StorageClient = async () => {
            try {
                const { create } = await import("@web3-storage/w3up-client");
                const client = await create();
                setWeb3StorageClient(client);
            } catch (error) {
                console.error("Failed to load Web3Storage client:", error);
            }
        };

        loadWeb3StorageClient();
    }, []);

    useEffect(() => {
        const fetchLastTokenId = async () => {
            try {
                const id = await getLastTokenId();
                setLastTokenId(Number(id));
            } catch (error) {
                console.error("Error fetching last token ID:", error);
                customToast.error("Failed to fetch last token ID");
            }
        };

        if (isConnected) {
            fetchLastTokenId();
        }
    }, [isConnected, getLastTokenId]);

    const connectToSpace = useCallback(
        async (spaceName: string) => {
            if (!web3StorageClient) {
                throw new Error("Web3Storage client is not initialized");
            }
            try {
                const userAccount = await web3StorageClient.login(email);
                const space = await web3StorageClient.createSpace(spaceName);
                await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for plan selection
                await userAccount.provision(space.did());
                await space.createRecovery(userAccount.did());
                await space.save();
                await web3StorageClient.setCurrentSpace(space.did());
                return web3StorageClient;
            } catch (error) {
                console.error("Error connecting to space:", error);
                throw error;
            }
        },
        [web3StorageClient, email],
    );

    const uploadToIPFS = useCallback(
        async (content: File | string, contentType: string): Promise<string> => {
            if (!web3StorageClient) {
                throw new Error("Web3Storage client is not initialized");
            }
            try {
                const blob = content instanceof File ? content : new Blob([content], { type: contentType });
                const cid = await web3StorageClient.uploadFile(blob);
                return cid.toString();
            } catch (error) {
                console.error("Error in uploadToIPFS:", error);
                throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
            }
        },
        [web3StorageClient],
    );

    const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, image: file } : token)));
        }
    }, []);

    const handleTokenChange = useCallback((index: number, field: keyof TokenMetadata, value: string) => {
        setTokens((prev) => prev.map((token, i) => (i === index ? { ...token, [field]: value } : token)));
    }, []);

    const queryMintedTokens = useCallback(
        async (batchId: bigint) => {
            try {
                const batchInfo = await getBatchInfo(batchId);
                console.log(`\nBatch ${batchId} Info:`);
                console.log(`Token IDs: ${batchInfo.tokenIds.map((id: bigint) => id.toString()).join(", ")}`);
                console.log(`Creation Time: ${new Date(Number(batchInfo.creationTime) * 1000).toLocaleString()}`);
                console.log(`Price: ${ethers.formatUnits(batchInfo.price, 6)} USDC`);
                console.log(`Remaining Tokens: ${batchInfo.remainingTokens.toString()}`);

                console.log("\nView tokens on marketplace:");
                batchInfo.tokenIds.forEach((id: bigint) => {
                    console.log(`Token ${id}: ${EXTERNAL_URL}${id}`);
                });
            } catch (error) {
                console.error("Error querying minted tokens:", error);
            }
        },
        [getBatchInfo],
    );

    const handleMint = useCallback(async () => {
        if (!isConnected) {
            customToast.error("Please connect your wallet first");
            return;
        }

        if (!isAdmin) {
            customToast.error("You don't have permission to mint tokens");
            return;
        }

        if (!email) {
            customToast.error("Please provide an email address");
            return;
        }

        setIsUploading(true);
        const producers: string[] = [];
        const cids: string[] = [];

        try {
            const client = await connectToSpace("astaverde-dev");

            for (const token of tokens) {
                try {
                    let imageCid = "";
                    if (uploadImages && token.image) {
                        imageCid = await uploadToIPFS(token.image, token.image.type);
                    }

                    const metadata = {
                        name: token.name,
                        description: token.description,
                        external_url: `${EXTERNAL_URL}${lastTokenId! + producers.length + 1}`,
                        image: imageCid ? `${IPFS_PREFIX}${imageCid}` : "",
                        properties: [{ trait_type: "Producer Address", value: token.producer_address }],
                    };

                    const metadataCid = await uploadToIPFS(JSON.stringify(metadata), "application/json");

                    producers.push(token.producer_address);
                    cids.push(metadataCid);

                    console.log(`Prepared token ${token.name} with metadata CID: ${metadataCid}`);
                } catch (error) {
                    console.error(`Error preparing token ${token.name}:`, error);
                    customToast.error(`Failed to prepare token ${token.name}`);
                }
            }

            if (producers.length === 0 || cids.length === 0) {
                customToast.error("No tokens were successfully prepared for minting");
                return;
            }

            console.log("Minting batch of tokens");
            console.log("Producers:", producers);
            console.log("CIDs:", cids);
            const receipt = await mintBatch(producers, cids);
            console.log("Transaction sent:", receipt.transactionHash);
            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

            const batchMintedEvent = receipt.logs.find(
                (log: Log) => log.topics[0] === ethers.id("BatchMinted(uint256,uint256[])"),
            );

            if (batchMintedEvent) {
                const [batchId] = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], batchMintedEvent.topics[1]);
                console.log("BatchMinted event found. Batch ID:", batchId);
                await queryMintedTokens(batchId);
            } else {
                console.warn("BatchMinted event not found in transaction logs");
            }

            customToast.success("Batch minted successfully");
            setTokens([{ name: "", description: "", producer_address: "", image: null }]);
            setLastTokenId((prev) => prev! + tokens.length);

            await refetchBatches();
        } catch (error) {
            console.error("Error minting batch:", error);
            customToast.error("Failed to mint batch: " + (error as Error).message);
        } finally {
            setIsUploading(false);
        }
    }, [
        isConnected,
        isAdmin,
        email,
        uploadToIPFS,
        mintBatch,
        lastTokenId,
        uploadImages,
        tokens,
        connectToSpace,
        queryMintedTokens,
        refetchBatches,
    ]);

    const addToken = useCallback(() => {
        setTokens((prev) => [...prev, { name: "", description: "", producer_address: "", image: null }]);
    }, []);

    return (
        <div className="flex flex-col items-center space-y-8 p-4">
            <h1 className="text-3xl font-bold mb-4">AstaVerde Minting Page</h1>

            {isConnected ? (
                <div className="flex flex-col items-center space-y-2">
                    <p>Connected Address: {address}</p>
                    <p>Next Token ID: {lastTokenId !== null ? lastTokenId + 1 : "Loading..."}</p>
                    {isAdmin ? (
                        <p className="text-green-500">You have admin privileges</p>
                    ) : (
                        <p className="text-red-500">You don't have admin privileges</p>
                    )}
                </div>
            ) : (
                <p>Please connect your wallet to mint tokens.</p>
            )}

            {isAdmin && (
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
                        <div key={index} className="space-y-2 p-4 border rounded">
                            <h3 className="font-semibold">
                                Token {lastTokenId !== null ? lastTokenId + index + 1 : "Loading..."}
                            </h3>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Token Name</label>
                                <input
                                    type="text"
                                    value={token.name}
                                    onChange={(e) => handleTokenChange(index, "name", e.target.value)}
                                    className="border rounded px-2 py-1 w-full"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <input
                                    type="text"
                                    value={token.description}
                                    onChange={(e) => handleTokenChange(index, "description", e.target.value)}
                                    className="border rounded px-2 py-1 w-full"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">Producer Address</label>
                                <input
                                    type="text"
                                    value={token.producer_address}
                                    onChange={(e) => handleTokenChange(index, "producer_address", e.target.value)}
                                    className="border rounded px-2 py-1 w-full"
                                />
                            </div>
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
                        disabled={isUploading || !isConnected}
                    >
                        {isUploading ? "Uploading..." : "Mint Batch"}
                    </button>
                </div>
            )}
        </div>
    );
}
