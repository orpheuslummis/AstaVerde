import { formatEther } from "viem";
import { TabType } from "../hooks/useTokenGroups";

interface StatsDisplayProps {
  stats: {
    available: number;
    vaulted: number;
    currentScc: bigint;
    potentialScc: number;
  };
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function StatsDisplay({ stats, activeTab, onTabChange }: StatsDisplayProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <button
        onClick={() => onTabChange("available")}
        className={`p-4 rounded-xl transition-all ${
          activeTab === "available"
            ? "bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500"
            : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
          </svg>
          <span className="text-2xl font-bold">{stats.available}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Available NFTs</p>
      </button>

      <button
        onClick={() => onTabChange("vaulted")}
        className={`p-4 rounded-xl transition-all ${
          activeTab === "vaulted"
            ? "bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500"
            : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span className="text-2xl font-bold">{stats.vaulted}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">In Vault</p>
        <p className="text-xs text-purple-600 dark:text-purple-400">Earning SCC rewards</p>
      </button>

      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
          </svg>
          <span className="text-2xl font-bold">{Number(formatEther(stats.currentScc)).toFixed(2)}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Current SCC Balance</p>
        <p className="text-xs text-blue-600 dark:text-blue-400">Tradeable tokens</p>
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl">
        <div className="flex items-center justify-between mb-1">
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
          </svg>
          <span className="text-2xl font-bold">{stats.potentialScc}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Potential SCC</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">From {stats.potentialScc / 20} eligible NFTs</p>
      </div>
    </div>
  );
}

