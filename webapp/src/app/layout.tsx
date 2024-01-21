import { navigationLinks } from "../app.config";
import { OnboardingModal } from "../components/OnboardingModal";
import { Header } from "../components/Header";
import { Providers } from "./providers";
import "./styles/globals.css";
import { cloneElement } from "react";

export default function RootLayout({ children }: { children: React.ReactElement }) {
  return (
    <html lang="en">
      <body className="">
        <OnboardingModal />
        <Providers>
          <Header links={navigationLinks} />
          <div className="max-w-6xl mx-auto">
            <main>{cloneElement(children)}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
