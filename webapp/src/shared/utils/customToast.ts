import toast from "react-hot-toast";

export const customToast = {
    success: (message: string) => {
        toast.success(message, {
            duration: 4000,
            position: "bottom-right",
            style: {
                background: "#10B981",
                color: "#fff",
            },
        });
    },

    error: (message: string) => {
        toast.error(message, {
            duration: 4000,
            position: "bottom-right",
            style: {
                background: "#EF4444",
                color: "#fff",
            },
        });
    },

    info: (message: string) => {
        toast(message, {
            duration: 3000,
            position: "bottom-right",
            style: {
                background: "#3B82F6",
                color: "#fff",
            },
        });
    },

    warning: (message: string) => {
        toast(message, {
            duration: 4000,
            position: "bottom-right",
            style: {
                background: "#F59E0B",
                color: "#fff",
            },
        });
    },
};
