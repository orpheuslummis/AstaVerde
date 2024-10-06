"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BatchCard } from "../components/BatchCard";
import { useAppContext } from "../contexts/AppContext";
import Loader from "../components/Loader";

function BatchListing() {
    const { batches, refetchBatches } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const batchesPerPage = 8;

    const fetchBatches = useCallback(async () => {
        setIsLoading(true);
        await refetchBatches();
        setIsLoading(false);
    }, [refetchBatches]);

    useEffect(() => {
        fetchBatches();
        const intervalId = setInterval(fetchBatches, 30000); // Refetch every 30 seconds
        return () => clearInterval(intervalId);
    }, [fetchBatches]);

    const sortedBatches = useMemo(() => {
        return [...batches].sort((a, b) => {
            const aItemsLeft = a.itemsLeft ?? 0n;
            const bItemsLeft = b.itemsLeft ?? 0n;
            if (aItemsLeft > 0n && bItemsLeft === 0n) return -1;
            if (aItemsLeft === 0n && bItemsLeft > 0n) return 1;
            return Number(b.id ?? 0n) - Number(a.id ?? 0n);
        });
    }, [batches]);

    const paginatedBatches = useMemo(() => {
        const startIndex = (currentPage - 1) * batchesPerPage;
        return sortedBatches.slice(startIndex, startIndex + batchesPerPage);
    }, [sortedBatches, currentPage, batchesPerPage]);

    const totalPages = Math.ceil(sortedBatches.length / batchesPerPage);

    const handlePreviousPage = useCallback(() => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    }, [totalPages]);

    if (isLoading && batches.length === 0) {
        return <Loader message="Loading batches..." />;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {sortedBatches.length > 0 ? (
                <>
                    <div className="grid-responsive">
                        {paginatedBatches.map((batch) => (
                            <BatchCard
                                key={batch.id?.toString() ?? `batch-${Math.random()}`}
                                batch={batch}
                                isSoldOut={batch.itemsLeft === 0n}
                            />
                        ))}
                    </div>
                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1}
                            className="px-4 py-2 mr-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                        >
                            Previous
                        </button>
                        <span className="px-4 py-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 ml-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
                        >
                            Next
                        </button>
                    </div>
                </>
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
