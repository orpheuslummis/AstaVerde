"use client";

import { ConnectKitButton } from "../components/ConnectKitButton";
import Link from "next/link";
import React from "react";
import { useContractRead } from "wagmi";
import { astaverdeContractConfig } from "../lib/contracts";

interface HeaderProps {
  title: string;
  links: { name: string; url: string }[];
}

export function Header({ title, links }: HeaderProps) {
  return (
    <header className="flex items-center justify-between bg-green-500 p-4 shadow-md">
      <Link href={"/"}>
        <h1 className="text-white font-bold text-2xl hover:text-blue-400 transition-colors duration-300">{title}</h1>
      </Link>
      <nav>
        <ul className="flex items-center">
          {links.map((link, index) => (
            <li key={index} className="mr-4">
              <Link href={link.url}>
                <span className="text-white hover:text-blue-900 transition-colors duration-300">{link.name}</span>
              </Link>
            </li>
          ))}

          {/* Show USDC Balance */}
          
          <li className="ml-2 text-sm py-2 px-3 rounded-full text-blue-500 hover:bg-blue-100 transition-colors duration-300">
            <ConnectKitButton />
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function ExplanationSection() {
  // For providing a high-level explanation of the platform.
}

// Purchase Component
export function Purchase() {
  // To handle the purchase functionality, invoking buyBatch method on the contract.
}

// My Tokens (Redeem) Page Components

// Tokens Display Component
export function TokensDisplay() {
  // To show tokens owned by the connected wallet.
}

// Token Details Component
export function TokenDetails() {
  // For displaying details about each token and handling the redemption process through redeemTokens.
}

// Pagination Component
export function Pagination() {
  // For managing the display of tokens in a paginated format.
}

// Category Sorting Component
export function CategorySorting() {
  // To categorize tokens into 'Not-Redeemed' and 'Redeemed'.
}

// Admin Page Components

// Admin Control Components
export function AdminControl() {
  // For updating contract parameters like setPlatformSharePercentage, setPriceFloor, etc.
}

// Contract Interaction Component
export function ContractInteraction() {
  // For stopping and starting the contract, and for the admin to claim platform funds.
}

// FAQ Page Component
export function FAQPage() {
  // A simple text-based component for frequently asked questions.
}

// export function useLastBatchID(): { lastBatchID: number; isError: boolean; isLoading: boolean } {
//   const { data: lastBatchID, isError, isLoading } = useContractRead({
//     abi: astaverdeContractConfig.abi,
//     functionName: 'lastBatchID',
//   });
//   return { lastBatchID: Number(lastBatchID), isError, isLoading };
// }