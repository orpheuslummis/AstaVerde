"use client";

import { useEffect } from "react";
import { useAppContext } from "../contexts/AppContext";
import { BatchCard } from "./BatchCard";

export function BatchListing() {
    const { batches, refetchBatches } = useAppContext();

    useEffect(() => {
        console.log("BatchListing received batches:", batches);
        const intervalId = setInterval(() => {
            console.log("Refetching batches...");
            refetchBatches();
        }, 10000); // Refetch every 10 seconds

        return () => clearInterval(intervalId);
    }, [refetchBatches, batches]);

    if (batches.length === 0) {
        console.log("No batches available");
        return <div className="text-center py-8 text-gray-600">No batches available yet.</div>;
    }

    // Sort batches: available first, then sold out
    const sortedBatches = [...batches].sort((a, b) => {
        if (a.itemsLeft > 0 && b.itemsLeft === 0) return -1;
        if (a.itemsLeft === 0 && b.itemsLeft > 0) return 1;
        return 0;
    });

    console.log("Sorted batches:", sortedBatches);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedBatches.map((batch) => (
                    <BatchCard key={batch.id} batch={batch} isSoldOut={batch.itemsLeft === 0} />
                ))}
            </div>
        </div>
    );
}
