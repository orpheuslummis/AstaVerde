export interface TokenMetadata {
    name: string;
    description: string;
    producer_address: string;
    image: File | null;
}

export async function initializeWeb3StorageClient() {
    try {
        const { create } = await import("@web3-storage/w3up-client");
        return await create();
    } catch (error) {
        console.error("Failed to load Web3Storage client:", error);
        throw error;
    }
}

export async function uploadToIPFS(client: any, content: File | string, contentType: string): Promise<string> {
    if (!client) {
        throw new Error("Web3Storage client is not initialized");
    }
    try {
        const blob = content instanceof File ? content : new Blob([content], { type: contentType });
        const cid = await client.uploadFile(blob);
        return cid.toString();
    } catch (error) {
        console.error("Error in uploadToIPFS:", error);
        throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
    }
}

export async function connectToSpace(client: any, email: string, spaceName: string) {
    if (!client) {
        throw new Error("Web3Storage client is not initialized");
    }
    try {
        const userAccount = await client.login(email);
        const space = await client.createSpace(spaceName);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for plan selection
        await userAccount.provision(space.did());
        await space.createRecovery(userAccount.did());
        await space.save();
        await client.setCurrentSpace(space.did());
        return client;
    } catch (error) {
        console.error("Error connecting to space:", error);
        throw error;
    }
}
