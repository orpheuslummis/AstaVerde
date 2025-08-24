import toast from "react-hot-toast";

// Default durations for different toast types
const TOAST_DURATIONS = {
  success: 6000,    // 6 seconds for success messages
  error: 10000,     // 10 seconds for errors (need more time to read)
  info: 7000,       // 7 seconds for info
  warning: 8000,    // 8 seconds for warnings
  transaction: 12000, // 12 seconds for transaction-related messages
};

export const customToast = {
  success: (message: string, duration?: number) => {
    toast.success(message, {
      duration: duration || TOAST_DURATIONS.success,
    });
  },

  error: (message: string, duration?: number) => {
    toast.error(message, {
      duration: duration || TOAST_DURATIONS.error,
    });
  },

  info: (message: string, duration?: number) => {
    toast(message, {
      icon: "ℹ️",
      duration: duration || TOAST_DURATIONS.info,
    });
  },

  warning: (message: string, duration?: number) => {
    toast(message, {
      icon: "⚠️",
      duration: duration || TOAST_DURATIONS.warning,
    });
  },

  // Special method for transaction-related messages that need more time
  transaction: (message: string) => {
    toast(message, {
      icon: "📝",
      duration: TOAST_DURATIONS.transaction,
      style: {
        background: "#1e293b",
        color: "#fff",
      },
    });
  },
};
