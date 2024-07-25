// src/components/GlobalLoadingProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const GlobalLoadingContext = createContext<{
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}>({
    isLoading: true,
    setIsLoading: () => { },
});

export const useGlobalLoading = () => useContext(GlobalLoadingContext);

export const GlobalLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(false);
    }, []);

    return (
        <GlobalLoadingContext.Provider value={{ isLoading, setIsLoading }}>
            {isLoading ? <div>Loading...</div> : children}
        </GlobalLoadingContext.Provider>
    );
};