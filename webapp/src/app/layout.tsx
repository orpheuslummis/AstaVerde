"use client";

import { Toaster } from 'react-hot-toast';
import { navigationLinks } from "../app.config";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { OnboardingModal } from "../components/OnboardingModal";
import { AppProvider } from '../contexts/AppContext';
import { Providers } from './providers';
import "./styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppProvider>
            <OnboardingModal />
            <Header links={navigationLinks} />
            <div className="container min-h-[calc(100vh-124px)]">
              <main>{children}</main>
            </div>
            <Footer />
          </AppProvider>
        </Providers>
        <Toaster
          position="center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#333',
              color: '#fff',
              padding: '20px',
              borderRadius: '10px',
              fontSize: '18px',
              maxWidth: '500px',
              textAlign: 'center' as const,
            },
          }}
        />
      </body>
    </html>
  );
}