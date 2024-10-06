"use client";

import { useEffect, useMemo, useState } from "react";
import { BatchCard } from "../components/BatchCard";
import { useAppContext } from "../contexts/AppContext";
import Loader from "../components/Loader";

function BatchListing() {
    const { batches, refetchBatches } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBatches = async () => {
            setIsLoading(true);
            await refetchBatches();
            setIsLoading(false);
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

    if (isLoading) {
        return <Loader message="Loading batches..." />;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {sortedBatches.length > 0 ? (
                <div className="grid-responsive">
                    {sortedBatches.map((batch) => (
                        <BatchCard
                            key={batch.id?.toString() ?? `batch-${Math.random()}`}
                            batch={batch}
                            isSoldOut={batch.itemsLeft === 0n}
                        />
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
