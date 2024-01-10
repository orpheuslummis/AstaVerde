"use client";

import { BatchListing } from "../components/BatchListing";

/*
mode: available , fullySold
start: the latest batch
perPage: 10
*/

export default function Page() {
  return (
    <>
      <BatchListing />
    </>
  );
}
