import { navigationLinks } from "../app.config";
// TBD metadata
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
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
