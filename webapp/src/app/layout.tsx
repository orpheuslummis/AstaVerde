import { navigationLinks } from "../app.config";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { OnboardingModal } from "../components/OnboardingModal";
import { Providers } from "./providers";
import "./styles/globals.css";
import { cloneElement } from "react";

export const metadata = {
  icons: {
    icon: "/eco_tradezone.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactElement }) {
  return (
    <html lang="en">
      <body className="">
        <OnboardingModal />
        <Providers>
          <Header links={navigationLinks} />
          <div className="min-h-[calc(100vh-124px)] max-w-6xl mx-auto">
            <main>{cloneElement(children)}</main>
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
