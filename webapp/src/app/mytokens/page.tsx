/*
mode: all, redeemed, not-redeemed
start: the latest batch
perPage: 10
*/
"use client";

import { use, useEffect, useState } from "react";
import { useContractWrite, usePrepareContractWrite, useContractRead, useAccount } from "wagmi";
import { astaverdeContractConfig, usdcContractConfig } from "../../lib/contracts";

export default function Page() {

  //
  

  return (
    <>
      <h1>My Tokens</h1>

      <p>TBD</p>
    </>
  );
}
