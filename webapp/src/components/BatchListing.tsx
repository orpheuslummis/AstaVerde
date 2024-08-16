"use client";

import { useAppContext } from "../contexts/AppContext";
import { BatchCard } from "./BatchCard";

export function BatchListing() {
    const { batches } = useAppContext();

    if (batches.length === 0) {
        return <div>Loading batches...</div>;
    }

    // Sort batches: available first, then sold out
    const sortedBatches = [...batches].sort((a, b) => {
        if (a.itemsLeft > 0 && b.itemsLeft === 0) return -1;
        if (a.itemsLeft === 0 && b.itemsLeft > 0) return 1;
        return 0;
    });

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedBatches.map((batch) => (
                    <BatchCard
                        key={batch.id}
                        batch={batch}
                        isSoldOut={batch.itemsLeft === 0}
                    />
                ))}
            </div>
        </div>
    );
}
