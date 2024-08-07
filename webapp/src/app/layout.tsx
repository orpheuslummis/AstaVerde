import { Toaster } from 'react-hot-toast';
import { navigationLinks } from "../app.config";
import "../app/styles/globals.css";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { OnboardingModal } from "../components/OnboardingModal";
import { Providers } from "../components/Providers";

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
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}