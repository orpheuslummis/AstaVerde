"use client";

import { Client, create } from "@web3-storage/w3up-client";
import { useCallback, useEffect, useState } from "react";
import { AppProvider, useAppContext } from "../../contexts/AppContext";
import { useWallet } from "../../contexts/WalletContext";
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { customToast } from "../../utils/customToast";

const IPFS_PREFIX = "ipfs://";

interface TokenMetadata {
    name: string;
    description: string;
    producer_address: string;
    image: File | null;
}

interface UploadResult {
    metadataCid: string;
    imageCid?: string;
}

function MintPage() {
    const { isConnected, address, connect } = useWallet();
    const { adminControls, astaverdeContractConfig } = useAppContext();
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
    const [spaceDID, setSpaceDID] = useState<string | null>(null);

    const { execute: mintBatch } = useContractInteraction(astaverdeContractConfig, "mintBatch");
    const { execute: getLastTokenId } = useContractInteraction(astaverdeContractConfig, "lastTokenID");

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

    const createAndSetSpace = useCallback(async (client: any) => {
        try {
            const space = await client.createSpace("astaverde-space");
            await client.setCurrentSpace(space.did());
            setSpaceDID(space.did());
            return space.did();
        } catch (error) {
            console.error("Error creating space:", error);
            throw new Error(`Failed to create space: ${(error as Error).message}`);
        }
    }, []);

    const uploadToIPFS = useCallback(
        async (content: File | object, isImage: boolean = false): Promise<UploadResult> => {
            console.log("Starting uploadToIPFS function");
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new Error("Invalid email format");
            }
            try {
                console.log("Creating client");
                const client: Client = await create();
                console.log("Client created successfully");

                console.log("Logging in with email:", email);
                await client.login(email as `${string}@${string}`);
                console.log("Login successful");

                console.log("Getting current space");
                let space = client.currentSpace();
                console.log("Current space:", space);

                if (!space) {
                    console.log("No current space, creating new space");
                    space = (await client.createSpace("astaverde-space")) as any;
                    console.log("New space created:", space);
                    if (!space) {
                        throw new Error("Failed to create space");
                    }
                }

                console.log("Setting current space");
                await client.setCurrentSpace(space.did());
                console.log("Current space set successfully");

                console.log("Getting accounts");
                const accounts = await client.accounts();
                console.log("Accounts:", accounts);

                const accountDID = Object.keys(accounts)[0];
                console.log("First account DID:", accountDID);

                if (accountDID) {
                    const account = accounts[accountDID as keyof typeof accounts]; // Type assertion
                    console.log("Account:", account);

                    if (account) {
                        console.log("Attempting to provision space");
                        try {
                            await account.provision(space.did());
                            console.log("Space provisioned successfully");
                        } catch (error) {
                            console.warn("Space provisioning failed, it might already be provisioned:", error);
                        }
                    }
                }

                if (isImage) {
                    console.log("Uploading image");
                    if (content instanceof File) {
                        const imageCid = await client.uploadFile(content);
                        console.log("Image uploaded, CID:", imageCid.toString());
                        return { imageCid: imageCid.toString(), metadataCid: "" };
                    } else {
                        throw new Error("Invalid content for image upload");
                    }
                } else {
                    console.log("Uploading metadata");
                    const metadataBlob = new Blob([JSON.stringify(content)], { type: "application/json" });
                    const metadataCid = await client.uploadFile(metadataBlob);
                    console.log("Metadata uploaded, CID:", metadataCid.toString());
                    return { metadataCid: metadataCid.toString() };
                }
            } catch (error) {
                console.error("Error in uploadToIPFS:", error);
                throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
            }
        },
        [email],
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

    const handleMint = useCallback(async () => {
        console.log("Starting handleMint function");
        if (!isConnected) {
            console.log("Wallet not connected");
            customToast.error("Please connect your wallet first");
            return;
        }

        if (!email) {
            console.log("Email not provided");
            customToast.error("Please provide an email address");
            return;
        }

        const producers: string[] = [];
        const cids: string[] = [];

        try {
            console.log("Preparing tokens for minting");
            for (const token of tokens) {
                console.log("Processing token:", token);
                try {
                    let imageCid = "";
                    if (uploadImages) {
                        console.log("Uploading image for token");
                        const imageFile = token.image;
                        if (imageFile) {
                            const imageResult = await uploadToIPFS(imageFile, true);
                            imageCid = imageResult.imageCid || "";
                            console.log("Image uploaded, CID:", imageCid);
                        }
                    }

                    const metadata = {
                        name: token.name,
                        description: token.description,
                        image: imageCid ? `${IPFS_PREFIX}${imageCid}` : "",
                        properties: [{ trait_type: "Producer Address", value: token.producer_address }],
                    };

                    console.log("Uploading metadata for token");
                    const metadataResult = await uploadToIPFS(metadata);
                    console.log("Metadata uploaded, CID:", metadataResult.metadataCid);

                    producers.push(token.producer_address);
                    cids.push(metadataResult.metadataCid);

                    console.log(`Prepared token ${token.name} with metadata CID: ${metadataResult.metadataCid}`);
                } catch (error) {
                    console.error(`Error preparing token ${token.name}:`, error);
                    customToast.error(`Failed to prepare token ${token.name}`);
                }
            }

            if (producers.length === 0 || cids.length === 0) {
                console.log("No tokens were successfully prepared");
                customToast.error("No tokens were successfully prepared for minting");
                return;
            }

            console.log("Minting batch of tokens");
            console.log("Producers:", producers);
            console.log("CIDs:", cids);
            await mintBatch(producers, cids);
            console.log("Batch minted successfully");
            customToast.success("Batch minted successfully");
            setTokens([{ name: "", description: "", producer_address: "", image: null }]);
            // Update lastTokenId after successful minting
            setLastTokenId((prev) => prev! + tokens.length);
        } catch (error) {
            console.error("Error minting batch:", error);
            customToast.error("Failed to mint batch: " + (error as Error).message);
        }
    }, [isConnected, email, uploadToIPFS, mintBatch, lastTokenId, uploadImages, tokens]);

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
                </div>
            ) : (
                <button
                    onClick={connect}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                    Connect Wallet
                </button>
            )}

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
                    disabled={isUploading}
                >
                    {isUploading ? "Uploading..." : "Mint Batch"}
                </button>
            </div>
        </div>
    );
}

export default function MintPageWrapper() {
    return (
        <AppProvider>
            <MintPage />
        </AppProvider>
    );
}
