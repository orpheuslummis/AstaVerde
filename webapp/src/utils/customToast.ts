import { toast } from "react-hot-toast";

type CustomToast = {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
};

export const customToast: CustomToast = {
    success: (message: string) => {
        toast.success(message, {
            icon: "🎉",
            style: {
                border: "2px solid #4CAF50",
                padding: "16px",
                color: "#4CAF50",
            },
            iconTheme: {
                primary: "#4CAF50",
                secondary: "#FFFAEE",
            },
        });
    },
    error: (message: string) => {
        toast.error(message, {
            icon: "😕",
            style: {
                border: "2px solid #FF6347",
                padding: "16px",
                color: "#FF6347",
            },
            iconTheme: {
                primary: "#FF6347",
                secondary: "#FFFAEE",
            },
        });
    },
    info: (message: string) => {
        toast(message, {
            icon: "ℹ️",
            style: {
                border: "2px solid #3498db",
                padding: "16px",
                color: "#3498db",
            },
            iconTheme: {
                primary: "#3498db",
                secondary: "#FFFAEE",
            },
        });
    },
    warning: (message: string) => {
        toast(message, {
            icon: "⚠️",
            style: {
                border: "2px solid #FFA500",
                padding: "16px",
                color: "#FFA500",
            },
            iconTheme: {
                primary: "#FFA500",
                secondary: "#FFFAEE",
            },
        });
    },
};
