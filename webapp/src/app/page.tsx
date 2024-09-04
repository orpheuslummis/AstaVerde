"use client";

import { useEffect, useMemo } from "react";
import { BatchCard } from "../components/BatchCard";
import { useAppContext } from "../contexts/AppContext";

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
            if (a.itemsLeft > 0n && b.itemsLeft === 0n) return -1;
            if (a.itemsLeft === 0n && b.itemsLeft > 0n) return 1;
            return Number(b.id ?? 0n) - Number(a.id ?? 0n);
        });
    }, [batches]);

    console.log("BatchListing render, batches:", batches);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedBatches.map((batch) => (
                    <BatchCard
                        key={batch.id?.toString() ?? `batch-${Math.random()}`}
                        batch={batch}
                        isSoldOut={batch.itemsLeft === 0n}
                    />
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    return <BatchListing />;
}
