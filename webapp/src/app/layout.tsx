import { navigationLinks } from "../app.config";
// TBD metadata
// import { Connected } from "../components/Connected";
import { OnboardingModal } from "../components/OnboardingModal";
import { Header } from "../components/all";
import { Providers } from "./providers";
import "./styles/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="max-w-3xl mx-auto">
        <OnboardingModal />
        <Providers>
          <Header title={"Asta Verde"} links={navigationLinks} />
          {/* <Connected>
            <h2>Connected</h2>
          </Connected> */}
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
