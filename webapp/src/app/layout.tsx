import { OnboardingModal } from "../astaverde_components/OnboardingModal";
import { Header } from "../astaverde_components/all";
import { Connected } from "../components/Connected";
import { Providers } from "./providers";
import "./styles/globals.css";

export const metadata = {
  title: "wagmi",
};

const links = [
  { name: "Market", url: "/" },
  { name: "My Tokens", url: "/mytokens" },
  { name: "About", url: "/about" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="max-w-3xl mx-auto">
        <OnboardingModal />
        <Providers>
          <Header title={"Asta Verde"} links={links} />
          <Connected>
            <h2>Connected</h2>
          </Connected>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
