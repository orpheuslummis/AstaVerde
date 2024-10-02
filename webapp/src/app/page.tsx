"use client";

import { useEffect, useMemo } from "react";
import { BatchCard } from "../components/BatchCard";
import { useAppContext } from "../contexts/AppContext";
import Link from "next/link";

function BatchListing() {
    const { batches, refetchBatches } = useAppContext();

    useEffect(() => {
        console.log("BatchListing effect running");
        const fetchBatches = async () => {
            console.log("Refetching batches...");
            await refetchBatches();
        };

        fetchBatches();
        const intervalId = setInterval(fetchBatches, 30000); // Refetch every 30 seconds

        return () => clearInterval(intervalId);
    }, [refetchBatches]);

    const sortedBatches = useMemo(() => {
        return [...batches].sort((a, b) => {
            const aItemsLeft = a.itemsLeft ?? 0n;
            const bItemsLeft = b.itemsLeft ?? 0n;
            if (aItemsLeft > 0n && bItemsLeft === 0n) return -1;
            if (aItemsLeft === 0n && bItemsLeft > 0n) return 1;
            return Number(b.id ?? 0n) - Number(a.id ?? 0n);
        });
    }, [batches]);

    console.log("BatchListing render, batches:", batches);

    return (
        <div className="container mx-auto px-4 py-8">
            {batches.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedBatches.map((batch) => (
                        <Link 
                            key={batch.id?.toString() ?? `batch-${Math.random()}`}
                            href={`/batch/${batch.id}`}
                            className="block hover:no-underline"
                        >
                            <BatchCard
                                batch={batch}
                                isSoldOut={batch.itemsLeft === 0n}
                            />
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <p className="text-xl">No batches available yet.</p>
                </div>
            )}
        </div>
    );
}

export default function Home() {
    return <BatchListing />;
}
