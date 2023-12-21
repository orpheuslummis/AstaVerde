import React from 'react';
// import BatchCard from '../components/BatchCard';
// import { useContractInfiniteReads, paginatedIndexesConfig, useContractRead } from 'wagmi'
// import { astaverdeContractConfig } from "../lib/contracts";
import { BatchListing } from '../components/BatchListing';

/*
mode: available , fullySold
start: the latest batch
perPage: 10
*/

export default function Page() {

  return (
    <>
      {/* {{
        data.map((batch) => (
          <BatchCard key={batch.id} batch={batch} helia={helia} />
        ))
      }} */}
      <BatchListing />
    </>
  );
}
