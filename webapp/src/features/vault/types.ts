export interface VaultLoan {
    tokenId: bigint;
    borrower: string;
    active: boolean;
}

export interface VaultStats {
    totalLoans: number;
    activeLoans: number;
    totalSccIssued: bigint;
    userBalance: bigint;
    userAllowance: bigint;
}

export interface VaultTransaction {
    type: 'deposit' | 'withdraw' | 'approve';
    status: 'pending' | 'success' | 'error';
    hash?: string;
    error?: string;
}