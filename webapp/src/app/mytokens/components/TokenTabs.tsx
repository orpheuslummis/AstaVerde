import { TabType } from "../hooks/useTokenGroups";

interface TokenTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts: {
    all: number;
    available: number;
    vaulted: number;
  };
}

export function TokenTabs({ activeTab, onTabChange, counts }: TokenTabsProps) {
  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => onTabChange("all")}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          activeTab === "all"
            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        All Assets
        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
          {counts.all}
        </span>
      </button>
      <button
        onClick={() => onTabChange("available")}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          activeTab === "available"
            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        Available
        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          {counts.available}
        </span>
      </button>
      <button
        onClick={() => onTabChange("vaulted")}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          activeTab === "vaulted"
            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        In Vault
        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300">
          {counts.vaulted}
        </span>
      </button>
    </div>
  );
}

