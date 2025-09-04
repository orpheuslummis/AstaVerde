"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BatchCard } from "../components/BatchCard";
import { useAppContext } from "../contexts/AppContext";
import Loader from "../components/Loader";

function BatchListing() {
  const { batches, refetchBatches } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const batchesPerPage = 8;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBatches = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    try {
      await refetchBatches();
    } catch (error) {
      console.error("Failed to fetch batches:", error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [refetchBatches]);

  useEffect(() => {
    // Add a small delay to ensure providers are ready
    const timeoutId = setTimeout(() => {
      fetchBatches();
    }, 1000);

    const intervalId = setInterval(fetchBatches, 30000); // Refetch every 30 seconds

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {paginatedBatches.map((batch) => (
              <BatchCard
                key={batch.id?.toString() ?? `batch-${Math.random()}`}
                batch={batch}
                isSoldOut={batch.itemsLeft === 0n}
              />
            ))}
          </div>
          <div className="mt-8 flex justify-center items-center gap-4">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors hover:opacity-90"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-foreground font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors hover:opacity-90"
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
