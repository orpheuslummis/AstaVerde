import React from "react";

interface LoaderProps {
    message?: string;
}

const Loader: React.FC<LoaderProps> = ({ message = "Loading..." }) => {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50"
      data-fixed-overlay="true"
      suppressHydrationWarning
    >
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl flex flex-col items-center">
        <div className="loader-spinner mb-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-500"></div>
        </div>
        <h2 className="text-center text-xl font-semibold text-gray-700 dark:text-gray-300">{message}</h2>
      </div>
    </div>
  );
};

export default Loader;
