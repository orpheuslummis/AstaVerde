import { Toaster } from "react-hot-toast";
import { navigationLinks } from "../config/constants";
import "../app/styles/globals.css";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { OnboardingModal } from "../components/OnboardingModal";
import { Providers } from "../components/Providers";

export const metadata = {
  title: "AstaVerde - Carbon Offset Marketplace",
  description: "Trade tokenized carbon offsets on the Base blockchain",
  keywords: "carbon offsets, NFT, blockchain, Base, environmental",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Providers>
          <OnboardingModal />
          <Header links={navigationLinks} />
          <div className="flex-grow container">
            <main>{children}</main>
          </div>
          <Footer />
          <Toaster
            position="top-center"
            gutter={8}
            toastOptions={{
              duration: 7000,
              // Minimal, readable default styling
              style: {
                background: "#111827",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 14px",
              },
              success: {
                duration: 6000,
                iconTheme: { primary: "#10B981", secondary: "#fff" },
              },
              error: {
                duration: 10000,
                iconTheme: { primary: "#EF4444", secondary: "#fff" },
              },
              loading: {
                duration: 15000,
                iconTheme: { primary: "#3B82F6", secondary: "#fff" },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
