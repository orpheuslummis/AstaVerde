import React from "react";
import { VaultErrorState } from "../utils/errors";
import { ExclamationTriangleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface VaultErrorDisplayProps {
  error: VaultErrorState;
  onDismiss?: () => void;
}

export function VaultErrorDisplay({ error, onDismiss }: VaultErrorDisplayProps) {
  const getErrorIcon = () => {
    switch (error.type) {
      case "user-rejected":
        return <XCircleIcon className="h-5 w-5 text-yellow-600" />;
      case "network":
      case "gas":
      case "insufficient-funds":
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
    }
  };

  const getErrorColorClasses = () => {
    switch (error.type) {
      case "user-rejected":
        return {
          container: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
          title: "text-yellow-800 dark:text-yellow-200",
          details: "text-yellow-700 dark:text-yellow-300",
          button: "bg-yellow-600 hover:bg-yellow-700 text-white",
        };
      case "network":
      case "gas":
        return {
          container: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800",
          title: "text-orange-800 dark:text-orange-200",
          details: "text-orange-700 dark:text-orange-300",
          button: "bg-orange-600 hover:bg-orange-700 text-white",
        };
      default:
        return {
          container: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
          title: "text-red-800 dark:text-red-200",
          details: "text-red-700 dark:text-red-300",
          button: "bg-red-600 hover:bg-red-700 text-white",
        };
    }
  };

  const colors = getErrorColorClasses();

  return (
    <div
      className={`relative p-4 border rounded-lg ${colors.container} transition-all duration-200`}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">{getErrorIcon()}</div>
        <div className="ml-3 flex-1">
          <h4 className={`font-semibold ${colors.title}`}>{error.message}</h4>
          {error.details && (
            <p className={`text-sm mt-1 ${colors.details}`}>{error.details}</p>
          )}
          {error.action && (
            <button
              onClick={error.action.handler}
              className={`mt-3 px-4 py-2 text-sm font-medium rounded-md ${colors.button} 
                         transition-colors duration-200 focus:outline-none focus:ring-2 
                         focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800`}
            >
              {error.action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-3 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <span className="sr-only">Dismiss</span>
            <XCircleIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

interface CompactErrorDisplayProps {
  error: VaultErrorState;
}

export function CompactErrorDisplay({ error }: CompactErrorDisplayProps) {
  const getErrorColorClasses = () => {
    switch (error.type) {
      case "user-rejected":
        return "text-yellow-600 dark:text-yellow-400";
      case "network":
      case "gas":
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-red-600 dark:text-red-400";
    }
  };

  return (
    <div className="flex items-center space-x-1">
      <XCircleIcon className={`h-4 w-4 ${getErrorColorClasses()}`} />
      <span className={`text-xs ${getErrorColorClasses()}`}>
        {error.message}
      </span>
    </div>
  );
}
